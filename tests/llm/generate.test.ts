import { describe, it, expect, vi } from 'vitest'
import { generateNodeContent } from '@/lib/llm/generate'
import { MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

const five = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `꼬리질문 ${i + 1}` }))
const stub = (payload: unknown): StructuredCaller =>
  vi.fn(async () => payload) as unknown as StructuredCaller

type CallSpy = { mock: { calls: Array<[{ model: string }]> } }

const base = { question: 'q', identityScope: 'generic', parentQuestion: null }

describe('generateNodeContent', () => {
  it('returns body and exactly five suggestions', async () => {
    const call = stub({ body: '커넥션 풀 크기는 코어 수에 좌우된다.', suggestions: five(5) })

    const r = await generateNodeContent({
      question: 'pool size는 어떻게 정하나?',
      identityScope: 'postgres',
      parentQuestion: 'DB 커넥션 비용',
      call,
    })

    expect(r.body).toContain('코어 수')
    expect(r.suggestions).toHaveLength(5)
    expect(r.suggestions[0]).toBe('꼬리질문 1')
  })

  it('keeps fewer than five when the model returns fewer', async () => {
    const call = stub({ body: '본문', suggestions: five(3) })
    expect((await generateNodeContent({ ...base, call })).suggestions).toHaveLength(3)
  })

  it('truncates to five when the model returns more', async () => {
    const call = stub({ body: '본문', suggestions: five(8) })
    expect((await generateNodeContent({ ...base, call })).suggestions).toHaveLength(5)
  })

  it('drops empty suggestions', async () => {
    const call = stub({
      body: '본문',
      suggestions: [{ text: '유효' }, { text: '   ' }, { text: '유효2' }],
    })
    expect((await generateNodeContent({ ...base, call })).suggestions).toEqual(['유효', '유효2'])
  })

  it('uses the generation model', async () => {
    const call = stub({ body: 'b', suggestions: five(5) })
    await generateNodeContent({ ...base, call })
    expect((call as unknown as CallSpy).mock.calls[0][0].model).toBe(MODEL_GENERATE)
  })

  it('throws when the model returns an empty body', async () => {
    const call = stub({ body: '   ', suggestions: five(5) })
    await expect(generateNodeContent({ ...base, call })).rejects.toThrow('empty body')
  })
})
