import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { loadTreeBySlug } from '@/lib/db/trees'
import { isValidSlug } from '@/lib/tree/slug'
import { MAX_SNAPSHOT_NODES } from '@/lib/tree/snapshot'

const { POST } = await import('@/app/api/share/route')

function req(body: unknown) {
  return new Request('http://localhost/api/share', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const node = (q: string, category = '네트워크') =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: q,
    body: '해설',
    primaryCategory: category,
    status: 'ready',
    origin: 'on_demand',
  })

describe('POST /api/share', () => {
  beforeEach(truncateAll)

  it('mints a link for a real path', async () => {
    const a = await node('뿌리는?')
    const b = await node('그 다음은?')

    const res = await POST(
      req({
        occurrences: [
          { id: 'a', node_id: a, parent_id: null },
          { id: 'b', node_id: b, parent_id: 'a' },
        ],
        current_id: 'b',
      }),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(isValidSlug(body.slug)).toBe(true)
    expect(body.url).toBe(`/t/${body.slug}`)

    const tree = await loadTreeBySlug(body.slug)
    expect(tree!.nodes).toHaveLength(2)
  })

  it('never caches the response', async () => {
    const a = await node('뿌리는?')
    const res = await POST(
      req({ occurrences: [{ id: 'a', node_id: a, parent_id: null }], current_id: 'a' }),
    )
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('takes the title the sharer typed', async () => {
    const a = await node('뿌리는?')
    const res = await POST(
      req({
        occurrences: [{ id: 'a', node_id: a, parent_id: null }],
        current_id: 'a',
        title: '오늘 판 것',
      }),
    )
    expect((await res.json()).title).toBe('오늘 판 것')
  })

  it('ignores the question text the client sent and reads it from the database', async () => {
    // 클라이언트 문장을 그대로 저장하면 남의 화면에 임의 텍스트를 띄우는 통로가 된다
    const a = await node('진짜 질문은?')
    const res = await POST(
      req({
        occurrences: [
          { id: 'a', node_id: a, parent_id: null, question: '<script>alert(1)</script>' },
        ],
        current_id: 'a',
      }),
    )

    const tree = await loadTreeBySlug((await res.json()).slug)
    expect(tree!.nodes[0].question).toBe('진짜 질문은?')
  })

  it('will not let the client pick the board category', async () => {
    const a = await node('DB 질문은?', '데이터베이스')
    const res = await POST(
      req({
        occurrences: [{ id: 'a', node_id: a, parent_id: null }],
        current_id: 'a',
        category: '모바일',
      }),
    )

    const tree = await loadTreeBySlug((await res.json()).slug)
    expect(tree!.category).toBe('데이터베이스')
  })

  it('rejects a body that is not json', async () => {
    const res = await POST(
      new Request('http://localhost/api/share', { method: 'POST', body: '{' }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_input')
  })

  it('rejects an empty path', async () => {
    const res = await POST(req({ occurrences: [], current_id: 'a' }))
    expect(res.status).toBe(400)
  })

  it('rejects a node id that is not a uuid before touching the database', async () => {
    const res = await POST(
      req({ occurrences: [{ id: 'a', node_id: 'nope', parent_id: null }], current_id: 'a' }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_input')
  })

  it('explains a broken path in words a reader can act on', async () => {
    const a = await node('뿌리는?')
    const res = await POST(
      req({ occurrences: [{ id: 'a', node_id: a, parent_id: null }], current_id: 'gone' }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.reason).toBe('no_current')
    expect(body.detail).toContain('새로고침')
  })

  it('rejects a path pointing at a question that does not exist', async () => {
    const res = await POST(
      req({
        occurrences: [
          { id: 'a', node_id: '99999999-9999-4999-8999-999999999999', parent_id: null },
        ],
        current_id: 'a',
      }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('unknown_node')
  })

  it('refuses a path larger than the render limit', async () => {
    const a = await node('뿌리는?')
    const occurrences = [{ id: 'a', node_id: a, parent_id: null as string | null }]
    for (let i = 0; i <= MAX_SNAPSHOT_NODES; i += 1) {
      occurrences.push({ id: `n${i}`, node_id: a, parent_id: 'a' })
    }

    const res = await POST(req({ occurrences, current_id: 'a' }))
    expect(res.status).toBe(400)
  })
})
