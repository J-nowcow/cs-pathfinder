import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { insertNode, ensureEdge, collectCandidates } from '@/lib/expand/nodes'
import { saveRelations } from '@/lib/db/relations'
import { EMBED_DIM, EMBED_TOP_K, EMBED_MIN_SIMILARITY } from '@/lib/embed/model'

/**
 * **벡터로도 후보가 나온다.**
 *
 * 간선도 관계도 없는 노드가 남는다. 의미 관계를 후보에 넣은 뒤에도 운영
 * 노드 321개 중 110개(34.3%)가 후보 0개였다. 관계는 판정을 돌린 만큼만
 * 생기고, 아직 330행뿐이다.
 *
 * 벡터는 **판정 없이** 이웃을 준다. 임베딩만 담겨 있으면 된다.
 *
 * `truncateAll` 대신 `resetDb`를 쓴다. 확장이 실린 새 인스턴스가 필요하고,
 * 이 파일은 스키마 자체(벡터 연산)에 기대기 때문이다.
 */
beforeEach(resetDb)

/** 축 하나만 세운 벡터. 각도를 손으로 정하려고 이렇게 만든다 */
function axis(deg: number): number[] {
  const rad = (deg * Math.PI) / 180
  const v = new Array(EMBED_DIM).fill(0)
  v[0] = Math.cos(rad)
  v[1] = Math.sin(rad)
  return v
}

async function mk(q: string, vec?: number[]): Promise<string> {
  const id = await insertNode({
    identityScope: 'generic',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '운영체제',
    status: 'ready',
    origin: 'batch',
  })
  if (vec) {
    const db = await getDb()
    await db.query(`update qnode set embedding = $2::real[] where id = $1`, [id, vec])
  }
  return id
}

describe('벡터 후보', () => {
  /**
   * 이것이 이 층의 존재 이유다. 간선도 관계도 없는데 후보가 나와야 한다.
   */
  it('간선도 관계도 없이 임베딩만으로 후보가 나온다', async () => {
    const focus = await mk('가상 메모리는 무엇을 해결하는가?', axis(0))
    await mk('가상 메모리를 쓰는 이유는?', axis(10))

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['가상 메모리를 쓰는 이유는?'])
  })

  /**
   * 문턱이 없으면 **가장 안 닮은 것도 top-k에 올라온다.** 이웃이 적을 때
   * 그렇게 된다. 실측에서 쌍 유사도 중앙값이 0.430이라 문턱을 안 두면
   * 절반이 후보가 된다.
   */
  it('문턱보다 먼 것은 데려오지 않는다', async () => {
    const focus = await mk('초점?', axis(0))
    /* cos 80° ≈ 0.17. 문턱(0.7)보다 한참 아래다 */
    await mk('먼 것?', axis(80))

    expect(await collectCandidates(focus)).toEqual([])
  })

  it('가까운 순으로 준다', async () => {
    const focus = await mk('초점?', axis(0))
    await mk('먼 쪽?', axis(40))
    await mk('가까운 쪽?', axis(5))

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['가까운 쪽?', '먼 쪽?'])
  })

  /** 임베딩이 없는 노드는 조용히 빠져야 한다. 터지면 안 된다 */
  it('임베딩이 없는 노드가 섞여 있어도 돈다', async () => {
    const focus = await mk('초점?', axis(0))
    await mk('벡터 없음?')
    await mk('벡터 있음?', axis(5))

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['벡터 있음?'])
  })

  /** 초점 자신에게 임베딩이 없으면 이 층은 아무것도 못 한다 */
  it('초점에 임베딩이 없으면 벡터 후보가 없다', async () => {
    const focus = await mk('초점?')
    await mk('상대?', axis(0))

    expect(await collectCandidates(focus)).toEqual([])
  })

  /**
   * **구조 → 의미 → 벡터 순서다.**
   *
   * 사람이 걸어간 길이 가장 믿을 만하고, 판정을 거친 관계가 그다음이고,
   * 벡터는 아무 판정도 안 거친 것이다. 상한에 걸려 잘릴 때 잘리는 쪽이
   * 이 순서여야 한다.
   */
  it('구조와 의미 후보 뒤에 온다', async () => {
    const focus = await mk('초점?', axis(0))
    const child = await mk('자식?', axis(1))
    const related = await mk('관련?', axis(2))
    await mk('벡터만?', axis(3))

    await ensureEdge(focus, child)
    await saveRelations([
      { fromId: focus, toId: related, kind: 'shares_concept', source: 'llm', reason: 'r', votes: 2 },
    ])

    const got = await collectCandidates(focus)
    expect(got.map((c) => c.question)).toEqual(['자식?', '관련?', '벡터만?'])
  })

  /**
   * 벡터는 판정을 안 거친 층이라 상한을 따로 둔다. 안 두면 남은 자리
   * 전부를 벡터가 먹고 프롬프트가 판정 안 된 것으로 채워진다.
   */
  it('벡터 후보에는 자체 상한이 있다', async () => {
    const focus = await mk('초점?', axis(0))
    for (let i = 0; i < EMBED_TOP_K + 6; i += 1) {
      await mk(`이웃 ${i}?`, axis(i * 0.1))
    }

    expect(await collectCandidates(focus)).toHaveLength(EMBED_TOP_K)
  })

  /** 상수가 실제로 쓰이는지. 안 쓰이면 위 시험들이 우연히 통과한 것이다 */
  it('문턱이 0과 1 사이의 유사도다', () => {
    expect(EMBED_MIN_SIMILARITY).toBeGreaterThan(0)
    expect(EMBED_MIN_SIMILARITY).toBeLessThan(1)
  })
})
