import { describe, expect, it } from 'vitest'
import { writingExampleFor } from '@/lib/llm/human-style'

describe('writingExampleFor', () => {
  it.each([
    ['장애가 이어질 때 retry는 어떻게 멈추는가?', 'retry budget'],
    ['낙관적 락과 비관적 락의 차이는?', '충돌 빈도와 충돌 뒤 복구 비용'],
    ['URL 요청은 어떤 순서로 처리되는가?', '브라우저 -> DNS 해석기'],
    ['인덱스는 왜 쓰기 비용을 키우는가?', '영향을 받는 인덱스도 유지'],
  ])('%s에 맞는 예제를 고른다', (question, marker) => {
    expect(writingExampleFor(question)).toContain(marker)
  })

  it('한 번에 예제 하나만 준다', () => {
    const prompt = writingExampleFor('Circuit Breaker 장애 복구')
    expect(prompt).toContain('Circuit Breaker와 retry')
    expect(prompt).not.toContain('낙관적 락과 비관적 락')
    expect(prompt).not.toContain('URL을 입력한 뒤')
    expect(prompt).not.toContain('인덱스가 많으면')
  })
})
