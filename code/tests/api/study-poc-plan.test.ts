import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/study-poc/plan/route'
import { createPlanService, POC_MODEL, POC_PROCESS_LIMIT, type PlanRequest } from '@/lib/study-poc/ai'

const sdk = vi.hoisted(() => ({ generateObject: vi.fn() }))
vi.mock('ai', () => ({ generateObject: sdk.generateObject }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => (model: string) => ({ model }) }))

const input: PlanRequest = { requestId: 'request-1', sessionId: 'session-1', revision: 0,
  goal: '커넥션 풀과 대기열을 비교하고 싶어요', currentActivity: 'explain',
  allowedActivityIds: ['explain', 'compare', 'experiment', 'check', 'reflect'] }
const liveEnv = { NODE_ENV: 'development', STUDY_POC_LIVE_ENABLED: '1', STUDY_POC_MODEL: POC_MODEL,
  GOOGLE_GENERATIVE_AI_API_KEY: 'synthetic-test-key' }
const answer = { object: { activityIds: ['compare', 'experiment'], reason: '차이를 비교한 뒤 대기를 조작해 봅니다.', sourceIds: ['hikari-sizing'] },
  usage: { inputTokens: 120, outputTokens: 50, totalTokens: 170 } }
function request(body: unknown = input, host = 'localhost:3047', origin = `http://${host}`) {
  return new Request(`http://${host}/api/study-poc/plan`, { method: 'POST',
    headers: { host, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
}
afterEach(() => vi.unstubAllEnvs())

describe('local study PoC plan boundary', () => {
  it('accepts the installed NextRequest loopback normalization while preserving actual Host/Origin and port checks', async () => {
    vi.stubEnv('STUDY_POC_LIVE_ENABLED', '')
    vi.stubEnv('__NEXT_NO_MIDDLEWARE_URL_NORMALIZE', '')
    const normalized = new NextRequest('http://127.0.0.1:3048/api/study-poc/plan', {
      method: 'POST', headers: { host: '127.0.0.1:3048', origin: 'http://127.0.0.1:3048',
        'x-forwarded-host': '127.0.0.1:3048', 'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    expect(new URL(normalized.url).hostname).toBe('localhost')
    expect((await POST(normalized)).status).toBe(200)
    const mismatchedPort = new Request('http://localhost:3048/api/study-poc/plan', {
      method: 'POST', headers: { host: '127.0.0.1:3047', origin: 'http://127.0.0.1:3047',
        'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    expect((await POST(mismatchedPort)).status).toBe(403)
    const remoteInternalUrl = new Request('http://example.test:3048/api/study-poc/plan', {
      method: 'POST', headers: { host: '127.0.0.1:3048', origin: 'http://127.0.0.1:3048',
        'content-type': 'application/json' }, body: JSON.stringify(input),
    })
    expect((await POST(remoteInternalUrl)).status).toBe(403)
    expect((await POST(request(input, '127.0.0.1:3048', 'http://localhost:3048'))).status).toBe(403)
  })
  it('rejects remote hosts, missing/cross origin, forwarding and production before planning', async () => {
    expect((await POST(request(input, 'example.test'))).status).toBe(403)
    expect((await POST(request(input, 'localhost:3047', 'https://example.test'))).status).toBe(403)
    const missing = request(); missing.headers.delete('origin')
    expect((await POST(missing)).status).toBe(403)
    const forwarded = request(); forwarded.headers.set('x-forwarded-host', 'example.test')
    expect((await POST(forwarded)).status).toBe(403)
    const nextForwarded = request(); nextForwarded.headers.set('x-forwarded-host', 'localhost:3047')
    expect((await POST(nextForwarded)).status).toBe(200)
    expect((await POST(request(input, 'localhost:3047', 'http://localhost:3047/not-an-origin'))).status).toBe(403)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('STUDY_POC_LOCAL_ENABLED', '')
    expect((await POST(request())).status).toBe(403)
    vi.stubEnv('STUDY_POC_LOCAL_ENABLED', '1')
    expect(await (await POST(request())).json()).toMatchObject({ mode: 'rules', fallbackReason: 'production_disabled', diagnostics: { attempts: 0 } })
    vi.stubEnv('VERCEL', '1')
    expect((await POST(request())).status).toBe(403)
  })
  it('returns an explicit zero-call rules plan when live is disabled', async () => {
    vi.stubEnv('STUDY_POC_LIVE_ENABLED', '')
    const response = await POST(request())
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toMatchObject({ requestId: input.requestId, mode: 'rules',
      activityIds: ['compare'], fallbackReason: 'live_disabled', diagnostics: { attempts: 0 } })
  })
  it('rejects answers, unknown IDs, oversized goals/bodies and does not accept arbitrary data', async () => {
    for (const bad of [{ ...input, answer: 'private draft' }, { ...input, allowedActivityIds: ['execute'] },
      { ...input, goal: 'a'.repeat(201) }, { ...input, revision: -1 }, { ...input, goal: 'person@example.test' },
      { ...input, goal: '010-1234-5678' }, { ...input, goal: 'api_key=synthetic-secret' }]) {
      expect((await POST(request(bad))).status).toBe(400)
    }
    expect((await POST(request({ ...input, goal: 'a'.repeat(5000) }))).status).toBe(413)
  })
})

describe('single-provider planning without DB or existing expansion', () => {
  it('passes one direct SDK invocation with retry zero, output cap, abort signal and only public goal context', async () => {
    sdk.generateObject.mockResolvedValueOnce(answer)
    const result = await createPlanService({ env: liveEnv })(input)
    expect(result.mode).toBe('ai')
    expect(sdk.generateObject).toHaveBeenCalledTimes(1)
    const options = sdk.generateObject.mock.calls[0][0]
    expect(options).toMatchObject({ maxRetries: 0, maxOutputTokens: 512 })
    expect(options.abortSignal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(options.prompt)).toMatchObject({ goal: input.goal, allowedActivityIds: input.allowedActivityIds })
    expect(options.prompt).not.toContain(input.sessionId)
    expect(options.prompt).not.toContain(input.requestId)
    expect(options).not.toHaveProperty('tools')
    expect(options).not.toHaveProperty('experimental_repairText')
  })
  it('makes no call without credentials or explicit model configuration', async () => {
    const invoke = vi.fn()
    expect(await createPlanService({ env: { ...liveEnv, GOOGLE_GENERATIVE_AI_API_KEY: '' }, invoke })(input))
      .toMatchObject({ mode: 'rules', fallbackReason: 'credentials_missing', diagnostics: { attempts: 0 } })
    expect(await createPlanService({ env: { ...liveEnv, STUDY_POC_MODEL: '' }, invoke })(input))
      .toMatchObject({ mode: 'rules', fallbackReason: 'model_not_configured' })
    expect(invoke).not.toHaveBeenCalled()
  })
  it('returns validated AI activity choices with usage and replays identical requests without another call', async () => {
    const invoke = vi.fn().mockResolvedValue(answer)
    const service = createPlanService({ env: liveEnv, invoke })
    expect(await service(input)).toMatchObject({ mode: 'ai', activityIds: ['compare', 'experiment'],
      diagnostics: { provider: 'google', model: POC_MODEL, attempts: 1, usage: answer.usage } })
    await service({ ...input })
    expect(invoke).toHaveBeenCalledTimes(1)
    expect(await service({ ...input, goal: 'changed' })).toMatchObject({ mode: 'rules', fallbackReason: 'request_id_reused' })
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('rejects disallowed choices, invented sources and duplicate IDs', async () => {
    for (const object of [{ ...answer.object, activityIds: ['check'] }, { ...answer.object, sourceIds: ['invented'] },
      { ...answer.object, activityIds: ['compare', 'compare'] }]) {
      const service = createPlanService({ env: liveEnv, invoke: vi.fn().mockResolvedValue({ object }) })
      expect(await service({ ...input, allowedActivityIds: ['compare'] })).toMatchObject({ mode: 'rules', fallbackReason: 'invalid_output' })
    }
  })
  it('shares duplicate in-flight requests and keeps only one provider operation active', async () => {
    let finish!: (value: typeof answer) => void
    const invoke = vi.fn(() => new Promise<typeof answer>((resolve) => { finish = resolve }))
    const service = createPlanService({ env: liveEnv, invoke })
    const first = service(input)
    const duplicate = service({ ...input })
    expect(await service({ ...input, requestId: 'second' })).toMatchObject({ fallbackReason: 'busy', diagnostics: { attempts: 0 } })
    await Promise.resolve(); finish(answer)
    expect((await first).mode).toBe('ai'); expect((await duplicate).mode).toBe('ai')
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('counts failed attempts toward the lifetime cap and never retries', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('provider error with private detail'))
    const service = createPlanService({ env: liveEnv, invoke })
    for (let n = 0; n < POC_PROCESS_LIMIT; n += 1) {
      expect(await service({ ...input, requestId: `request-${n}` })).toMatchObject({ fallbackReason: 'provider_error', diagnostics: { attempts: 1 } })
    }
    expect(await service({ ...input, requestId: 'over-limit' })).toMatchObject({ fallbackReason: 'process_limit', diagnostics: { attempts: 0 } })
    expect(invoke).toHaveBeenCalledTimes(POC_PROCESS_LIMIT)
  })
  it('cancels and discards late output while retaining the active slot until the provider settles', async () => {
    let finish!: (value: typeof answer) => void
    const invoke = vi.fn(() => new Promise<typeof answer>((resolve) => { finish = resolve }))
    const service = createPlanService({ env: liveEnv, invoke })
    const controller = new AbortController()
    const pending = service(input, controller.signal)
    await Promise.resolve(); controller.abort()
    expect(await pending).toMatchObject({ mode: 'rules', fallbackReason: 'cancelled' })
    expect(await service({ ...input, requestId: 'after-cancel' })).toMatchObject({ fallbackReason: 'busy' })
    finish(answer); await Promise.resolve(); await Promise.resolve()
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('does not invoke a provider when cancellation precedes the queued invocation', async () => {
    const invoke = vi.fn().mockResolvedValue(answer)
    const service = createPlanService({ env: liveEnv, invoke })
    const controller = new AbortController()
    const pending = service(input, controller.signal)
    controller.abort()
    expect(await pending).toMatchObject({ mode: 'rules', fallbackReason: 'cancelled', diagnostics: { attempts: 0 } })
    expect(invoke).not.toHaveBeenCalled()
  })
  it('enforces a deadline and does not retry a timed out provider', async () => {
    const invoke = vi.fn(() => new Promise<never>(() => {}))
    const service = createPlanService({ env: liveEnv, invoke, deadlineMs: 5 })
    expect(await service(input)).toMatchObject({ mode: 'rules', fallbackReason: 'deadline', diagnostics: { attempts: 1 } })
    expect(await service({ ...input, requestId: 'after-timeout' })).toMatchObject({ fallbackReason: 'busy' })
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
