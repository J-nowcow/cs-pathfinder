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
    // v3은 거절 기준을 좁혔다 — 주제가 부모에서 멀어졌다는 이유로 거절하지 않는다.
    //
    // 값을 그대로 박아둔다. 프롬프트를 고치면 여기가 깨지는데, 그게 목적이다.
    // 판단 기준을 바꿔놓고 버전을 안 올리면 기록만 보고는 어느 규칙이 그 결정을
    // 내렸는지 알 수 없다.
    expect(NORMALIZER_VERSION).toBe('gate-v4-match')
  })
})

/**
 * 새로 만들 질문 문장이 규칙을 지키는가.
 *
 * 여기는 **비었는지만** 보고 있었다. 그래서 사용자가 42자짜리 꼬리질문을
 * 눌렀는데 57자짜리 제목에 도착했다 — 자기가 고른 것과 다른 질문에 온 것처럼
 * 보인다. 배치 게이트는 이 검사를 하고 있었는데 운영 경로만 없었다.
 *
 * 이 문장은 노드의 신원이다. 저장되면 URL과 제목에 그대로 박히고, 나중에
 * 고치면 같은 질문이 두 개가 된다.
 */
const LONG = 'SQL에서 뷰나 인라인 뷰를 사용하여 쿼리를 작성할 때 성능 최적화를 위해 주의해야 할 점은 무엇인가?'
const SHORT = '뷰를 쓸 때 성능에서 주의할 점은?'

/** 회차마다 다른 것을 돌려주는 호출자 */
const seq = (...payloads: unknown[]): StructuredCaller => {
  let n = 0
  return vi.fn(async () => payloads[Math.min(n++, payloads.length - 1)]) as unknown as StructuredCaller
}

const made = (q: string) => ({
  relevant: true,
  matched_id: '',
  normalized_question: q,
  identity_scope: 'generic',
  reason: '',
})

describe('runGate — 새 질문 문장', () => {
  it('규칙을 지키면 한 번만 부른다', async () => {
    const call = seq(made(SHORT))
    const r = await runGate({ ...base, call })
    expect(r).toMatchObject({ relevant: true, normalizedQuestion: SHORT })
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(1)
  })

  it('40자를 넘으면 다시 물어 짧은 것을 쓴다', async () => {
    const call = seq(made(LONG), made(SHORT))
    const r = await runGate({ ...base, call })
    expect(r).toMatchObject({ normalizedQuestion: SHORT })
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(2)
  })

  it('경어체면 다시 묻는다', async () => {
    const call = seq(made('뷰를 쓸 때 주의할 점은 무엇인가요?'), made(SHORT))
    expect(await runGate({ ...base, call })).toMatchObject({ normalizedQuestion: SHORT })
  })

  /* 두 번이 끝이다. 게이트는 매 요청마다 도는 자리라 무한정 물을 수 없다 */
  it('두 번을 넘겨 부르지 않는다', async () => {
    const call = seq(made(LONG), made(LONG), made(SHORT))
    await runGate({ ...base, call })
    expect((call as unknown as CallSpy).mock.calls).toHaveLength(2)
  })

  /* 고치려다 악화시키면 안 된다 */
  it('다시 부른 쪽이 낫지 않으면 처음 것을 쓴다', async () => {
    const worse = `${LONG} 그리고 더 긴 말을 붙인다`
    const r = await runGate({ ...base, call: seq(made(LONG), made(worse)) })
    expect(r).toMatchObject({ normalizedQuestion: LONG })
  })

  /*
   * **검사 때문에 못 파면 안 된다.**
   *
   * 멀쩡한 질문을 문전에서 막는 것이 사용자가 겪는 실패 중 가장 나쁘다.
   * 다시 부르는 쪽이 한도로 실패해도 처음 것으로 계속 간다.
   */
  it('다시 부르는 것이 실패해도 거절하지 않는다', async () => {
    let n = 0
    const call = vi.fn(async () => {
      if (n++ === 0) return made(LONG)
      throw new Error('quota exceeded')
    }) as unknown as StructuredCaller

    expect(await runGate({ ...base, call })).toMatchObject({
      relevant: true,
      normalizedQuestion: LONG,
    })
  })
})
