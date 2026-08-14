import { describe, expect, it } from 'vitest'
import {
  MAX_ANSWER_DRAFTS,
  deserializeAnswerPractice,
  emptyAnswerPractice,
  markAnswerReview,
  serializeAnswerPractice,
  updateAnswerDraft,
} from '@/lib/answer-practice/storage'

describe('면접 답변 초안 저장', () => {
  it('질문별 초안을 저장하고 빈 답은 지운다', () => {
    const saved = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '2026-08-13T00:00:00Z')
    expect(saved.drafts.q1.text).toBe('내 답')
    expect(updateAnswerDraft(saved, 'q1', '  ', '2026-08-13T00:01:00Z').drafts.q1).toBeUndefined()
  })

  it('최근 초안만 상한만큼 남긴다', () => {
    let state = emptyAnswerPractice()
    for (let i = 0; i < MAX_ANSWER_DRAFTS + 2; i += 1) {
      state = updateAnswerDraft(state, `q${i}`, '답', String(i).padStart(3, '0'))
    }
    expect(Object.keys(state.drafts)).toHaveLength(MAX_ANSWER_DRAFTS)
    expect(state.drafts.q0).toBeUndefined()
  })

  it('깨진 저장값은 빈 상태로 복구하고 설정을 왕복한다', () => {
    expect(deserializeAnswerPractice('{깨짐')).toEqual(emptyAnswerPractice())
    const state = { ...emptyAnswerPractice(), alwaysOpen: true }
    expect(deserializeAnswerPractice(serializeAnswerPractice(state))).toEqual(state)
  })

  it('저장소에 초안이 너무 많아도 최근 상한까지만 읽는다', () => {
    const drafts = Object.fromEntries(
      Array.from({ length: MAX_ANSWER_DRAFTS + 3 }, (_, index) => [
        `q${index}`,
        { text: '답', updatedAt: String(index).padStart(3, '0') },
      ]),
    )
    const state = deserializeAnswerPractice(JSON.stringify({ version: 1, drafts }))
    expect(Object.keys(state.drafts)).toHaveLength(MAX_ANSWER_DRAFTS)
    expect(state.drafts.q0).toBeUndefined()
  })

  it('모범답안과 비교한 자기 점검을 복습 일정과 학습일로 남긴다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '2026-08-13T00:00:00Z')
    const reviewed = markAnswerReview(draft, 'q1', 'needs-review', '2026-08-13T00:01:00Z')

    expect(reviewed.reviews.q1).toEqual({
      status: 'needs-review',
      reviewedAt: '2026-08-13T00:01:00Z',
      nextReviewOn: '2026-08-14',
      reviewCount: 1,
      successStreak: 0,
    })
    expect(reviewed.practiceDays).toEqual({ '2026-08-13': ['q1'] })
    expect(deserializeAnswerPractice(serializeAnswerPractice(reviewed))).toEqual(reviewed)
    expect(markAnswerReview(reviewed, '없는 질문', 'understood', 'now')).toBe(reviewed)
  })

  it('연속 설명 성공에 따라 7일, 30일, 90일로 복습 간격을 늘린다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '1')
    const first = markAnswerReview(draft, 'q1', 'understood', '2026-08-13T00:00:00Z')
    const second = markAnswerReview(first, 'q1', 'understood', '2026-08-20T00:00:00Z')
    const third = markAnswerReview(second, 'q1', 'understood', '2026-09-19T00:00:00Z')

    expect(first.reviews.q1.nextReviewOn).toBe('2026-08-20')
    expect(second.reviews.q1.nextReviewOn).toBe('2026-09-19')
    expect(third.reviews.q1.nextReviewOn).toBe('2026-12-18')
    expect(third.reviews.q1).toMatchObject({ reviewCount: 3, successStreak: 3 })
  })

  it('다시 볼 답은 성공 횟수를 초기화하고 다음 날로 잡는다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '1')
    const understood = markAnswerReview(draft, 'q1', 'understood', '2026-08-13T00:00:00Z')
    const needsReview = markAnswerReview(understood, 'q1', 'needs-review', '2026-08-20T00:00:00Z')

    expect(needsReview.reviews.q1).toMatchObject({
      nextReviewOn: '2026-08-21', reviewCount: 2, successStreak: 0,
    })
  })

  it('답을 고쳐 써도 복습 일정은 지우지 않는다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '첫 답', '1')
    const reviewed = markAnswerReview(draft, 'q1', 'understood', '2026-08-13T00:00:00Z')
    const rewritten = updateAnswerDraft(reviewed, 'q1', '고친 답', '3')

    expect(rewritten.reviews.q1).toEqual(reviewed.reviews.q1)
  })

  it('v1 자기 점검을 KST 기준 v2 복습 일정으로 옮긴다', () => {
    const migrated = deserializeAnswerPractice(JSON.stringify({
      version: 1,
      alwaysOpen: true,
      drafts: {
        q1: {
          text: '내 답', updatedAt: '1', reviewStatus: 'understood', reviewedAt: '2026-08-13T16:30:00Z',
        },
      },
    }))

    expect(migrated.alwaysOpen).toBe(true)
    expect(migrated.drafts.q1).toEqual({ text: '내 답', updatedAt: '1' })
    expect(migrated.reviews.q1).toMatchObject({ nextReviewOn: '2026-08-21', successStreak: 1 })
    expect(migrated.practiceDays).toEqual({ '2026-08-14': ['q1'] })
  })

  it('손상된 복습 날짜만 버리고 v2 초안과 설정은 보존한다', () => {
    const restored = deserializeAnswerPractice(JSON.stringify({
      version: 2,
      alwaysOpen: true,
      drafts: { q1: { text: '살릴 답', updatedAt: '1' } },
      reviews: {
        q1: {
          status: 'understood', reviewedAt: '2026-08-13T00:00:00Z', nextReviewOn: '2026-99-99',
          reviewCount: 1, successStreak: 1,
        },
      },
      practiceDays: { '2026-02-30': ['q1'] },
    }))

    expect(restored.alwaysOpen).toBe(true)
    expect(restored.drafts.q1.text).toBe('살릴 답')
    expect(restored.reviews).toEqual({})
    expect(restored.practiceDays).toEqual({})
  })
})
