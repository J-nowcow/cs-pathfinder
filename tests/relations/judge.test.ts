import { describe, it, expect } from 'vitest'
import { judgeRelations, buildJudgePrompt, RELATION_JUDGE_VERSION } from '@/lib/relations/judge'
import type { StructuredCaller } from '@/lib/llm/client'

/**
 * 관계 판정.
 *
 * 게이트와 다른 물건이다. 게이트는 "이 둘이 **같은** 질문인가"를 묻고 틀리면
 * 두 질문이 하나로 합쳐진다. 이쪽은 "**관련 있는가**"를 묻고 틀려도 선 하나가
 * 잘못 그려질 뿐이다.
 *
 * 대신 흔들린다. 같은 조건으로 세 번 재보니 5/2/4로 나왔다. 그래서 판정을 여러 번
 * 뽑아 다수결을 낸다. 한 번 뽑아 그대로 쓰면 지도가 새로고침할 때마다 달라진다.
 */

/** 회차마다 다른 답을 주는 판정기. 흔들림을 흉내 낸다 */
function caller(rounds: Array<Array<{ id: string; kind: string; reason: string }>>): StructuredCaller {
  let i = 0
  return (async () => {
    const relations = rounds[Math.min(i, rounds.length - 1)]
    i += 1
    return { relations }
  }) as StructuredCaller
}

const FOCUS = { id: 'f1', question: 'TCP는 무엇을 보장하는가?', category: '네트워크' }
const CANDIDATES = [
  { id: 'c1', question: '3-way handshake는 왜 세 번인가?', category: '네트워크' },
  { id: 'c2', question: '인덱스는 언제 안 타는가?', category: '데이터베이스' },
]

describe('judgeRelations', () => {
  it('keeps a relation that most rounds agree on', async () => {
    const call = caller([
      [{ id: 'c1', kind: 'prerequisite', reason: '연결 수립 절차다' }],
      [{ id: 'c1', kind: 'prerequisite', reason: '연결 수립 절차다' }],
      [],
    ])

    const out = await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })

    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ toId: 'c1', kind: 'prerequisite', votes: 2 })
  })

  /* 한 번만 나온 것은 버린다. 흔들림을 그대로 받아쓰지 않겠다는 뜻이다 */
  it('drops a relation only one round saw', async () => {
    const call = caller([
      [{ id: 'c2', kind: 'shares_concept', reason: '둘 다 성능 이야기다' }],
      [],
      [],
    ])

    expect(await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })).toHaveLength(0)
  })

  /*
   * 종류가 갈리면 표를 많이 받은 쪽으로 정한다. 같은 두 질문을 두고 한 회차는
   * 선행 지식이라 하고 다른 회차는 같은 개념이라 하는 일이 실제로 생긴다.
   */
  it('settles on the kind that won more rounds', async () => {
    const call = caller([
      [{ id: 'c1', kind: 'prerequisite', reason: 'a' }],
      [{ id: 'c1', kind: 'shares_concept', reason: 'b' }],
      [{ id: 'c1', kind: 'prerequisite', reason: 'c' }],
    ])

    const [rel] = await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })
    expect(rel.kind).toBe('prerequisite')
    expect(rel.votes).toBe(2)
  })

  /* 후보에 없는 id를 지어내면 버린다. 없는 노드로 뻗는 선이 된다 */
  it('drops ids that are not candidates', async () => {
    const call = caller([
      [{ id: 'nope', kind: 'shares_concept', reason: '' }],
      [{ id: 'nope', kind: 'shares_concept', reason: '' }],
      [{ id: 'nope', kind: 'shares_concept', reason: '' }],
    ])

    expect(await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })).toHaveLength(0)
  })

  /* 모르는 종류도 버린다. 스키마에 없는 값은 저장에서 터진다 */
  it('drops unknown kinds', async () => {
    const call = caller([
      [{ id: 'c1', kind: '비슷함', reason: '' }],
      [{ id: 'c1', kind: '비슷함', reason: '' }],
    ])

    expect(await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 2 })).toHaveLength(0)
  })

  /* 자기 자신은 후보에서 빠진다. 넣으면 판정이 늘 자기를 고른다 */
  it('never asks about the focus question itself', async () => {
    let asked: string | null = null
    const call = (async (args: { prompt: string }) => {
      asked = args.prompt
      return { relations: [] }
    }) as unknown as StructuredCaller

    await judgeRelations(FOCUS, [...CANDIDATES, FOCUS], { call, rounds: 1 })
    expect(asked!).not.toContain('f1')
  })

  /* 후보가 없으면 부르지 않는다. 빈 목록에 대고 물어봐야 답이 없다 */
  it('does not call when there are no candidates', async () => {
    let calls = 0
    const call = (async () => {
      calls += 1
      return { relations: [] }
    }) as unknown as StructuredCaller

    expect(await judgeRelations(FOCUS, [], { call, rounds: 3 })).toHaveLength(0)
    expect(calls).toBe(0)
  })

  /*
   * 전부 터지면 알린다. 빈 목록으로 돌려주면 "관계가 없다"와 구별되지 않는다.
   * 실제로 환경변수를 안 읽어 전부 터진 것을 "관계 0개"로 읽은 적이 있다.
   */
  it('throws when every round fails', async () => {
    const call = (async () => {
      throw new Error('quota')
    }) as unknown as StructuredCaller

    await expect(judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })).rejects.toThrow(/실패/)
  })

  /*
   * 한 회차가 터져도 남은 회차로 판정한다. 무료 한도가 마르면 실제로 터진다.
   * 다만 성립한 회차만 표의 분모가 된다.
   */
  it('survives a failed round', async () => {
    let i = 0
    const call = (async () => {
      i += 1
      if (i === 2) throw new Error('quota')
      return { relations: [{ id: 'c1', kind: 'prerequisite', reason: 'x' }] }
    }) as unknown as StructuredCaller

    const out = await judgeRelations(FOCUS, CANDIDATES, { call, rounds: 3 })
    expect(out).toHaveLength(1)
    expect(out[0].votes).toBe(2)
  })
})

describe('buildJudgePrompt', () => {
  it('lists candidates with their id and category', () => {
    const p = buildJudgePrompt(FOCUS, CANDIDATES)
    expect(p).toContain('c1')
    expect(p).toContain('3-way handshake는 왜 세 번인가?')
    expect(p).toContain('데이터베이스')
  })

  /*
   * 근거를 반드시 적게 한다. 근거를 못 적는 관계는 만들지 않겠다는 뜻이고,
   * 사람이 검수할 때 읽을 것도 그것뿐이다.
   */
  it('demands a reason for every relation', () => {
    expect(buildJudgePrompt(FOCUS, CANDIDATES)).toContain('근거')
  })

  /* 없으면 없다고 하게 둔다. 억지로 채우면 지도가 아무 데나 이어진다 */
  it('allows an empty answer', () => {
    expect(buildJudgePrompt(FOCUS, CANDIDATES)).toMatch(/없으면|빈/)
  })
})

describe('RELATION_JUDGE_VERSION', () => {
  it('is recorded so a judgment can be traced to its prompt', () => {
    expect(RELATION_JUDGE_VERSION).toMatch(/^relation-v\d/)
  })
})
