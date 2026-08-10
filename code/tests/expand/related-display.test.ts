import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { insertNode, relatedForDisplay } from '@/lib/expand/nodes'
import { saveRelations, MIN_RELATION_VOTES } from '@/lib/db/relations'
import { axis } from '../helpers/axis'

/**
 * **화면에 내보내는 관련 질문.**
 *
 * 게이트 후보(`collectCandidates`)와 목적이 다르다. 후보는 판정기에게
 * "같은 질문인가"를 물으려고 모으는 것이라 id와 질문만 있으면 되고, 넉넉히
 * 담을수록 좋다. 이쪽은 사람이 읽고 누르는 목록이라 주소(번호)·분류·왜
 * 이어졌는지가 필요하고, 다섯 개를 넘으면 아무도 안 읽는다.
 *
 * 그래서 함수를 따로 둔다. 후보 쪽을 화면용으로 늘리면 확장 핫패스가
 * 화면 사정 때문에 무거워진다.
 *
 * 문턱은 `MIN_RELATION_VOTES`를 그대로 쓴다. 지도(`db/graph.ts`)가 선을
 * 그리는 기준과 갈리면 **화면에 안 보이는 관계로 질문을 추천하게 된다.**
 *
 * `truncateAll` 대신 `resetDb`를 쓴다. 벡터 연산이 실린 인스턴스가 필요하고
 * 이 파일은 스키마 자체에 기댄다 — `candidates-embedding.test.ts`와 같은 이유다.
 */
beforeEach(resetDb)

async function mk(
  question: string,
  opts: { category?: string; vec?: number[] } = {},
): Promise<string> {
  const id = await insertNode({
    identityScope: 'generic',
    normalizedQuestion: question,
    body: '본문',
    primaryCategory: opts.category ?? '네트워크',
    status: 'ready',
    origin: 'batch',
  })
  if (opts.vec) {
    const db = await getDb()
    await db.query(`update qnode set embedding = $2::real[] where id = $1`, [id, opts.vec])
  }
  return id
}

const rel = (fromId: string, toId: string, votes: number, reason = '같은 밑바탕을 다룬다') =>
  saveRelations([{ fromId, toId, kind: 'shares_concept', source: 'llm', reason, votes }])

describe('관계로 고른 관련 질문', () => {
  it('왜 이어졌는지를 함께 준다', async () => {
    const focus = await mk('GC 멈춤은 왜 생기는가?')
    const other = await mk('STW는 왜 필요한가?', { category: '운영체제' })
    await rel(focus, other, 2, 'GC를 이해하려면 STW를 먼저 안다')

    const got = await relatedForDisplay(focus)
    expect(got).toHaveLength(1)
    expect(got[0].question).toBe('STW는 왜 필요한가?')
    expect(got[0].category).toBe('운영체제')
    expect(got[0].reason).toBe('GC를 이해하려면 STW를 먼저 안다')
    expect(got[0].number).toBeGreaterThan(0)
  })

  /** 방향 없는 관계도 행은 하나만 둔다(`0009` 주석). 한쪽만 보면 절반을 놓친다 */
  it('반대 방향으로 저장된 관계도 잡는다', async () => {
    const focus = await mk('초점?')
    const other = await mk('상대?')
    await rel(other, focus, 2)

    expect((await relatedForDisplay(focus)).map((r) => r.question)).toEqual(['상대?'])
  })

  /**
   * 지도가 `votes >= MIN_RELATION_VOTES`만 그린다. 이 목록이 더 헐거우면
   * **화면에 선이 없는 관계를 근거로 다음 질문을 권하게 된다.** 왜 권했는지
   * 확인할 길이 사용자에게 없다.
   */
  it('표가 문턱에 못 미치는 관계는 빼놓는다', async () => {
    const focus = await mk('초점?')
    const weak = await mk('표 모자란 것?')
    await rel(focus, weak, MIN_RELATION_VOTES - 1)

    expect(await relatedForDisplay(focus)).toEqual([])
  })

  it('내린 관계는 빼놓는다', async () => {
    const focus = await mk('초점?')
    const dropped = await mk('내려진 것?')
    await rel(focus, dropped, 2)

    const db = await getDb()
    await db.query(`update semantic_relation set active = false`)

    expect(await relatedForDisplay(focus)).toEqual([])
  })

  it('표를 많이 받은 것부터 준다', async () => {
    const focus = await mk('초점?')
    const weak = await mk('둘?')
    const strong = await mk('셋?')
    await rel(focus, weak, 2)
    await rel(focus, strong, 3)

    expect((await relatedForDisplay(focus)).map((r) => r.question)).toEqual(['셋?', '둘?'])
  })

  /**
   * 목록의 링크는 `/q/{번호}`로 간다. 번호가 없는 행을 실으면 `/q/null`이다.
   * 번호는 `0011` 이후 시드 경로에서 나중에 붙으므로 잠깐 비어 있는 창이 있다.
   */
  it('주소가 될 번호가 없는 노드는 빼놓는다', async () => {
    const focus = await mk('초점?')
    const numberless = await mk('번호 없는 것?')
    await rel(focus, numberless, 2)

    const db = await getDb()
    await db.query(`update qnode set number = null where id = $1`, [numberless])

    expect(await relatedForDisplay(focus)).toEqual([])
  })

  /**
   * `reason`은 `not null default ''`다(`0009`). 근거 없이 저장된 관계가
   * 화면에 빈 줄을 남기면 안 된다.
   */
  it('이유가 비어 있으면 없는 것으로 친다', async () => {
    const focus = await mk('초점?')
    const other = await mk('상대?')
    await rel(focus, other, 2, '   ')

    expect((await relatedForDisplay(focus))[0].reason).toBeNull()
  })

  it('아직 안 만들어진 노드는 빼놓는다', async () => {
    const focus = await mk('초점?')
    const pending = await mk('생성 중?')
    await rel(focus, pending, 2)

    const db = await getDb()
    await db.query(`update qnode set status = 'pending' where id = $1`, [pending])

    expect(await relatedForDisplay(focus)).toEqual([])
  })
})

describe('벡터로 채우는 자리', () => {
  /**
   * 관계는 판정을 돌린 만큼만 생긴다. 판정이 안 닿은 노드에서 목록이 통째로
   * 비지 않게 벡터가 뒤를 받친다. 대신 **왜 이어졌는지는 못 적는다** — 아무
   * 판정도 안 거친 이웃이라 근거로 내세울 문장이 없다.
   */
  it('관계가 없으면 벡터 이웃으로 채우고 이유는 비운다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    await mk('가까운 것?', { vec: axis(3) })

    const got = await relatedForDisplay(focus)
    expect(got.map((r) => r.question)).toEqual(['가까운 것?'])
    expect(got[0].reason).toBeNull()
  })

  /** 관계가 먼저다. 판정을 거친 쪽이 아무 판정도 안 거친 쪽보다 믿을 만하다 */
  it('관계 뒤에 온다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    const related = await mk('관계?', { vec: axis(30) })
    await mk('벡터만?', { vec: axis(3) })
    await rel(focus, related, 2)

    expect((await relatedForDisplay(focus)).map((r) => r.question)).toEqual(['관계?', '벡터만?'])
  })

  it('관계와 벡터 양쪽에 걸린 노드를 두 번 내지 않는다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    const both = await mk('둘 다?', { vec: axis(3) })
    await rel(focus, both, 2)

    expect(await relatedForDisplay(focus)).toHaveLength(1)
  })

  it('문턱보다 먼 것은 데려오지 않는다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    await mk('먼 것?', { vec: axis(80) })

    expect(await relatedForDisplay(focus)).toEqual([])
  })
})

describe('목록의 크기', () => {
  it('기본은 다섯 개다', async () => {
    const focus = await mk('초점?')
    for (let i = 0; i < 9; i += 1) await rel(focus, await mk(`관계 ${i}?`), 2)

    expect(await relatedForDisplay(focus)).toHaveLength(5)
  })

  it('원하는 만큼만 준다', async () => {
    const focus = await mk('초점?')
    for (let i = 0; i < 9; i += 1) await rel(focus, await mk(`관계 ${i}?`), 2)

    expect(await relatedForDisplay(focus, 3)).toHaveLength(3)
  })
})

/**
 * **목록이 없는 것과 화면이 죽는 것은 다르다.**
 *
 * 관련 질문은 덤이다. 마이그레이션을 프로덕션에 안 올린 채 배포한 날
 * 화면 전부가 500이 됐던 것과 같은 자리를 다시 밟지 않는다.
 */
describe('밑이 빠졌을 때', () => {
  it('관계 표가 없어도 던지지 않고 벡터만 준다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    await mk('가까운 것?', { vec: axis(3) })

    const db = await getDb()
    await db.query(`drop table semantic_relation cascade`)

    expect((await relatedForDisplay(focus)).map((r) => r.question)).toEqual(['가까운 것?'])
  })

  /**
   * 임베딩 모델을 갈아탈 때 코드(새 차원)와 DB(옛 벡터)가 잠깐 어긋난다.
   * 그 창에서도 관계로 고른 목록은 살아 있어야 한다.
   */
  it('벡터 차원이 어긋나도 던지지 않고 관계만 준다', async () => {
    const focus = await mk('초점?', { vec: axis(0) })
    const related = await mk('관계?')
    await rel(focus, related, 2)

    const db = await getDb()
    await db.query(`update qnode set embedding = '{1,0}'::real[] where id = $1`, [focus])

    expect((await relatedForDisplay(focus)).map((r) => r.question)).toEqual(['관계?'])
  })

  it('둘 다 없으면 빈 목록이다', async () => {
    const focus = await mk('외톨이?')
    expect(await relatedForDisplay(focus)).toEqual([])
  })
})
