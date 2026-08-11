import { describe, expect, it } from 'vitest'
import {
  MAX_PERSONALIZED_QUESTIONS,
  MIN_PERSONALIZED_QUESTIONS,
  validatePersonalizedQuestions,
} from '@/lib/personalize/questions'

const valid = [
  'Next.js 서버 컴포넌트는 언제 쓰는가?',
  '트랜잭션 격리 수준은 무엇으로 고르는가?',
  '캐시 무효화는 어디서 시작하는가?',
  '컨테이너 이미지는 왜 계층으로 나뉘는가?',
  'CI 실패를 재현하려면 무엇을 남기는가?',
]

describe('맞춤 질문 결과', () => {
  it('5~10개의 질문을 정리해 받는다', () => {
    const result = validatePersonalizedQuestions(valid.map((q) => `  ${q}  `))
    expect(result).toEqual({ ok: true, questions: valid })
  })

  it.each([
    { questions: valid.slice(0, MIN_PERSONALIZED_QUESTIONS - 1) },
    {
      questions: Array.from(
        { length: MAX_PERSONALIZED_QUESTIONS + 1 },
        (_, i) => `${i}번 질문은 무엇인가?`,
      ),
    },
  ])('질문 개수 범위를 벗어나면 거부한다', ({ questions }) => {
    const result = validatePersonalizedQuestions(questions)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'count')).toBe(true)
  })

  it('목록이 아니면 거부한다', () => {
    expect(validatePersonalizedQuestions({ questions: valid })).toEqual({
      ok: false,
      issues: [{ code: 'not_array', detail: '질문 목록 형식이 아닙니다.' }],
    })
  })

  it.each([
    '이 프로젝트의 캐시 전략 설명',
    '캐시 전략은 무엇인가요?',
    `${'긴'.repeat(41)}?`,
  ])('기존 노드 질문 형식을 그대로 지킨다: %s', (bad) => {
    const result = validatePersonalizedQuestions([bad, ...valid.slice(1)])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'format')).toBe(true)
  })

  it('공백과 문장부호만 다른 중복도 거부한다', () => {
    const result = validatePersonalizedQuestions([
      valid[0],
      'next.js 서버 컴포넌트는 언제 쓰는가？ ',
      ...valid.slice(2),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'duplicate')).toBe(true)
  })

  it.each([
    '메일 test@example.com은 어디서 숨기는가?',
    '연락처 010-1234-5678은 왜 저장하지 않는가?',
    'https://example.com은 왜 공개하면 안 되는가?',
  ])('연락처와 URL을 질문에 남기지 않는다: %s', (bad) => {
    const result = validatePersonalizedQuestions([bad, ...valid.slice(1)])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'sensitive')).toBe(true)
  })

  it('공백 정리로 사라지는 제어문자도 먼저 거부한다', () => {
    const result = validatePersonalizedQuestions([
      '서버\u000b컴포넌트는 언제 쓰는가?',
      ...valid.slice(1),
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((issue) => issue.code === 'format')).toBe(true)
  })

  it('레포명과 회사명을 질문에 남기지 않는다', () => {
    const result = validatePersonalizedQuestions(
      [
        'cs-pathfinder는 왜 Next.js를 골랐는가?',
        'KT 프로젝트에서 트랜잭션은 어떻게 나눴는가?',
        ...valid.slice(2),
      ],
      ['cs-pathfinder', 'KT'],
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const leaks = result.issues.filter((issue) => issue.code === 'forbidden_term')
      expect(leaks).toHaveLength(2)
      expect(leaks.every((issue) => !issue.detail.includes('KT'))).toBe(true)
    }
  })

  it('짧은 영문 금칙어는 다른 기술명 안에서 오탐하지 않는다', () => {
    expect(validatePersonalizedQuestions(valid, ['go']).ok).toBe(true)
  })
})
