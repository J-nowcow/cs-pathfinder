import type { ResolvedTrackQuestion } from '@/lib/learning/tracks'

export type LearningReviewStatus = 'needs-review' | 'understood'

export type LearningReviewCandidate = {
  questionId: string
  question: string
  status: LearningReviewStatus
  nextReviewOn: string
}

export type DailyLearningItem = {
  kind: 'review' | 'new'
  questionId: string
  question: string
  reason: string
  completedAt?: string
}

export type DailySessionSnapshot = {
  date: string
  trackId: string
  createdAt: string
  items: DailyLearningItem[]
}

export type DailyLearningSelection = {
  today: string
  trackQuestions: readonly ResolvedTrackQuestion[]
  reviews: readonly LearningReviewCandidate[]
  completedQuestionIds: Iterable<string>
  maxItems?: number
}

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/

/** 기한이 된 복습을 먼저 채우고, 남는 자리에 트랙의 새 질문을 넣는다. */
export function selectDailyLearningSession({
  today,
  trackQuestions,
  reviews,
  completedQuestionIds,
  maxItems = 3,
}: DailyLearningSelection): DailyLearningItem[] {
  if (!DATE_SHAPE.test(today)) throw new Error('오늘 날짜는 YYYY-MM-DD 형식이어야 합니다.')
  const limit = Number.isFinite(maxItems) ? Math.max(0, Math.floor(maxItems)) : 3
  if (limit === 0) return []

  const selected = new Set<string>()
  const completed = new Set(completedQuestionIds)
  const items: DailyLearningItem[] = []
  const dueReviews = reviews
    .filter((review) => review.questionId && DATE_SHAPE.test(review.nextReviewOn) && review.nextReviewOn <= today)
    .sort((a, b) =>
      a.nextReviewOn.localeCompare(b.nextReviewOn)
      || Number(b.status === 'needs-review') - Number(a.status === 'needs-review')
      || a.questionId.localeCompare(b.questionId),
    )

  for (const review of dueReviews) {
    if (selected.has(review.questionId)) continue
    selected.add(review.questionId)
    items.push({
      kind: 'review',
      questionId: review.questionId,
      question: review.question,
      reason: review.status === 'needs-review'
        ? '다시 볼래요로 표시한 복습'
        : '복습할 날짜가 되었어요',
    })
    if (items.length === limit) return items
  }

  for (const question of trackQuestions) {
    if (selected.has(question.id) || completed.has(question.id)) continue
    selected.add(question.id)
    items.push({
      kind: 'new',
      questionId: question.id,
      question: question.question,
      reason: '선택한 트랙에서 이어서 볼 질문',
    })
    if (items.length === limit) break
  }

  return items
}

/** 같은 날짜와 트랙의 스냅샷은 학습 상태가 바뀌어도 그대로 돌려준다. */
export function getOrCreateDailySession(
  selection: DailyLearningSelection & { trackId: string; createdAt: string },
  existing?: DailySessionSnapshot | null,
): DailySessionSnapshot {
  if (existing?.date === selection.today && existing.trackId === selection.trackId) return existing
  return {
    date: selection.today,
    trackId: selection.trackId,
    createdAt: selection.createdAt,
    items: selectDailyLearningSession(selection),
  }
}
