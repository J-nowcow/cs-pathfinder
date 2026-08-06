import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { saveRelations } from '@/lib/db/relations'
import { loadMapData } from '@/lib/db/graph'

/**
 * 지도에 그릴 선.
 *
 * 두 종류가 함께 실린다. 사람이 걸어간 길(`qedge`)과 판정이 이은 관계
 * (`semantic_relation`)다. 관계가 없으면 지도는 점만 249개다 — 꼬리질문이
 * 기존 질문과 같은 경우가 5%뿐이라 걸어간 길만으로는 선이 거의 안 생긴다.
 */
const TODAY = '2026-08-06'

async function node(question: string) {
  return insertNode({
    identityScope: 'generic',
    normalizedQuestion: question,
    body: `${question} 해설`,
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })
}

async function walk(from: string, to: string) {
  const db = await getDb()
  await db.query('insert into qedge (parent_id, child_id) values ($1, $2)', [from, to])
}

describe('loadMapData 선', () => {
  beforeEach(truncateAll)

  it('carries both walked paths and judged relations', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    const c = await node('UDP는 언제 쓰는가?')

    await walk(a, b)
    await saveRelations([{ fromId: a, toId: c, kind: 'alternative', source: 'llm', reason: '', votes: 3 }])

    const { edges } = await loadMapData(TODAY)
    expect(edges).toHaveLength(2)
    expect(edges.find((e) => e.childId === b)?.kind).toBe('walked')
    expect(edges.find((e) => e.childId === c)?.kind).toBe('related')
  })

  /*
   * 표를 적게 받은 관계는 안 그린다. 회차마다 흔들리는 것을 봤으므로 과반은
   * 최소 조건이고, 지도에 그릴 것은 그보다 확실해야 한다.
   */
  it('leaves out relations with a single vote', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    await saveRelations([{ fromId: a, toId: b, kind: 'shares_concept', source: 'llm', reason: '', votes: 1 }])

    expect((await loadMapData(TODAY)).edges).toHaveLength(0)
  })

  /* 사람이 지나간 것이 판정보다 확실하다. 같은 쌍이면 그쪽을 남긴다 */
  it('prefers the walked path when both exist', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    await walk(a, b)
    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '', votes: 3 }])

    const { edges } = await loadMapData(TODAY)
    expect(edges).toHaveLength(1)
    expect(edges[0].kind).toBe('walked')
  })

  /* 내린 선은 안 그린다 */
  it('skips deactivated relations', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    await saveRelations([{ fromId: a, toId: b, kind: 'shares_concept', source: 'llm', reason: '', votes: 3 }])
    const db = await getDb()
    await db.query('update semantic_relation set active = false')

    expect((await loadMapData(TODAY)).edges).toHaveLength(0)
  })

  /*
   * 지도에 없는 노드로 뻗는 선은 안 그린다. 사용자가 판 질문(on_demand)이
   * 여기 해당한다 — 목록에는 없는데 관계는 있을 수 있다.
   */
  it('drops relations that reach a node not on the map', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const hidden = await insertNode({
      identityScope: 'generic',
      normalizedQuestion: '사용자가 판 질문은?',
      body: '해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await saveRelations([{ fromId: a, toId: hidden, kind: 'shares_concept', source: 'llm', reason: '', votes: 3 }])

    expect((await loadMapData(TODAY)).edges).toHaveLength(0)
  })
})
