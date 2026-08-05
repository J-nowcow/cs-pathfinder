import { describe, it, expect, vi } from 'vitest'
import { requestExpand } from '@/lib/api/expand-client'

const OK_BODY = {
  node: {
    id: 'n1',
    question: '질문',
    body: '본문',
    identity_scope: 'generic',
    suggestions: [{ id: 's1', text: '꼬리', resolved: false }],
  },
  cache: 'miss',
  quota: { used: 1, limit: 5 },
  ancestor_jump: null,
}

// 인자를 받는 시그니처로 둬야 mock.calls에서 요청 본문을 꺼낼 때 타입이 선다.
const respond = (status: number, body: unknown) =>
  vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }))

const call = (fetchImpl: typeof fetch) =>
  requestExpand(
    {
      parentNodeId: 'p1',
      ancestorNodeIds: ['p1'],
      mode: 'suggestion',
      suggestionId: 's1',
    },
    fetchImpl,
  )

describe('requestExpand — 성공', () => {
  it('maps 200 to ok with the node payload', async () => {
    const r = await call(respond(200, OK_BODY) as unknown as typeof fetch)

    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') {
      expect(r.node.id).toBe('n1')
      expect(r.node.suggestions[0].resolved).toBe(false)
      expect(r.quota).toEqual({ used: 1, limit: 5 })
    }
  })

  it('maps an ancestor jump response even though the status is 200', async () => {
    const body = { node: null, cache: null, ancestor_jump: { index: 1, node_id: 'anc' } }
    const r = await call(respond(200, body) as unknown as typeof fetch)

    expect(r.kind).toBe('ancestor_jump')
    if (r.kind === 'ancestor_jump') expect(r.nodeId).toBe('anc')
  })

  it('sends a fresh idempotency key on every call', async () => {
    const fetchImpl = respond(200, OK_BODY)
    await call(fetchImpl as unknown as typeof fetch)
    await call(fetchImpl as unknown as typeof fetch)

    const keys = fetchImpl.mock.calls.map(
      (c) => JSON.parse((c[1] as RequestInit).body as string).idempotency_key,
    )
    expect(keys[0]).not.toBe(keys[1])
    expect(keys[0]).toBeTruthy()
  })

  it('omits raw_input for suggestion mode', async () => {
    const fetchImpl = respond(200, OK_BODY)
    await call(fetchImpl as unknown as typeof fetch)

    const sent = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(sent.raw_input).toBeUndefined()
    expect(sent.suggestion_id).toBe('s1')
  })

  it('omits suggestion_id for free mode', async () => {
    const fetchImpl = respond(200, OK_BODY)
    await requestExpand(
      { parentNodeId: 'p1', ancestorNodeIds: [], mode: 'free', rawInput: '왜?' },
      fetchImpl as unknown as typeof fetch,
    )

    const sent = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(sent.suggestion_id).toBeUndefined()
    expect(sent.raw_input).toBe('왜?')
  })
})

describe('requestExpand — 실패 매핑', () => {
  it('maps 422 to rejected with the reason', async () => {
    const r = await call(
      respond(422, { error: 'irrelevant', reason: '관련 없는 요청입니다.' }) as unknown as typeof fetch,
    )

    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') expect(r.reason).toContain('관련 없는')
  })

  it('maps 400 to rejected so input validation shares the same slot', async () => {
    const r = await call(
      respond(400, { error: 'invalid_input', detail: '300자까지 입력할 수 있습니다.' }) as unknown as typeof fetch,
    )

    expect(r.kind).toBe('rejected')
    if (r.kind === 'rejected') expect(r.reason).toContain('300자')
  })

  it('maps 429 quota_exceeded to quota_exceeded', async () => {
    const r = await call(respond(429, { error: 'quota_exceeded' }) as unknown as typeof fetch)
    expect(r.kind).toBe('quota_exceeded')
  })

  it('maps 429 rate_limited to rate_limited with a retry delay', async () => {
    const r = await call(
      respond(429, { error: 'rate_limited', retry_after: 3 }) as unknown as typeof fetch,
    )

    expect(r.kind).toBe('rate_limited')
    if (r.kind === 'rate_limited') expect(r.retryAfter).toBe(3)
  })

  it('defaults the retry delay when the server omits it', async () => {
    const r = await call(respond(429, { error: 'rate_limited' }) as unknown as typeof fetch)
    if (r.kind === 'rate_limited') expect(r.retryAfter).toBeGreaterThan(0)
  })

  it('maps 503 to gate_unavailable', async () => {
    const r = await call(
      respond(503, { error: 'gate_unavailable', fallback_suggestions: [] }) as unknown as typeof fetch,
    )
    expect(r.kind).toBe('gate_unavailable')
  })

  it('maps 504 to error', async () => {
    const r = await call(respond(504, { error: 'generation_timeout' }) as unknown as typeof fetch)
    expect(r.kind).toBe('error')
  })

  it('maps 404 to error', async () => {
    const r = await call(respond(404, { error: 'not_found' }) as unknown as typeof fetch)
    expect(r.kind).toBe('error')
  })

  it('swallows a network exception instead of throwing', async () => {
    // 던지면 읽기 뷰가 통째로 죽는다. 재시도 버튼을 띄우는 편이 낫다.
    const boom = vi.fn(async (_url: string, _init?: RequestInit) => {
      throw new Error('network down')
    })
    const r = await call(boom as unknown as typeof fetch)

    expect(r.kind).toBe('error')
  })

  it('treats an unparseable body as an error', async () => {
    const bad = vi.fn(async (_url: string, _init?: RequestInit) => new Response('<html>502</html>', { status: 502 }))
    const r = await call(bad as unknown as typeof fetch)

    expect(r.kind).toBe('error')
  })

  it('treats a 200 with a missing node as an error', async () => {
    const r = await call(respond(200, { cache: 'hit' }) as unknown as typeof fetch)
    expect(r.kind).toBe('error')
  })
})
