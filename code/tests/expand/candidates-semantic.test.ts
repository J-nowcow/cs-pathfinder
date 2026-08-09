import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode, ensureEdge, collectCandidates, MAX_CANDIDATES } from '@/lib/expand/nodes'
import { saveRelations } from '@/lib/db/relations'

/**
 * **의미 관계도 후보가 된다.**
 *
 * 후보가 `qedge`에서만 나오던 동안 운영 노드 321개 중 **309개(96.3%)가
 * 후보 0개**였다. 게이트 정확도는 튜닝 124/124 · 홀드아웃 60/60인데
 * 일할 기회 자체가 없었다.
 *
 * 원인은 시딩이 간선을 안 만드는 것이다. `qedge`가 12행이다. 그런데
 * `semantic_relation`은 330행 살아 있었고 매칭 경로가 그것을 안 봤다.
 *
 * 이 파일의 시험은 **rank 2를 지우면 깨져야 한다.** 안 깨지면 재는 것이
 * 없는 것이다.
 */
const mk = (q: string) =>
  insertNode({
    identityScope: 'generic',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })

const rel = (fromId: string, toId: string, votes = 2) =>
  saveRelations([
    { fromId, toId, kind: 'shares_concept', source: 'llm', reason: '이유', votes },
  ])

describe('의미 관계 후보', () => {
  beforeEach(truncateAll)

  /**
   * 이것이 이 변경의 전부다. 간선이 하나도 없는 노드에서 후보가 나와야 한다.
   * 운영에서 309개가 이 상태다.
   */
  it('간선이 없어도 관계만으로 후보가 나온다', async () => {
    const focus = await mk('GC 멈춤은 왜 생기는가?')
    const other = await mk('STW는 왜 필요한가?')
    await rel(focus, other)

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['STW는 왜 필요한가?'])
  })

  /**
   * 관계는 방향이 있는 것도 없는 것도 한 행으로 저장된다(`0009` 주석).
   * 한쪽만 보면 절반을 놓친다.
   */
  it('반대 방향으로 저장된 관계도 잡는다', async () => {
    const focus = await mk('초점?')
    const other = await mk('상대?')
    await rel(other, focus)

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['상대?'])
  })

  /**
   * 화면(`db/graph.ts:108`)이 `votes >= 2`만 그린다. 매칭이 더 헐거운 기준을
   * 쓰면 **사용자에게 안 보이는 관계로 질문이 합쳐진다.**
   */
  it('표를 하나만 받은 관계는 후보에 넣지 않는다', async () => {
    const focus = await mk('초점?')
    const weak = await mk('표 하나?')
    await rel(focus, weak, 1)

    expect(await collectCandidates(focus)).toEqual([])
  })

  it('내린 관계는 후보에 넣지 않는다', async () => {
    const { getDb } = await import('@/lib/db/client')
    const focus = await mk('초점?')
    const dropped = await mk('내려진 것?')
    await rel(focus, dropped)

    const db = await getDb()
    await db.query(`update semantic_relation set active = false`)

    expect(await collectCandidates(focus)).toEqual([])
  })

  /**
   * 구조가 의미보다 믿을 만하다. 사람이 실제로 걸어간 길이기 때문이다.
   * 상한에 걸려 잘릴 때 잘리는 쪽은 의미여야 한다.
   */
  it('구조 후보가 의미 후보보다 앞에 온다', async () => {
    const focus = await mk('초점?')
    const child = await mk('자식?')
    const related = await mk('관련?')
    await ensureEdge(focus, child)
    await rel(focus, related)

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['자식?', '관련?'])
  })

  it('의미 후보를 더해도 상한을 넘지 않는다', async () => {
    const focus = await mk('초점?')
    for (let i = 0; i < MAX_CANDIDATES + 5; i += 1) {
      await rel(focus, await mk(`관련 ${i}?`))
    }

    expect(await collectCandidates(focus)).toHaveLength(MAX_CANDIDATES)
  })

  /** 같은 노드가 양쪽으로 잡혀도 한 번만 나와야 한다 */
  it('구조와 의미 양쪽에 걸린 노드를 두 번 내지 않는다', async () => {
    const focus = await mk('초점?')
    const both = await mk('둘 다?')
    await ensureEdge(focus, both)
    await rel(focus, both)

    expect(await collectCandidates(focus)).toHaveLength(1)
  })
})
