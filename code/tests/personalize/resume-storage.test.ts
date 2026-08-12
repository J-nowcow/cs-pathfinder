import { describe, expect, it } from 'vitest'
import {
  deserializeResumeQuestions,
  serializeResumeQuestions,
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
})
