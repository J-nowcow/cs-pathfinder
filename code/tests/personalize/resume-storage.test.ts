import { describe, expect, it } from 'vitest'
import {
  deserializeResumeQuestions,
  MAX_RESUME_ANSWER_LENGTH,
  serializeResumeQuestions,
  updateResumeAnswer,
  type ResumeQuestion,
} from '@/lib/personalize/resume-storage'

const questions: ResumeQuestion[] = Array.from({ length: 5 }, (_, index) => ({
  text: `${index + 1}번 선택은 왜 했는가?`,
  basis: `${index + 1}번 기술 경험`,
  topic: `기술${index + 1}`,
}))

describe('레쥬메 맞춤 질문 브라우저 저장', () => {
  it('원문 없이 질문 5개만 저장하고 다시 읽는다', () => {
    const raw = serializeResumeQuestions(questions, '2026-08-13T00:00:00.000Z')
    expect(raw).not.toContain('레쥬메 원문')
    expect(deserializeResumeQuestions(raw)).toEqual({
      version: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      questions,
    })
  })

  it('망가진 값과 5개가 아닌 목록은 버린다', () => {
    expect(deserializeResumeQuestions('{ 망가짐')).toBeNull()
    expect(
      deserializeResumeQuestions(
        JSON.stringify({ version: 1, createdAt: new Date().toISOString(), questions: questions.slice(1) }),
      ),
    ).toBeNull()
  })

  it('맞춤 질문 답변을 원문과 분리해 질문별로 저장하고 지운다', () => {
    const saved = deserializeResumeQuestions(
      serializeResumeQuestions(questions, '2026-08-13T00:00:00.000Z'),
    )!
    const answered = updateResumeAnswer(saved, 2, '내 답', '2026-08-13T00:01:00.000Z')
    const roundTrip = deserializeResumeQuestions(
      serializeResumeQuestions(answered.questions, answered.createdAt, answered.answers),
    )

    expect(roundTrip?.answers?.['2'].text).toBe('내 답')
    expect(updateResumeAnswer(answered, 2, '  ', '2026-08-13T00:02:00.000Z').answers).toBeUndefined()
    expect(updateResumeAnswer(saved, 8, '범위 밖', '2026-08-13T00:01:00.000Z')).toBe(saved)
  })

  it('저장값을 읽을 때 맞춤 답변 길이와 질문 번호를 제한한다', () => {
    const raw = JSON.stringify({
      version: 1,
      createdAt: '2026-08-13T00:00:00.000Z',
      questions,
      answers: {
        0: { text: '가'.repeat(MAX_RESUME_ANSWER_LENGTH + 3), updatedAt: '2026-08-13T00:01:00.000Z' },
        7: { text: '범위 밖', updatedAt: '2026-08-13T00:01:00.000Z' },
      },
    })
    const saved = deserializeResumeQuestions(raw)
    expect(saved?.answers?.['0'].text).toHaveLength(MAX_RESUME_ANSWER_LENGTH)
    expect(saved?.answers?.['7']).toBeUndefined()
  })
})
