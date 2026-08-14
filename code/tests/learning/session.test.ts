import { describe, expect, it } from 'vitest'
import {
  getOrCreateDailySession,
  selectDailyLearningSession,
  type DailySessionSnapshot,
  type LearningReviewCandidate,
} from '@/lib/learning/session'
import type { ResolvedTrackQuestion } from '@/lib/learning/tracks'

const trackQuestions: ResolvedTrackQuestion[] = [
  { id: 'new-1', question: '새 질문 1', position: 1 },
  { id: 'new-2', question: '새 질문 2', position: 2 },
  { id: 'new-3', question: '새 질문 3', position: 3 },
  { id: 'new-4', question: '새 질문 4', position: 4 },
]

function review(
  questionId: string,
  nextReviewOn: string,
  status: LearningReviewCandidate['status'] = 'understood',
): LearningReviewCandidate {
  return { questionId, question: `복습 ${questionId}`, status, nextReviewOn }
}

describe('오늘의 3문제 선택', () => {
  it('기한이 된 복습으로 세 자리를 먼저 채운다', () => {
    const items = selectDailyLearningSession({
      today: '2026-08-14',
      trackQuestions,
      reviews: [review('r3', '2026-08-13'), review('r1', '2026-08-11'), review('r2', '2026-08-12')],
      completedQuestionIds: [],
    })

    expect(items.map((item) => item.questionId)).toEqual(['r1', 'r2', 'r3'])
    expect(items.every((item) => item.kind === 'review')).toBe(true)
  })

  it('같은 복습일이면 다시 볼 답을 먼저 고른다', () => {
    const items = selectDailyLearningSession({
      today: '2026-08-14',
      trackQuestions,
      reviews: [review('understood', '2026-08-14'), review('weak', '2026-08-14', 'needs-review')],
      completedQuestionIds: [],
    })

    expect(items.map((item) => item.questionId)).toEqual(['weak', 'understood', 'new-1'])
    expect(items[0].reason).toContain('다시 볼래요')
  })

  it('미래 복습은 건너뛰고 남은 자리에 완료하지 않은 새 질문을 넣는다', () => {
    const items = selectDailyLearningSession({
      today: '2026-08-14',
      trackQuestions,
      reviews: [review('due', '2026-08-14'), review('future', '2026-08-15')],
      completedQuestionIds: ['new-1'],
    })

    expect(items.map((item) => item.questionId)).toEqual(['due', 'new-2', 'new-3'])
  })

  it('복습과 새 질문이 같은 노드여도 한 번만 보여 준다', () => {
    const items = selectDailyLearningSession({
      today: '2026-08-14',
      trackQuestions,
      reviews: [review('new-1', '2026-08-13')],
      completedQuestionIds: [],
    })

    expect(items.map((item) => item.questionId)).toEqual(['new-1', 'new-2', 'new-3'])
  })

  it('후보가 부족하면 있는 질문만 반환한다', () => {
    expect(selectDailyLearningSession({
      today: '2026-08-14',
      trackQuestions: trackQuestions.slice(0, 1),
      reviews: [],
      completedQuestionIds: ['new-1'],
    })).toEqual([])
  })

  it('날짜 형식을 검사하고 잘못된 개수 제한은 기본값으로 되돌린다', () => {
    expect(() => selectDailyLearningSession({
      today: '8월 14일', trackQuestions, reviews: [], completedQuestionIds: [],
    })).toThrow('오늘 날짜는 YYYY-MM-DD 형식이어야 합니다.')
    expect(selectDailyLearningSession({
      today: '2026-08-14', trackQuestions, reviews: [], completedQuestionIds: [], maxItems: Number.NaN,
    })).toHaveLength(3)
  })

  it('밀린 복습을 모두 처리할 때까지 새 질문을 늘리지 않는다', () => {
    const sixReviews = Array.from({ length: 6 }, (_, index) => review(`r${index}`, '2026-08-01'))
    const first = selectDailyLearningSession({
      today: '2026-08-14', trackQuestions, reviews: sixReviews, completedQuestionIds: [],
    })
    const finished = new Set(first.map((item) => item.questionId))
    const second = selectDailyLearningSession({
      today: '2026-08-15',
      trackQuestions,
      reviews: sixReviews.filter((item) => !finished.has(item.questionId)),
      completedQuestionIds: [],
    })

    expect(first.every((item) => item.kind === 'review')).toBe(true)
    expect(second.every((item) => item.kind === 'review')).toBe(true)
    expect(new Set([...first, ...second].map((item) => item.questionId)).size).toBe(6)
  })
})

describe('오늘 세션 스냅샷', () => {
  const existing: DailySessionSnapshot = {
    date: '2026-08-14',
    trackId: 'backend',
    createdAt: '2026-08-14T00:00:00.000Z',
    items: [{ kind: 'new', questionId: 'kept', question: '유지할 질문', reason: '처음 선택' }],
  }

  it('같은 날짜와 트랙이면 입력 상태가 달라져도 기존 세션을 유지한다', () => {
    expect(getOrCreateDailySession({
      today: '2026-08-14',
      trackId: 'backend',
      createdAt: '2026-08-14T01:00:00.000Z',
      trackQuestions,
      reviews: [review('new-review', '2026-08-14')],
      completedQuestionIds: [],
    }, existing)).toBe(existing)
  })

  it('날짜가 바뀌면 그날 상태로 새 세션을 만든다', () => {
    const next = getOrCreateDailySession({
      today: '2026-08-15',
      trackId: 'backend',
      createdAt: '2026-08-14T15:00:00.000Z',
      trackQuestions,
      reviews: [review('due', '2026-08-15')],
      completedQuestionIds: [],
    }, existing)

    expect(next.date).toBe('2026-08-15')
    expect(next.items.map((item) => item.questionId)).toEqual(['due', 'new-1', 'new-2'])
  })
})
