import { describe, expect, it } from 'vitest'
import { correctIndex, findQuiz, gradeQuiz, rankSuggestions } from '@/lib/quiz'
import { NODE_QUIZZES, type QuizItem } from '../../data/quiz'

const items: QuizItem[] = [
  {
    kind: 'concept',
    stem: '문제0',
    choices: [{ text: '정답', correct: true }, { text: '오답', leadsTo: 2 }],
    rationale: '근거',
  },
  {
    kind: 'misconception',
    stem: '문제1',
    choices: [{ text: '오답', leadsTo: 4 }, { text: '정답', correct: true }],
    rationale: '근거',
  },
  {
    kind: 'boundary',
    stem: '문제2',
    choices: [{ text: '정답', correct: true }, { text: '오답', leadsTo: 2 }],
    rationale: '근거',
  },
]

const suggestions = ['s0', 's1', 's2', 's3', 's4']

describe('진단 채점', () => {
  it('안 푼 문제는 null로 두고 푼 것만 센다', () => {
    const grade = gradeQuiz(items, [0, -1, -1])
    expect(grade.results).toEqual([true, null, null])
    expect(grade.answeredCount).toBe(1)
    expect(grade.correctCount).toBe(1)
  })

  it('틀린 문제가 겨냥한 꼬리질문을 순서대로 모은다', () => {
    const grade = gradeQuiz(items, [1, 0, 1])
    expect(grade.results).toEqual([false, false, false])
    expect(grade.leadsTo).toEqual([2, 4])
  })

  it('맞힌 문제는 아무 데도 보내지 않는다', () => {
    expect(gradeQuiz(items, [0, 1, 0]).leadsTo).toEqual([])
  })

  it('범위를 벗어난 선택은 안 푼 것으로 본다', () => {
    const grade = gradeQuiz(items, [99, -1, -1])
    expect(grade.results[0]).toBeNull()
    expect(grade.answeredCount).toBe(0)
  })

  it('정답 위치를 찾는다', () => {
    expect(correctIndex(items[0])).toBe(0)
    expect(correctIndex(items[1])).toBe(1)
  })
})

describe('꼬리질문 재정렬', () => {
  it('겨냥된 것을 앞으로 올리되 빼지도 더하지도 않는다', () => {
    const ranked = rankSuggestions(suggestions, [2, 4])
    expect(ranked).toEqual(['s2', 's4', 's0', 's1', 's3'])
    expect(ranked).toHaveLength(suggestions.length)
  })

  it('틀린 것이 없으면 원래 순서 그대로다', () => {
    expect(rankSuggestions(suggestions, [])).toBe(suggestions)
  })

  it('범위를 벗어난 인덱스는 무시한다', () => {
    expect(rankSuggestions(suggestions, [9, -1])).toBe(suggestions)
    expect(rankSuggestions(suggestions, [9, 1])).toEqual(['s1', 's0', 's2', 's3', 's4'])
  })
})

describe('노드에 붙은 문제 찾기', () => {
  it('자연키로 찾는다', () => {
    const first = NODE_QUIZZES[0]
    expect(findQuiz(first.identityScope, first.question)).toBe(first)
  })

  it('없는 노드는 null이다 — 화면은 지금과 똑같이 동작한다', () => {
    expect(findQuiz('generic', '존재하지 않는 질문은?')).toBeNull()
  })
})

describe('커밋된 문제 데이터', () => {
  it('모든 문제에 정답이 정확히 하나다', () => {
    for (const quiz of NODE_QUIZZES) {
      for (const item of quiz.items) {
        expect(item.choices.filter((c) => c.correct === true)).toHaveLength(1)
      }
    }
  })

  it('오답은 전부 갈 곳을 들고 있고 정답은 들지 않는다', () => {
    for (const quiz of NODE_QUIZZES) {
      for (const item of quiz.items) {
        for (const choice of item.choices) {
          if (choice.correct === true) expect(choice.leadsTo).toBeUndefined()
          else expect(typeof choice.leadsTo).toBe('number')
        }
      }
    }
  })

  it('한 노드에 세 종류를 다 낸다', () => {
    for (const quiz of NODE_QUIZZES) {
      expect(new Set(quiz.items.map((i) => i.kind)).size).toBe(3)
    }
  })
})
