import { describe, it, expect } from 'vitest'
import { NODE_QUIZZES } from '../../data/quiz'

/**
 * 정답이 몇 번째 자리에 오는가.
 *
 * 손으로 쓰면 정답을 맨 위에 적게 된다. 실제로 처음 쓴 1,011문제는
 * **94.6%가 1번**이었다. 그러면 읽지 않고 1번만 찍어도 대부분 맞는다.
 *
 * 그 순간 이 기능의 뜻이 사라진다. 여기서 재려는 것은 무엇을 아는지이고,
 * 그 답으로 다음에 볼 꼬리질문을 고른다. 찍어서 맞힌 답은 아무것도
 * 가리키지 못한다.
 *
 * 완전히 고르게 만들 필요는 없다. 한 자리가 지배하지만 않으면 된다.
 */
const positions = NODE_QUIZZES.flatMap((node) =>
  node.items.map((item) => item.choices.findIndex((c) => c.correct)),
)

describe('정답 위치', () => {
  it('한 자리가 40%를 넘지 않는다', () => {
    const counts = new Map<number, number>()
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1)
    const worst = Math.max(...counts.values()) / positions.length
    expect(worst).toBeLessThan(0.4)
  })

  it('네 자리가 모두 10% 이상 쓰인다', () => {
    const counts = new Map<number, number>()
    for (const p of positions) counts.set(p, (counts.get(p) ?? 0) + 1)
    for (let i = 0; i < 4; i++) {
      expect((counts.get(i) ?? 0) / positions.length).toBeGreaterThan(0.1)
    }
  })
})
