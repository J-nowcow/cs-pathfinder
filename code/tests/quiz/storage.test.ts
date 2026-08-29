import { describe, expect, it } from 'vitest'
import {
  MAX_QUIZ_NODES,
  deserializeQuiz,
  emptyQuizState,
  recordChoice,
  serializeQuiz,
  shouldAsk,
  skipQuiz,
} from '@/lib/quiz/storage'

describe('진단 퀴즈 저장', () => {
  it('문제별로 고른 답을 기록하고 안 푼 자리는 -1로 남긴다', () => {
    const state = recordChoice(emptyQuizState(), 'q1', 1, 2, 3, '2026-08-29T00:00:00Z')
    expect(state.attempts.q1.chosen).toEqual([-1, 2, -1])
  })

  it('다시 풀면 덮어쓴다', () => {
    let state = recordChoice(emptyQuizState(), 'q1', 0, 3, 3, '2026-08-29T00:00:00Z')
    state = recordChoice(state, 'q1', 0, 1, 3, '2026-08-29T00:01:00Z')
    expect(state.attempts.q1.chosen[0]).toBe(1)
  })

  it('범위를 벗어난 문제 번호는 무시한다', () => {
    const empty = emptyQuizState()
    expect(recordChoice(empty, 'q1', 5, 0, 3, 'now')).toBe(empty)
    expect(recordChoice(empty, 'q1', -1, 0, 3, 'now')).toBe(empty)
  })

  it('건너뛴 노드는 다시 묻지 않는다', () => {
    const state = skipQuiz(emptyQuizState(), 'q1')
    expect(shouldAsk(state, 'q1', 3)).toBe(false)
    expect(shouldAsk(state, 'q2', 3)).toBe(true)
  })

  it('다 푼 노드는 다시 묻지 않고 덜 푼 노드는 계속 묻는다', () => {
    let state = emptyQuizState()
    state = recordChoice(state, 'q1', 0, 0, 3, 'now')
    expect(shouldAsk(state, 'q1', 3)).toBe(true)

    state = recordChoice(state, 'q1', 1, 0, 3, 'now')
    state = recordChoice(state, 'q1', 2, 0, 3, 'now')
    expect(shouldAsk(state, 'q1', 3)).toBe(false)
  })

  it('문제가 없는 노드는 묻지 않는다', () => {
    expect(shouldAsk(emptyQuizState(), 'q1', 0)).toBe(false)
  })

  it('깨진 저장값은 빈 상태로 복구하고 정상값은 왕복한다', () => {
    expect(deserializeQuiz('{깨짐')).toEqual(emptyQuizState())
    expect(deserializeQuiz(null)).toEqual(emptyQuizState())

    const state = skipQuiz(recordChoice(emptyQuizState(), 'q1', 0, 1, 3, 'now'), 'q2')
    expect(deserializeQuiz(serializeQuiz(state))).toEqual(state)
  })

  it('버전이 다른 저장값은 버린다', () => {
    expect(deserializeQuiz(JSON.stringify({ version: 99, attempts: { q1: {} } }))).toEqual(
      emptyQuizState(),
    )
  })

  it('저장소에 기록이 너무 많아도 최근 상한까지만 읽는다', () => {
    const attempts = Object.fromEntries(
      Array.from({ length: MAX_QUIZ_NODES + 3 }, (_, i) => [
        `q${i}`,
        { chosen: [0], at: String(i).padStart(4, '0') },
      ]),
    )
    const state = deserializeQuiz(JSON.stringify({ version: 1, attempts, skipped: [] }))
    expect(Object.keys(state.attempts)).toHaveLength(MAX_QUIZ_NODES)
  })

  it('망가진 항목은 버리고 성한 것만 살린다', () => {
    const state = deserializeQuiz(
      JSON.stringify({
        version: 1,
        attempts: {
          ok: { chosen: [0, 1], at: 'now' },
          배열아님: { chosen: 'x', at: 'now' },
          시각없음: { chosen: [0] },
        },
        skipped: ['good', 42, 'good'],
      }),
    )
    expect(Object.keys(state.attempts)).toEqual(['ok'])
    expect(state.skipped).toEqual(['good'])
  })
})
