import { describe, it, expect, vi } from 'vitest'
import { runGate, NORMALIZER_VERSION } from '@/lib/llm/gate'
import { MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'

const stub = (payload: unknown): StructuredCaller =>
  vi.fn(async () => payload) as unknown as StructuredCaller

type CallSpy = { mock: { calls: Array<[{ model: string }]> } }

describe('runGate', () => {
  it('returns the normalized question when relevant', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      identity_scope: 'postgres',
      normalized_question: 'connection pool size를 코어 수 기준으로 정하는 이유는?',
    })

    const r = await runGate({
      parentQuestion: 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?',
      rawInput: '왜 코어 수 기반?',
      call,
    })

    expect(r.relevant).toBe(true)
    if (r.relevant) {
      expect(r.identityScope).toBe('postgres')
      expect(r.normalizedQuestion).toBe('connection pool size를 코어 수 기준으로 정하는 이유는?')
    }
  })

  it('returns a reason when irrelevant', async () => {
    const call = stub({
      relevant: false,
      reason: 'CS 학습과 관련 없는 요청입니다.',
      identity_scope: 'generic',
      normalized_question: '',
    })

    const r = await runGate({ parentQuestion: 'DB 커넥션 비용', rawInput: '영어로 번역해줘', call })

    expect(r.relevant).toBe(false)
    if (!r.relevant) expect(r.reason).toContain('관련 없는')
  })

  it('falls back to generic when the model returns an unknown scope', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      identity_scope: 'made-up-scope',
      normalized_question: '유효한 질문인가?',
    })

    const r = await runGate({ parentQuestion: null, rawInput: '뭔가', call })
    expect(r.relevant).toBe(true)
    if (r.relevant) expect(r.identityScope).toBe('generic')
  })

  it('treats a relevant verdict with empty question as irrelevant', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      identity_scope: 'generic',
      normalized_question: '   ',
    })

    expect((await runGate({ parentQuestion: null, rawInput: '뭔가', call })).relevant).toBe(false)
  })

  it('calls the gate model', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      identity_scope: 'generic',
      normalized_question: '질문',
    })

    await runGate({ parentQuestion: null, rawInput: '뭔가', call })

    expect((call as unknown as CallSpy).mock.calls[0][0].model).toBe(MODEL_GATE)
  })

  it('exposes a normalizer version for cache binding', () => {
    expect(NORMALIZER_VERSION).toBe('gate-v1')
  })
})
