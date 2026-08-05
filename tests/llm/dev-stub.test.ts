import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { stubCaller } from '@/lib/llm/dev-stub'
import { resolveCaller } from '@/lib/llm/resolve'
import { MODEL_GATE, MODEL_GENERATE } from '@/lib/llm/client'
import { runGate } from '@/lib/llm/gate'
import { generateNodeContent } from '@/lib/llm/generate'

const anySchema = z.object({}) as unknown as z.ZodType<Record<string, unknown>>

const gate = (
  parent: string | null,
  input: string,
  candidates: Array<{ id: string; question: string }> = [],
) => runGate({ parentQuestion: parent, candidates, rawInput: input, call: stubCaller })

describe('stubCaller — 매칭 게이트', () => {
  it('accepts a normal question and returns a normalized sentence', async () => {
    const r = await gate('DB 커넥션 비용이 큰 이유는?', 'pool size는 어떻게 정하나')

    expect(r.relevant).toBe(true)
    if (r.relevant && r.matchedId === null) {
      expect(r.normalizedQuestion.length).toBeGreaterThan(0)
      expect(r.identityScope.length).toBeGreaterThan(0)
    }
  })

  it('normalizes the same input to the same sentence', async () => {
    const a = await gate(null, '인덱스가 왜 안 타나요?')
    const b = await gate(null, '  인덱스가   왜 안 타나요  ')

    if (a.relevant && a.matchedId === null && b.relevant && b.matchedId === null) {
      expect(a.normalizedQuestion).toBe(b.normalizedQuestion)
      expect(a.identityScope).toBe(b.identityScope)
    }
  })

  it('ends the normalized sentence with a question mark', async () => {
    const r = await gate(null, 'TLB가 무엇인가')
    if (r.relevant && r.matchedId === null) {
      expect(r.normalizedQuestion.endsWith('?')).toBe(true)
    }
  })

  it('picks a narrower scope when the question names a technology', async () => {
    const r = await gate(null, 'TCP handshake는 왜 3단계인가?')
    if (r.relevant && r.matchedId === null) expect(r.identityScope).toBe('tcp')
  })

  it('falls back to generic when no technology is named', async () => {
    const r = await gate(null, '추상화는 왜 필요한가?')
    if (r.relevant && r.matchedId === null) expect(r.identityScope).toBe('generic')
  })

  it('matches an existing candidate when the normalized text is identical', async () => {
    // 스텁은 의미 판단을 못 한다. 정규화 문장이 정확히 같을 때만 고른다.
    const r = await gate('부모 질문?', 'TLB가 무엇인가', [
      { id: '11111111-1111-1111-1111-111111111111', question: 'TLB가 무엇인가?' },
    ])

    expect(r.relevant).toBe(true)
    if (r.relevant) expect(r.matchedId).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('does not match when the candidate asks something else', async () => {
    const r = await gate('부모 질문?', 'TLB가 무엇인가', [
      { id: '22222222-2222-2222-2222-222222222222', question: '전혀 다른 질문인가?' },
    ])

    expect(r.relevant).toBe(true)
    if (r.relevant) expect(r.matchedId).toBeNull()
  })

  it('rejects a translation request so the reject state is reachable in the ui', async () => {
    const r = await gate(null, '이 문장을 영어로 번역해줘')

    expect(r.relevant).toBe(false)
    if (!r.relevant) expect(r.reason.length).toBeGreaterThan(0)
  })
})

describe('stubCaller — 해설 생성', () => {
  it('returns a body and exactly five suggestions', async () => {
    const r = await generateNodeContent({
      question: 'connection pool size는 어떻게 정하는가?',
      identityScope: 'postgres',
      parentQuestion: null,
      call: stubCaller,
    })

    expect(r.body.length).toBeGreaterThan(0)
    expect(r.suggestions).toHaveLength(5)
  })

  it('marks the body as development sample so it is not mistaken for real content', async () => {
    const r = await generateNodeContent({
      question: 'q?',
      identityScope: 'generic',
      parentQuestion: null,
      call: stubCaller,
    })

    expect(r.body).toContain('개발용')
  })

  it('is deterministic for the same question', async () => {
    const args = {
      question: '같은 질문',
      identityScope: 'generic',
      parentQuestion: null,
      call: stubCaller,
    }
    const a = await generateNodeContent(args)
    const b = await generateNodeContent(args)

    expect(a.body).toBe(b.body)
    expect(a.suggestions).toEqual(b.suggestions)
  })

  it('produces five distinct suggestions', async () => {
    const r = await generateNodeContent({
      question: '캐시는 언제 무효화하는가?',
      identityScope: 'generic',
      parentQuestion: null,
      call: stubCaller,
    })

    expect(new Set(r.suggestions).size).toBe(5)
  })
})

describe('stubCaller — 알 수 없는 모델', () => {
  it('throws rather than returning a shape the caller cannot use', async () => {
    await expect(
      stubCaller({ model: 'unknown-model', schema: anySchema, system: '', prompt: '' }),
    ).rejects.toThrow()
  })
})

describe('resolveCaller', () => {
  const saved = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  afterEach(() => {
    if (saved === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved
  })

  it('returns undefined when a key is present so the real caller is used', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'real-key'
    expect(resolveCaller()).toBeUndefined()
  })

  it('returns the stub when no key is present', () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    expect(resolveCaller()).toBe(stubCaller)
  })

  it('treats an empty key as missing', () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = '   '
    expect(resolveCaller()).toBe(stubCaller)
  })
})

describe('모델 상수', () => {
  it('keeps the gate and generation models distinct', () => {
    expect(MODEL_GATE).not.toBe(MODEL_GENERATE)
  })
})
