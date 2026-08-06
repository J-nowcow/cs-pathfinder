import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { saveRelations, loadRelations, countRelations, deactivateRelation } from '@/lib/db/relations'

/**
 * 의미 관계.
 *
 * `qedge`와 다른 것을 담는다. `qedge`는 "사용자가 A에서 B로 걸어갔다"이고 이쪽은
 * "A와 B는 관련 있다"이다. 꼬리질문이 기존 질문과 **같은** 경우가 5%뿐이라는
 * 실측 때문에 필요해졌다. 같음만으로는 선이 안 생긴다.
 */
async function node(question: string, category = '네트워크') {
  return insertNode({
    identityScope: 'generic',
    normalizedQuestion: question,
    body: `${question} 해설`,
    primaryCategory: category,
    status: 'ready',
    origin: 'batch',
  })
}

describe('saveRelations', () => {
  beforeEach(truncateAll)

  it('saves a relation with its reason', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')

    await saveRelations([
      { fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: 'TCP 연결 수립 절차다', votes: 2 },
    ])

    const rels = await loadRelations()
    expect(rels).toHaveLength(1)
    expect(rels[0]).toMatchObject({
      fromId: a,
      toId: b,
      kind: 'prerequisite',
      reason: 'TCP 연결 수립 절차다',
      votes: 2,
    })
  })

  /*
   * 같은 쌍을 두 번 저장해도 한 줄이어야 한다. 판정을 여러 번 돌릴 것이고,
   * 돌릴 때마다 선이 늘면 지도가 같은 선을 겹쳐 그린다.
   */
  it('keeps one row per pair and kind', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')

    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '첫 판정', votes: 1 }])
    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '두 번째 판정', votes: 3 }])

    expect(await countRelations()).toBe(1)
  })

  /*
   * 다시 저장할 때 표를 더 받았으면 그쪽을 남긴다. 판정을 여러 번 돌리는 이유가
   * 회차마다 결과가 흔들려서인데, 나중 회차가 무조건 이기면 흔들림을 그대로 받는다.
   */
  it('keeps the higher vote count when re-judged', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')

    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '센 판정', votes: 3 }])
    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '약한 판정', votes: 1 }])

    const [rel] = await loadRelations()
    expect(rel.votes).toBe(3)
    expect(rel.reason).toBe('센 판정')
  })

  /*
   * 한 묶음 안에 같은 쌍이 두 번 있어도 터지지 않는다.
   *
   * `on conflict do update`는 같은 문장에서 같은 행을 두 번 건드리면 거부한다.
   * 조각으로 나눠 만든 관계를 합칠 때 실제로 겪었다.
   */
  it('handles duplicates inside one batch', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')

    await saveRelations([
      { fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '약한 쪽', votes: 1 },
      { fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '센 쪽', votes: 3 },
    ])

    const [rel] = await loadRelations()
    expect(rel.votes).toBe(3)
    expect(rel.reason).toBe('센 쪽')
  })

  /* 종류가 다르면 같은 쌍이어도 따로 담는다. 선행 지식이면서 같은 개념일 수 있다 */
  it('allows different kinds on the same pair', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')

    await saveRelations([
      { fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '선행', votes: 1 },
      { fromId: a, toId: b, kind: 'shares_concept', source: 'llm', reason: '같은 개념', votes: 1 },
    ])

    expect(await countRelations()).toBe(2)
  })

  /* 자기 자신으로 가는 선은 담지 않는다. 판정이 헛돌면 나올 수 있다 */
  it('drops self relations', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')

    await saveRelations([{ fromId: a, toId: a, kind: 'shares_concept', source: 'llm', reason: '', votes: 1 }])

    expect(await countRelations()).toBe(0)
  })

  /* 빈 목록으로 부르는 일이 흔하다. 쿼리를 만들지 않는다 */
  it('handles an empty batch', async () => {
    await expect(saveRelations([])).resolves.toBeUndefined()
    expect(await countRelations()).toBe(0)
  })
})

describe('deactivateRelation', () => {
  beforeEach(truncateAll)

  /*
   * 내린 선은 화면에서 사라지되 행은 남는다. 지우면 다음 판정이 같은 선을 다시
   * 만든다. 왜 내렸는지가 남아야 재판정을 막을 수 있다.
   */
  it('hides the relation without deleting it', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '', votes: 1 }])

    const [rel] = await loadRelations()
    await deactivateRelation(rel.id)

    expect(await loadRelations()).toHaveLength(0)
    expect(await countRelations()).toBe(1)
  })
})

describe('loadRelations', () => {
  beforeEach(truncateAll)

  /*
   * 지도에 없는 노드로 뻗는 선은 안 준다. `loadMapData`와 같은 규칙이다.
   * 한 화면에서 보이는 것과 다른 화면에서 보이는 것이 다르면 어느 쪽이 맞는지 모른다.
   */
  it('only returns relations between the given nodes', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    const c = await node('인덱스는 언제 안 타는가?', '데이터베이스')

    await saveRelations([
      { fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '', votes: 1 },
      { fromId: a, toId: c, kind: 'shares_concept', source: 'llm', reason: '', votes: 1 },
    ])

    const rels = await loadRelations({ nodeIds: [a, b] })
    expect(rels).toHaveLength(1)
    expect(rels[0].toId).toBe(b)
  })

  /* 노드 목록이 비면 선도 없다. `any(빈 배열)`이 전부 통과시키는 실수를 막는다 */
  it('returns nothing for an empty node list', async () => {
    const a = await node('TCP는 무엇을 보장하는가?')
    const b = await node('3-way handshake는 왜 세 번인가?')
    await saveRelations([{ fromId: a, toId: b, kind: 'prerequisite', source: 'llm', reason: '', votes: 1 }])

    expect(await loadRelations({ nodeIds: [] })).toHaveLength(0)
  })
})
