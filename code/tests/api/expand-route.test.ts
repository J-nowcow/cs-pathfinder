import { describe, it, expect, vi, beforeEach } from 'vitest'

const expandMock = vi.fn()
const afterMock = vi.fn()
const seedMock = vi.fn()
const callerMock = vi.fn()
vi.mock('@/lib/expand', () => ({ expand: (...a: unknown[]) => expandMock(...a) }))
// Route-contract tests use a mocked expansion result. Keep real bootstrap and
// background embedding out of the shared test DB; both have dedicated suites.
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: () => seedMock() }))
vi.mock('@/lib/llm/resolve', () => ({ resolveCaller: () => callerMock() }))
vi.mock('@/lib/embed/backfill', () => ({ backfillEmbedding: vi.fn() }))
vi.mock('@/lib/next/safe-after', () => ({ safeAfter: (...a: unknown[]) => afterMock(...a) }))

const { POST } = await import('@/app/api/expand/route')

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/expand', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const validBody = {
  idempotency_key: '11111111-1111-1111-1111-111111111111',
  parent_node_id: '22222222-2222-2222-2222-222222222222',
  ancestor_node_ids: ['22222222-2222-2222-2222-222222222222'],
  mode: 'free',
  raw_input: '왜 코어 수 기반인가요?',
}

const okOutcome = {
  kind: 'ok',
  cache: 'miss',
  quota: { used: 1, limit: 5 },
  node: {
    id: '33333333-3333-3333-3333-333333333333',
    question: '정규화된 질문',
    body: '해설',
    identityScope: 'postgres',
    primaryCategory: '데이터베이스',
    suggestions: [
      { id: 'sug-1', text: '꼬리', targetNodeId: null },
      { id: 'sug-2', text: '해소된 꼬리', targetNodeId: 'node-x' },
    ],
  },
}

describe('POST /api/expand', () => {
  beforeEach(() => {
    expandMock.mockReset()
    afterMock.mockReset()
    seedMock.mockReset().mockResolvedValue(undefined)
    callerMock.mockReset().mockReturnValue(undefined)
  })

  it('returns 200 with node payload on success', async () => {
    expandMock.mockResolvedValue(okOutcome)
    const res = await POST(req(validBody))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.node.id).toBe(okOutcome.node.id)
    expect(json.cache).toBe('miss')
    expect(json.node.suggestions[0].resolved).toBe(false)
    expect(json.node.suggestions[1].resolved).toBe(true)
    expect(afterMock).toHaveBeenCalledTimes(1)
  })

  it('does not schedule embedding for a cached response', async () => {
    expandMock.mockResolvedValue({ ...okOutcome, cache: 'hit' })
    expect((await POST(req(validBody))).status).toBe(200)
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('never caches the response', async () => {
    expandMock.mockResolvedValue(okOutcome)
    const res = await POST(req(validBody))
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('returns 400 on malformed json', async () => {
    const res = await POST(
      new Request('http://localhost/api/expand', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on missing fields', async () => {
    const res = await POST(req({ mode: 'free' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_input')
  })

  it('returns 400 on input validation failure', async () => {
    expandMock.mockResolvedValue({
      kind: 'invalid',
      code: 'pii_suspected',
      detail: '개인정보로 보입니다.',
    })
    const res = await POST(req(validBody))
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error).toBe('invalid_input')
    expect(json.code).toBe('pii_suspected')
  })

  it('returns 422 when the gate rejects', async () => {
    expandMock.mockResolvedValue({ kind: 'rejected', reason: 'CS 학습과 무관합니다.' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(422)

    const json = await res.json()
    expect(json.error).toBe('irrelevant')
    expect(json.reason).toContain('무관')
  })

  it('returns 429 when quota is exhausted', async () => {
    expandMock.mockResolvedValue({ kind: 'quota_exceeded' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(429)
    expect((await res.json()).error).toBe('quota_exceeded')
  })

  it('returns 429 with retry_after when busy', async () => {
    expandMock.mockResolvedValue({ kind: 'busy' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(429)

    const json = await res.json()
    expect(json.error).toBe('rate_limited')
    expect(json.retry_after).toBeGreaterThan(0)
  })

  it('returns 504 when generation fails', async () => {
    expandMock.mockResolvedValue({ kind: 'generation_failed' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(504)
    expect((await res.json()).error).toBe('generation_timeout')
  })

  it('returns 200 with ancestor_jump when already on the path', async () => {
    expandMock.mockResolvedValue({
      kind: 'ancestor_jump',
      ancestorIndex: 1,
      nodeId: '44444444-4444-4444-4444-444444444444',
    })
    const res = await POST(req(validBody))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.ancestor_jump.index).toBe(1)
    expect(json.node).toBeNull()
  })

  it('returns 404 when the parent node is missing', async () => {
    expandMock.mockResolvedValue({ kind: 'not_found', what: 'parent' })
    const res = await POST(req(validBody))
    expect(res.status).toBe(404)
  })

  it('derives the quota key from the forwarded ip', async () => {
    expandMock.mockResolvedValue(okOutcome)
    await POST(req(validBody, { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))
    expect(expandMock.mock.calls[0][0].quotaKey).toBe('anon:203.0.113.7')
  })

  it('falls back to unknown when no ip header is present', async () => {
    expandMock.mockResolvedValue(okOutcome)
    await POST(req(validBody))
    expect(expandMock.mock.calls[0][0].quotaKey).toBe('anon:unknown')
  })

  it.each([
    ['malformed JSON', 'not json'],
    ['empty body', ''],
    ['null JSON', 'null'],
    ['array JSON', '[]'],
    ['missing fields', JSON.stringify({ mode: 'free' })],
    ['invalid parent UUID', JSON.stringify({ ...validBody, parent_node_id: 'invalid' })],
    ['invalid ancestor UUID', JSON.stringify({ ...validBody, ancestor_node_ids: ['invalid'] })],
    ['invalid mode', JSON.stringify({ ...validBody, mode: 'invalid' })],
    ['empty idempotency key', JSON.stringify({ ...validBody, idempotency_key: '' })],
  ])('rejects %s before seed or expansion work', async (_label, body) => {
    const res = await POST(new Request('http://localhost/api/expand', { method: 'POST', body }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_input')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(seedMock).not.toHaveBeenCalled()
    expect(expandMock).not.toHaveBeenCalled()
    expect(callerMock).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
  })

  it.each(['rejected', 'pending'] as const)('returns existing invalid responses without awaiting a %s seed', async (state) => {
    if (state === 'rejected') seedMock.mockImplementation(() => { throw Error('synthetic seed outage') })
    else seedMock.mockReturnValue(new Promise<void>(() => {}))
    const malformed = await POST(new Request('http://localhost/api/expand', { method: 'POST', body: 'not json' }))
    expect(malformed.status).toBe(400)
    expect(await malformed.text()).toBe(JSON.stringify({ error: 'invalid_input', detail: 'JSON 본문을 읽을 수 없습니다.' }))
    expect((await POST(req({ mode: 'free' }))).status).toBe(400)
    expect(seedMock).not.toHaveBeenCalled()
    expect(expandMock).not.toHaveBeenCalled()
    expect(callerMock).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('preserves accepted free defaults, non-UUID nonempty keys and unknown-field stripping', async () => {
    expandMock.mockResolvedValue(okOutcome)
    const { ancestor_node_ids, raw_input, ...body } = validBody
    expect((await POST(req({ ...body, idempotency_key: 'non-uuid-key', unknown_field: 'ignored' }))).status).toBe(200)
    expect(seedMock).toHaveBeenCalledTimes(1)
    expect(expandMock).toHaveBeenCalledTimes(1)
    expect(expandMock.mock.calls[0][0]).toMatchObject({ ancestorNodeIds: [], mode: 'free' })
    expect(expandMock.mock.calls[0][0].rawInput).toBeUndefined()
    expect(expandMock.mock.calls[0][0].suggestionId).toBeUndefined()
    expect(expandMock.mock.calls[0][0]).not.toHaveProperty('unknown_field')
  })

  it('keeps optional suggestion id and raw input in the domain path', async () => {
    expandMock.mockResolvedValue({ kind: 'not_found', what: 'suggestion' })
    const res = await POST(req({ idempotency_key: 'key', parent_node_id: validBody.parent_node_id, mode: 'suggestion' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found', what: 'suggestion' })
    expect(seedMock).toHaveBeenCalledTimes(1)
    expect(expandMock.mock.calls[0][0]).toMatchObject({ ancestorNodeIds: [], mode: 'suggestion' })
    expect(expandMock.mock.calls[0][0].rawInput).toBeUndefined()
    expect(expandMock.mock.calls[0][0].suggestionId).toBeUndefined()
  })

  it('keeps schema-valid blank free input in the existing parent/domain outcome path', async () => {
    expandMock.mockResolvedValue({ kind: 'not_found', what: 'parent' })
    const res = await POST(req({ ...validBody, raw_input: '' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found', what: 'parent' })
    expect(seedMock).toHaveBeenCalledTimes(1)
    expect(expandMock.mock.calls[0][0].rawInput).toBe('')
  })

  it('propagates the original valid-request seed error and permits a later valid attempt', async () => {
    const error = new Error('synthetic seed outage')
    seedMock.mockRejectedValueOnce(error)
    await expect(POST(req(validBody))).rejects.toBe(error)
    expect(expandMock).not.toHaveBeenCalled()
    expect(callerMock).not.toHaveBeenCalled()
    expect(afterMock).not.toHaveBeenCalled()
    expandMock.mockResolvedValue({ kind: 'busy' })
    const retry = await POST(req(validBody))
    expect(retry.status).toBe(429)
    expect(await retry.json()).toEqual({ error: 'rate_limited', retry_after: 3 })
    expect(seedMock).toHaveBeenCalledTimes(2)
    expect(expandMock).toHaveBeenCalledTimes(1)
    expect(callerMock).toHaveBeenCalledTimes(1)
    expect(afterMock).not.toHaveBeenCalled()
  })

  it('awaits pending seed before expansion on a valid request', async () => {
    let release!: () => void
    seedMock.mockReturnValue(new Promise<void>((resolve) => { release = resolve }))
    expandMock.mockResolvedValue({ kind: 'busy' })
    const request = req(validBody)
    vi.spyOn(request, 'json').mockResolvedValue(validBody)
    const response = POST(request)
    await Promise.resolve()
    expect(seedMock).toHaveBeenCalledTimes(1)
    expect(expandMock).not.toHaveBeenCalled()
    expect(callerMock).not.toHaveBeenCalled()
    release()
    expect((await response).status).toBe(429)
    expect(expandMock).toHaveBeenCalledTimes(1)
  })
})
