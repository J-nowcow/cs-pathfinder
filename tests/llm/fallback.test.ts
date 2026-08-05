import { describe, it, expect, vi } from 'vitest'
import {
  buildAttempts,
  callWithFallback,
  MODEL_GATE,
  MODEL_GENERATE,
  type FallbackDeps,
  type StructuredCallArgs,
} from '@/lib/llm/client'
import { classifyFailure } from '@/lib/llm/failure'
import { z } from 'zod'

const args: StructuredCallArgs<{ ok: boolean }> = {
  model: MODEL_GENERATE,
  schema: z.object({ ok: z.boolean() }),
  system: 's',
  prompt: 'p',
}

const err = (message: string) => new Error(message)

/**
 * invoke는 제네릭이라 구체 타입을 돌려주는 목을 그대로 못 넣는다.
 * 테스트 경계에서만 좁혀준다.
 */
type Invoke = NonNullable<FallbackDeps['invoke']>
const asInvoke = (fn: unknown) => fn as Invoke

describe('classifyFailure', () => {
  it('reads 429 as quota', () => {
    expect(classifyFailure(err('429 Too Many Requests'))).toBe('quota')
  })

  it('reads RESOURCE_EXHAUSTED as quota', () => {
    expect(classifyFailure(err('RESOURCE_EXHAUSTED: quota exceeded'))).toBe('quota')
  })

  it('reads an invalid key as auth', () => {
    expect(classifyFailure(err('API_KEY_INVALID'))).toBe('auth')
  })

  it('reads 503 as transient', () => {
    expect(classifyFailure(err('503 Service Unavailable'))).toBe('transient')
  })

  it('reads a schema complaint as fatal', () => {
    expect(classifyFailure(err('response did not match schema'))).toBe('fatal')
  })

  it('digs into the cause chain', () => {
    const wrapped = new Error('call failed', { cause: err('429 rate limit') })
    expect(classifyFailure(wrapped)).toBe('quota')
  })
})

describe('buildAttempts', () => {
  it('exhausts every key on the best model before dropping a tier', () => {
    const attempts = buildAttempts(MODEL_GENERATE, ['k1', 'k2'])
    expect(attempts.slice(0, 2)).toEqual([
      { apiKey: 'k1', model: MODEL_GENERATE },
      { apiKey: 'k2', model: MODEL_GENERATE },
    ])
    expect(attempts[2].model).not.toBe(MODEL_GENERATE)
  })

  it('keeps the gate chain short so the cache does not split', () => {
    const models = new Set(buildAttempts(MODEL_GATE, ['k1']).map((a) => a.model))
    expect(models.size).toBeLessThanOrEqual(2)
  })

  it('falls back to the single model when no chain is defined', () => {
    expect(buildAttempts('unknown-model', ['k1'])).toEqual([
      { apiKey: 'k1', model: 'unknown-model' },
    ])
  })
})

describe('callWithFallback', () => {
  it('returns the first success without extra calls', async () => {
    const invoke = vi.fn(async () => ({ ok: true }))
    const out = await callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke) })

    expect(out).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('moves to the next key when the first is out of quota', async () => {
    const invoke = vi.fn(async (key: string) => {
      if (key === 'k1') throw err('429 quota exceeded')
      return { ok: true }
    })

    const out = await callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke) })
    expect(out).toEqual({ ok: true })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('drops to the next model when every key is out of quota', async () => {
    const seen: string[] = []
    const invoke = vi.fn(async (_key: string, a: StructuredCallArgs<unknown>) => {
      seen.push(a.model)
      if (a.model === MODEL_GENERATE) throw err('429 quota')
      return { ok: true }
    })

    await callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke) })

    expect(seen.slice(0, 2)).toEqual([MODEL_GENERATE, MODEL_GENERATE])
    expect(seen[2]).not.toBe(MODEL_GENERATE)
  })

  it('skips a dead key for the rest of the run', async () => {
    const used: string[] = []
    const invoke = vi.fn(async (key: string) => {
      used.push(key)
      if (key === 'k1') throw err('API_KEY_INVALID')
      return { ok: true }
    })

    await callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke) })
    expect(used.filter((k) => k === 'k1')).toHaveLength(1)
  })

  it('retries the same combination once on a transient failure', async () => {
    let calls = 0
    const invoke = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw err('503 Service Unavailable')
      return { ok: true }
    })

    const out = await callWithFallback(args, { keys: ['k1'], invoke: asInvoke(invoke) })
    expect(out).toEqual({ ok: true })
    expect(calls).toBe(2)
  })

  it('throws immediately on a fatal failure', async () => {
    const invoke = vi.fn(async () => {
      throw err('response did not match schema')
    })

    await expect(callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke) })).rejects.toThrow('schema')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('throws the last error when everything is exhausted', async () => {
    const invoke = vi.fn(async () => {
      throw err('429 quota')
    })

    await expect(callWithFallback(args, { keys: ['k1'], invoke: asInvoke(invoke) })).rejects.toThrow('429')
  })

  it('fails fast when no key is configured', async () => {
    await expect(callWithFallback(args, { keys: [] })).rejects.toThrow('not set')
  })

  it('reports each retry so failures are observable', async () => {
    const onRetry = vi.fn()
    const invoke = vi.fn(async (key: string) => {
      if (key === 'k1') throw err('429 quota')
      return { ok: true }
    })

    await callWithFallback(args, { keys: ['k1', 'k2'], invoke: asInvoke(invoke), onRetry })

    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'quota', keyIndex: 0 }),
    )
  })
})
