import { describe, expect, it, vi } from 'vitest'
import { generateDailyRoot } from '@/lib/daily/generate'
import type { StructuredCaller } from '@/lib/llm/client'

const suggestions = Array.from({ length: 5 }, (_, i) => ({ text: `${i + 1}번 조건은 무엇인가?` }))
const body = '인덱스는 읽을 범위를 줄인다.\n\n:::stack\n인덱스 | 키와 위치를 보관한다\n:::'

const sequence = (...payloads: unknown[]): StructuredCaller => {
  let index = 0
  return vi.fn(async () => payloads[Math.min(index++, payloads.length - 1)]) as unknown as StructuredCaller
}

describe('generateDailyRoot', () => {
  it('긴 제목은 저장 전에 다시 줄인다', async () => {
    const call = sequence(
      {
        question: `${'가'.repeat(41)}?`,
        identity_scope: 'sql',
        body,
        summary: '인덱스의 비용을 살핀다.',
        suggestions,
      },
      {
        question: '인덱스는 언제 쓰기 비용을 키우는가?',
        identity_scope: 'sql',
        body,
        summary: '인덱스의 비용을 살핀다.',
        suggestions,
      },
    )

    const result = await generateDailyRoot({ term: '인덱스', category: '데이터베이스', call })

    expect(result.question).toBe('인덱스는 언제 쓰기 비용을 키우는가?')
    expect(call).toHaveBeenCalledTimes(2)
  })
})
