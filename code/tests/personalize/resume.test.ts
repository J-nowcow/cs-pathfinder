import { describe, expect, it, vi } from 'vitest'
import type { StructuredCaller } from '@/lib/llm/client'
import {
  generateResumeQuestions,
  MAX_RESUME_LENGTH,
  MIN_RESUME_LENGTH,
  prepareResumeText,
} from '@/lib/personalize/resume'

const validQuestions = {
  questions: [
    { text: '캐시 무효화 시점은 어떻게 정했는가?', basis: '캐시로 응답 지연을 줄인 경험', topic: '캐시' },
    { text: '동시 요청의 정합성은 어떻게 지켰는가?', basis: '동시 요청을 처리한 경험', topic: '동시성' },
    { text: '장애 전파 범위는 어떻게 줄였는가?', basis: '외부 시스템 장애에 대응한 경험', topic: '장애 격리' },
    { text: '성능 개선은 어떤 지표로 확인했는가?', basis: '처리 성능을 측정하고 개선한 경험', topic: '성능 측정' },
    { text: '트래픽이 늘면 어디가 먼저 막히는가?', basis: '트래픽 증가를 고려한 설계 경험', topic: '확장성' },
  ],
}

describe('레쥬메 입력 준비', () => {
  it('짧거나 너무 긴 입력을 모델에 보내지 않는다', () => {
    expect(prepareResumeText('짧은 경험')).toMatchObject({ ok: false, code: 'too_short' })
    expect(prepareResumeText('가'.repeat(MAX_RESUME_LENGTH + 1))).toMatchObject({
      ok: false,
      code: 'too_long',
    })
  })

  it('연락처·링크·자격 증명 후보를 전송 전에 가린다', () => {
    const source = `${'서버 성능을 개선했습니다. '.repeat(8)} test@example.com 010-1234-5678 https://example.com token=github_pat_${'a'.repeat(30)}`
    const result = prepareResumeText(source)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).not.toContain('test@example.com')
    expect(result.value).not.toContain('010-1234-5678')
    expect(result.value).not.toContain('https://example.com')
    expect(result.value).not.toContain('github_pat_')
    expect(result.value).toContain('[개인정보 제거]')
    expect(result.value).toContain('[링크 제거]')
    expect(result.value).toContain('[비밀정보 제거]')
  })

  it('최소 길이의 경계를 받는다', () => {
    expect(prepareResumeText('가'.repeat(MIN_RESUME_LENGTH)).ok).toBe(true)
  })
})

describe('레쥬메 맞춤 질문 생성', () => {
  it('경험 근거와 검색어가 있는 질문 5개를 받는다', async () => {
    const call = vi.fn(async () => validQuestions) as StructuredCaller
    const result = await generateResumeQuestions({ resumeText: '정제된 경험', call })
    expect(result).toEqual({ kind: 'ok', questions: validQuestions.questions })
    expect(call).toHaveBeenCalledOnce()
  })

  it('첫 출력이 규칙을 어기면 한 번 교정한다', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ questions: validQuestions.questions.slice(0, 4) })
      .mockResolvedValueOnce(validQuestions) as StructuredCaller
    const result = await generateResumeQuestions({ resumeText: '정제된 경험', call })
    expect(result.kind).toBe('ok')
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('근거에 링크가 남으면 출력을 버린다', async () => {
    const unsafe = {
      questions: validQuestions.questions.map((question, index) =>
        index === 0 ? { ...question, basis: 'https://example.com 에서 한 경험' } : question,
      ),
    }
    const call = vi.fn(async () => unsafe) as StructuredCaller
    const result = await generateResumeQuestions({ resumeText: '정제된 경험', call })
    expect(result.kind).toBe('invalid_output')
    expect(call).toHaveBeenCalledTimes(2)
  })
})
