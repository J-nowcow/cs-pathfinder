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

/**
 * 규칙을 어기면 한 번 다시 부른다.
 *
 * 붙이기 전까지 이 경로는 "비었나"만 봤다. 프롬프트에 적힌 문단 150자·꼬리질문
 * 35자·도식 위치가 전부 강제되지 않았고, 검사하는 코드는 오프라인 배치
 * 스크립트에만 있었다.
 */
const clean = {
  body: '커넥션을 매번 새로 맺으면 핸드셰이크를 그때마다 다시 한다.\n\n:::stack\n풀 | 맺어둔 것을 빌려준다\n:::',
  suggestions: Array.from({ length: 5 }, (_, i) => ({ text: `${i + 1}번은 무엇인가?` })),
}
const longTail = {
  ...clean,
  suggestions: [...clean.suggestions.slice(1), { text: `${'가'.repeat(40)}는 무엇인가?` }],
}

/** 회차마다 다른 것을 돌려주는 호출자 */
const sequence = (...payloads: unknown[]): StructuredCaller => {
  let n = 0
  return vi.fn(async () => payloads[Math.min(n++, payloads.length - 1)]) as unknown as StructuredCaller
}

describe('generateNodeContent · 규칙 재시도', () => {
  it('규칙을 지키면 한 번만 부른다', async () => {
    const call = sequence(clean)
    const r = await generateNodeContent({ ...base, call })
    expect(r.retried).toBe(false)
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(1)
  })

  it('어긋나면 다시 부르고 고쳐진 것을 쓴다', async () => {
    const call = sequence(longTail, clean)
    const r = await generateNodeContent({ ...base, call })
    expect(r.retried).toBe(true)
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(2)
    expect(r.suggestions.every((s) => s.length <= 35)).toBe(true)
  })

  it('AI식 문체도 다시 부르고 고쳐진 것을 쓴다', async () => {
    const aiStyle = {
      ...clean,
      body: '인덱스를 통해 조회 속도를 효과적으로 높인다.\n\n:::stack\n인덱스 | 탐색 범위를 줄인다\n:::',
    }
    const call = sequence(aiStyle, clean)
    const r = await generateNodeContent({ ...base, call })

    expect(r.retried).toBe(true)
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(2)
    expect(r.body).toBe(clean.body)
  })

  /* 두 번이 끝이다. 무료 한도가 빠듯한 자리라 무한정 물을 수 없다 */
  it('두 번을 넘겨 부르지 않는다', async () => {
    const call = sequence(longTail, longTail, clean)
    await generateNodeContent({ ...base, call })
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(2)
  })

  /*
   * 재시도가 더 나빠질 수 있다. 그때 새 결과를 그냥 쓰면 고치려다
   * 악화시킨 셈이 된다.
   */
  it('재시도가 더 나쁘면 첫 번째를 쓴다', async () => {
    const worse = {
      ...clean,
      body: `${'가'.repeat(200)}\n\n:::stack\nA | B\n:::`,
      suggestions: [{ text: `${'나'.repeat(40)}는 무엇인가?` }],
    }
    const r = await generateNodeContent({ ...base, call: sequence(longTail, worse) })
    expect(r.body).toBe(longTail.body)
  })

  /*
   * **검사를 붙였다고 전에 되던 것이 안 되면 안 된다.**
   *
   * 다시 부르는 쪽이 한도나 과부하로 실패하는 일은 흔하다. 그때 예외가
   * 그대로 올라가면, 규칙 하나 어긋난 해설을 받던 사용자가 아무것도 못
   * 받게 된다. 잃는 쪽이 훨씬 크다.
   */
  it('다시 부르는 것이 실패해도 첫 번째를 내놓는다', async () => {
    let n = 0
    const call = vi.fn(async () => {
      if (n++ === 0) return longTail
      throw new Error('quota exceeded')
    }) as unknown as StructuredCaller

    const r = await generateNodeContent({ ...base, call })
    expect(r.body).toBe(longTail.body)
    expect(r.retried).toBe(true)
  })

  it('남은 지적을 함께 돌려준다', async () => {
    const r = await generateNodeContent({ ...base, call: sequence(longTail) })
    expect(r.issues.map((i) => i.rule)).toContain('꼬리질문길이')
  })
})
