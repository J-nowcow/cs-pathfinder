/**
 * 진단 결과를 꼬리질문 순서로 옮기는 자리.
 *
 * 이 저장소가 커리큘럼형 서비스와 갈리는 지점이다. 커리큘럼이 고정된 곳은
 * 약점을 알아도 다음 화면이 안 바뀐다. 여기서는 **약점이 곧 다음 경로**다.
 *
 * 다만 새 질문을 만들지 않는다 — 이미 있는 `suggestions` 5개의 순서만
 * 바꾼다. 콘텐츠가 늘지 않고 정밀도만 오른다.
 *
 * 설계: `docs/design/2026-08-29-quiz.md`
 */
import { NODE_QUIZZES, type NodeQuiz, type QuizItem } from '../../../data/quiz'
import { normalizeText } from '@/lib/expand/hash'

/** 노드 하나의 채점 결과 */
export type QuizGrade = {
  /** 문제별 정오. 아직 안 푼 문제는 null */
  results: (boolean | null)[]
  /** 맞힌 개수 */
  correctCount: number
  /** 푼 문제 수 */
  answeredCount: number
  /**
   * 틀린 문제가 겨냥한 `suggestions` 인덱스. 앞선 문제의 것이 먼저 온다.
   * 같은 인덱스가 여러 번 나오면 한 번만 남는다.
   */
  leadsTo: number[]
}

const byKey = new Map<string, NodeQuiz>()
for (const quiz of NODE_QUIZZES) {
  byKey.set(quizKey(quiz.identityScope, quiz.question), quiz)
}

function quizKey(identityScope: string, question: string): string {
  return `${normalizeText(identityScope)}\n${normalizeText(question)}`
}

/**
 * 노드에 붙은 문제를 찾는다.
 *
 * 자연키로 참조한다. `bootstrap.ts`의 `rootNodeId()`가 uuid를 파생하는 바로
 * 그 키라서, 문제 쪽이 uuid를 직접 들 때 생기는 조용한 단절이 없다.
 *
 * 없으면 null이다. 328편 중 문제가 붙은 것은 아직 일부이고, 없으면 화면은
 * 지금과 똑같이 동작한다.
 */
export function findQuiz(identityScope: string, question: string): NodeQuiz | null {
  return byKey.get(quizKey(identityScope, question)) ?? null
}

export function correctIndex(item: QuizItem): number {
  return item.choices.findIndex((c) => c.correct === true)
}

/**
 * 고른 답으로 채점한다.
 *
 * `chosen[i] < 0`은 아직 안 푼 문제다. 부분적으로 푼 상태에서도 지금까지의
 * 결과를 읽을 수 있어야 한다 — 세 문제를 다 풀어야 뭔가 보이는 화면은
 * 중간에 나가는 사람에게 아무것도 주지 않는다.
 */
export function gradeQuiz(items: QuizItem[], chosen: number[]): QuizGrade {
  const results: (boolean | null)[] = []
  const leadsTo: number[] = []
  let correctCount = 0
  let answeredCount = 0

  for (const [index, item] of items.entries()) {
    const pick = chosen[index] ?? -1
    if (pick < 0 || pick >= item.choices.length) {
      results.push(null)
      continue
    }

    answeredCount += 1
    const isCorrect = item.choices[pick].correct === true
    results.push(isCorrect)

    if (isCorrect) {
      correctCount += 1
      continue
    }

    const target = item.choices[pick].leadsTo
    if (typeof target === 'number' && !leadsTo.includes(target)) leadsTo.push(target)
  }

  return { results, correctCount, answeredCount, leadsTo }
}

/**
 * 틀린 지점이 겨냥한 꼬리질문을 앞으로 끌어올린다.
 *
 * **순서만 바꾼다.** 빼지도 더하지도 않는다 — 진단이 추천을 좁히면 사용자가
 * 원래 보던 선택지가 사라진다. 다섯 개는 그대로 있고 읽는 순서만 달라진다.
 *
 * 범위를 벗어난 인덱스는 무시한다. `verify:quiz`가 미리 걸러내지만, 데이터가
 * 먼저 배포되고 검증이 나중에 도는 순간이 있을 수 있다.
 */
export function rankSuggestions<T>(suggestions: T[], leadsTo: number[]): T[] {
  const lifted = leadsTo.filter((i) => Number.isInteger(i) && i >= 0 && i < suggestions.length)
  if (!lifted.length) return suggestions

  const seen = new Set(lifted)
  return [...lifted.map((i) => suggestions[i]), ...suggestions.filter((_, i) => !seen.has(i))]
}
