import { describe, it, expect, vi } from 'vitest'
import { runGate, NORMALIZER_VERSION, type Candidate } from '@/lib/llm/gate'
import { MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'

const stub = (payload: unknown): StructuredCaller =>
  vi.fn(async () => payload) as unknown as StructuredCaller

type CallSpy = { mock: { calls: Array<[{ model: string; prompt: string }]> } }

const CANDIDATES: Candidate[] = [
  { id: 'n1', question: 'connection pool size는 어떤 기준으로 정하는가?' },
  { id: 'n2', question: 'TCP 3-way handshake는 어떤 과정인가?' },
]

const base = {
  parentQuestion: 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?',
  candidates: CANDIDATES,
  rawInput: '왜 코어 수 기반?',
}

describe('runGate — 매칭', () => {
  it('returns the matched id when the gate picks a candidate', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: 'n1',
      identity_scope: '',
      normalized_question: '',
    })

    const r = await runGate({ ...base, call })
    expect(r.relevant).toBe(true)
    if (r.relevant) expect(r.matchedId).toBe('n1')
  })

  it('ignores an id that is not in the candidate list', async () => {
    // 모델이 없는 id를 지어내는 경우가 있다. 그대로 받으면 존재하지 않는 노드로 보낸다.
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: 'made-up',
      identity_scope: 'postgres',
      normalized_question: 'pool size를 코어 수 기준으로 정하는 이유는?',
    })

    const r = await runGate({ ...base, call })
    expect(r.relevant).toBe(true)
    if (r.relevant) {
      expect(r.matchedId).toBeNull()
      if (r.matchedId === null) expect(r.normalizedQuestion).toContain('코어 수')
    }
  })

  it('creates a new question when nothing matches', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: 'postgres',
      normalized_question: 'connection leak은 어떻게 감지하는가?',
    })

    const r = await runGate({ ...base, call })
    expect(r.relevant).toBe(true)
    if (r.relevant && r.matchedId === null) {
      expect(r.identityScope).toBe('postgres')
      expect(r.normalizedQuestion).toBe('connection leak은 어떻게 감지하는가?')
    }
  })

  it('puts every candidate in the prompt', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: 'n1',
      identity_scope: '',
      normalized_question: '',
    })

    await runGate({ ...base, call })

    const prompt = (call as unknown as CallSpy).mock.calls[0][0].prompt
    expect(prompt).toContain('n1: connection pool size')
    expect(prompt).toContain('n2: TCP 3-way handshake')
  })

  it('works with an empty candidate list', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: 'generic',
      normalized_question: '새 질문인가?',
    })

    const r = await runGate({ ...base, candidates: [], call })
    expect(r.relevant).toBe(true)
    if (r.relevant) expect(r.matchedId).toBeNull()
  })
})

describe('runGate — 거절', () => {
  it('returns a reason when irrelevant', async () => {
    const call = stub({
      relevant: false,
      reason: 'CS 학습과 관련 없는 요청이에요.',
      matched_id: '',
      identity_scope: '',
      normalized_question: '',
    })

    const r = await runGate({ ...base, rawInput: '영어로 번역해줘', call })
    expect(r.relevant).toBe(false)
    if (!r.relevant) expect(r.reason).toContain('관련 없는')
  })

  it('falls back to a service-tone reason when the model gives none', async () => {
    const call = stub({
      relevant: false,
      reason: '',
      matched_id: '',
      identity_scope: '',
      normalized_question: '',
    })

    const r = await runGate({ ...base, call })
    expect(r.relevant).toBe(false)
    // 이 문장은 배너에 그대로 나간다
    if (!r.relevant) expect(r.reason).toMatch(/어려워요/)
  })

  it('treats a relevant verdict with neither match nor question as irrelevant', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: 'generic',
      normalized_question: '   ',
    })

    expect((await runGate({ ...base, call })).relevant).toBe(false)
  })
})

describe('runGate — 기타', () => {
  it('falls back to generic on an unknown scope', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: 'made-up-scope',
      normalized_question: '유효한 질문인가?',
    })

    const r = await runGate({ ...base, call })
    if (r.relevant && r.matchedId === null) expect(r.identityScope).toBe('generic')
  })

  it('calls the gate model', async () => {
    const call = stub({
      relevant: true,
      reason: '',
      matched_id: 'n1',
      identity_scope: '',
      normalized_question: '',
    })

    await runGate({ ...base, call })
    expect((call as unknown as CallSpy).mock.calls[0][0].model).toBe(MODEL_GATE)
  })

  it('exposes a gate version for decision records', () => {
    // v1은 자유 생성 방식이었고 수렴에 실패했다. v2는 후보 선택이다.
    expect(NORMALIZER_VERSION).toBe('gate-v2-match')
  })
})
