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
    const state = { alwaysOpen: true, drafts: {} }
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

  it('모범답안과 비교한 자기 점검을 초안에 남긴다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '2026-08-13T00:00:00Z')
    const reviewed = markAnswerReview(draft, 'q1', 'needs-review', '2026-08-13T00:01:00Z')

    expect(reviewed.drafts.q1.reviewStatus).toBe('needs-review')
    expect(reviewed.drafts.q1.reviewedAt).toBe('2026-08-13T00:01:00Z')
    expect(deserializeAnswerPractice(serializeAnswerPractice(reviewed))).toEqual(reviewed)
    expect(markAnswerReview(reviewed, '없는 질문', 'understood', 'now')).toBe(reviewed)
  })

  it('답을 고쳐 쓰면 이전 자기 점검은 초기화한다', () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '첫 답', '1')
    const reviewed = markAnswerReview(draft, 'q1', 'understood', '2')
    const rewritten = updateAnswerDraft(reviewed, 'q1', '고친 답', '3')

    expect(rewritten.drafts.q1.reviewStatus).toBeUndefined()
    expect(rewritten.drafts.q1.reviewedAt).toBeUndefined()
  })
})
