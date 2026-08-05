import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const publishMock = vi.fn()
vi.mock('@/lib/daily/publish', () => ({
  publishDaily: (...a: unknown[]) => publishMock(...a),
}))

const { POST } = await import('@/app/api/publish-daily/route')

const SECRET = 'cron-secret-value'

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/publish-daily', { method: 'POST', headers })
}

const tree = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'daily-2026-08-06',
  title: '인덱스는 왜 필요한가?',
  category: '데이터베이스',
  summary: '요약',
  publishDate: '2026-08-06',
  publishedAt: '2026-08-05T23:07:00.000Z',
  isToday: true,
  root: {
    id: '22222222-2222-2222-2222-222222222222',
    question: '인덱스는 왜 필요한가?',
    body: '해설',
    identityScope: 'postgres',
    suggestions: [
      { id: 's1', text: '꼬리1?', resolved: false },
      { id: 's2', text: '꼬리2?', resolved: false },
    ],
  },
}

describe('POST /api/publish-daily', () => {
  const original = process.env.CRON_SECRET

  beforeEach(() => {
    publishMock.mockReset()
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  })

  // ── 인증 ──────────────────────────────────────────────────

  it('rejects a request with no credentials', async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(publishMock).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const res = await POST(req({ authorization: 'Bearer nope' }))
    expect(res.status).toBe(401)
    expect(publishMock).not.toHaveBeenCalled()
  })

  it('rejects a secret that is only a prefix', async () => {
    const res = await POST(req({ authorization: `Bearer ${SECRET.slice(0, 5)}` }))
    expect(res.status).toBe(401)
  })

  it('locks itself when CRON_SECRET is not configured', async () => {
    // 설정이 없다고 열어두면 누구나 발행할 수 있다. 잠그는 쪽이 맞다
    delete process.env.CRON_SECRET
    const res = await POST(req({ authorization: 'Bearer anything' }))
    expect(res.status).toBe(401)
    expect(publishMock).not.toHaveBeenCalled()
  })

  it('accepts the bearer header', async () => {
    publishMock.mockResolvedValue({ kind: 'published', tree, seed: { term: '인덱스', category: '데이터베이스' } })
    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
  })

  it('accepts the x-cron-secret header', async () => {
    publishMock.mockResolvedValue({ kind: 'published', tree, seed: { term: '인덱스', category: '데이터베이스' } })
    const res = await POST(req({ 'x-cron-secret': SECRET }))
    expect(res.status).toBe(200)
  })

  // ── 결과 매핑 ─────────────────────────────────────────────

  it('returns the published tree id, slug and question', async () => {
    publishMock.mockResolvedValue({
      kind: 'published',
      tree,
      seed: { term: '인덱스', category: '데이터베이스' },
    })

    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    const json = await res.json()

    expect(json.status).toBe('published')
    expect(json.tree.id).toBe(tree.id)
    expect(json.tree.slug).toBe(tree.slug)
    expect(json.tree.question).toBe(tree.root.question)
    expect(json.tree.node_id).toBe(tree.root.id)
    expect(json.tree.publish_date).toBe('2026-08-06')
    expect(json.seed.term).toBe('인덱스')
  })

  it('returns 200 and the same tree when the day is already published', async () => {
    publishMock.mockResolvedValue({ kind: 'already_published', tree })

    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.status).toBe('already_published')
    expect(json.tree.id).toBe(tree.id)
  })

  it('fails loudly when seeds run out', async () => {
    publishMock.mockResolvedValue({ kind: 'seed_exhausted' })

    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    // 조용히 200을 주면 워크플로가 초록불이라 소진을 아무도 모른다
    expect(res.status).toBe(409)

    const json = await res.json()
    expect(json.status).toBe('seed_exhausted')
    expect(json.error).toBe('seed_exhausted')
    expect(typeof json.detail).toBe('string')
  })

  it('fails loudly when generation blows up', async () => {
    publishMock.mockResolvedValue({ kind: 'generation_failed', detail: 'boom' })

    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(502)

    const json = await res.json()
    expect(json.status).toBe('generation_failed')
    expect(json.detail).toBe('boom')
  })

  it('returns 500 when the handler itself throws', async () => {
    publishMock.mockRejectedValue(new Error('db down'))

    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('internal_error')
  })

  it('never caches the response', async () => {
    publishMock.mockResolvedValue({ kind: 'already_published', tree })
    const res = await POST(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
})
