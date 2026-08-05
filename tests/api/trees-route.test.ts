import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { createSharedTree } from '@/lib/db/trees'

const { GET } = await import('@/app/api/trees/route')

function req(query = '') {
  return new Request(`http://localhost/api/trees${query}`)
}

async function share(question: string, category: string) {
  const id = await insertNode({
    identityScope: 'network',
    normalizedQuestion: question,
    body: '해설',
    primaryCategory: category,
    status: 'ready',
    origin: 'on_demand',
  })
  await createSharedTree({
    snapshot: { rootNodeId: id, rows: [{ tempId: 'r', nodeId: id, parentTempId: null, position: 0 }] },
  })
}

describe('GET /api/trees', () => {
  beforeEach(truncateAll)

  it('lists what has been shared', async () => {
    await share('첫 질문은?', '네트워크')
    await share('둘째 질문은?', '운영체제')

    const body = await (await GET(req())).json()
    expect(body.trees).toHaveLength(2)
    expect(body.trees[0].title).toBe('둘째 질문은?')
  })

  it('filters by category', async () => {
    await share('첫 질문은?', '네트워크')
    await share('둘째 질문은?', '운영체제')

    const body = await (await GET(req('?category=운영체제'))).json()
    expect(body.trees).toHaveLength(1)
    expect(body.trees[0].category).toBe('운영체제')
  })

  it('shows everything when the category is not one we know', async () => {
    // 오타 하나에 빈 게시판을 보여주면 고장으로 읽힌다
    await share('첫 질문은?', '네트워크')
    const body = await (await GET(req('?category=없는분류'))).json()
    expect(body.trees).toHaveLength(1)
  })

  it('falls back to recent when the sort is not one we know', async () => {
    await share('첫 질문은?', '네트워크')
    const res = await GET(req('?sort=이상한값'))
    expect(res.status).toBe(200)
    expect((await res.json()).trees).toHaveLength(1)
  })

  it('accepts the popular sort', async () => {
    await share('첫 질문은?', '네트워크')
    const res = await GET(req('?sort=popular'))
    expect(res.status).toBe(200)
  })

  it('survives a cursor somebody typed by hand', async () => {
    await share('첫 질문은?', '네트워크')
    const res = await GET(req('?cursor=%2F%2Fnot-a-cursor'))
    expect(res.status).toBe(200)
    expect((await res.json()).trees).toHaveLength(1)
  })

  it('is publicly cacheable but only briefly', async () => {
    // 개인 데이터가 없어 공개 캐시 대상이다. 다만 공유한 사람이 자기 것을
    // 못 찾으면 안 되니 길게 잡지 않는다
    const cc = (await GET(req())).headers.get('cache-control') ?? ''
    expect(cc).toContain('public')
    expect(cc).not.toContain('no-store')

    const maxAge = Number(/max-age=(\d+)/.exec(cc)?.[1] ?? '9999')
    expect(maxAge).toBeLessThanOrEqual(60)
  })

  it('returns an empty page rather than an error before anything is shared', async () => {
    const body = await (await GET(req())).json()
    expect(body).toEqual({ trees: [], nextCursor: null })
  })
})
