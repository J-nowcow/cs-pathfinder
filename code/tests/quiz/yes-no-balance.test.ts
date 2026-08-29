import { describe, it, expect } from 'vitest'
import { NODE_QUIZZES } from '../../data/quiz'

/**
 * 그렇다/아니다로 묻는 문항의 답이 한쪽으로 쏠리면 안 된다.
 *
 * 처음 쓴 1,011문제에서는 이 형식이 180개였는데 **179개의 답이 "아니다"**
 * 였다. 그렇다가 답인 문항은 하나도 없었다. 내용을 전혀 몰라도 아니다만
 * 고르면 99.4%다.
 *
 * 오개념 문항이 "이 오해가 맞는가?"를 묻기 때문에 자연히 그렇게 된다.
 * 질문을 뒤집으면 같은 것을 물으면서 답이 그렇다가 된다 —
 * "HttpOnly면 XSS 피해가 사라지는가?"를 "HttpOnly를 걸어도 요청을 대신
 * 보낼 수 있는가?"로.
 */
const items = NODE_QUIZZES.flatMap((node) => node.items).filter((item) => {
  const texts = item.choices.map((c) => c.text)
  return texts.some((t) => t.startsWith('그렇다')) && texts.some((t) => t.startsWith('아니다'))
})

describe('그렇다/아니다 균형', () => {
  it('답이 한쪽에 85%를 넘게 쏠리지 않는다', () => {
    const no = items.filter((i) => i.choices.find((c) => c.correct)?.text.startsWith('아니다'))
    expect(no.length / items.length).toBeLessThan(0.85)
  })

  it('그렇다가 답인 문항이 충분히 있다', () => {
    const yes = items.filter((i) => i.choices.find((c) => c.correct)?.text.startsWith('그렇다'))
    expect(yes.length / items.length).toBeGreaterThan(0.15)
  })
})
