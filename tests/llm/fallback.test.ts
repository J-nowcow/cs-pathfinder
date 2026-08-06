import { describe, it, expect, vi } from 'vitest'
import {
  buildAttempts,
  callWithFallback,
  MODEL_GATE,
  MODEL_GENERATE,
  MODEL_GEMMA,
  stripCodeFence,
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

  /*
   * 과부하는 저쪽 사정이다. 실측에서 매일 발행 세 번 중 한 번이 이 문장으로
   * 죽었는데, fatal로 분류돼 폴백을 통째로 건너뛰었다. 다른 모델은 멀쩡했다.
   */
  it('reads an overload notice as transient', () => {
    expect(classifyFailure(err('This model is currently experiencing high demand. Spikes in demand are common'))).toBe(
      'transient',
    )
  })

  /* "잠시 후 다시 시도하세요"류도 마찬가지다. 다시 하라는 말이 곧 transient다 */
  it('reads a try-again notice as transient', () => {
    expect(classifyFailure(err('Please try again later'))).toBe('transient')
  })

  /* 과부하를 넓게 잡되 스키마 불일치까지 삼키면 안 된다. 그건 다시 해도 같다 */
  it('reads a schema complaint as fatal', () => {
    expect(classifyFailure(err('response did not match schema'))).toBe('fatal')
  })

  it('digs into the cause chain', () => {
    const wrapped = new Error('call failed', { cause: err('429 rate limit') })
    expect(classifyFailure(wrapped)).toBe('quota')
  })
})

describe('stripCodeFence', () => {
  const body = '{"relevant": true, "matched_id": "n01"}'

  it('leaves clean json alone', () => {
    expect(stripCodeFence(body)).toBe(body)
  })

  it('strips a full fence', () => {
    expect(stripCodeFence('```json\n' + body + '\n```')).toBe(body)
  })

  it('strips a closing fence with no opener', () => {
    // Gemma가 실제로 낸 형태다. 여는 펜스 없이 닫는 것만 붙는다.
    expect(stripCodeFence('  ' + body + '\n  ```.')).toBe(body)
  })

  it('drops prose around the object', () => {
    expect(stripCodeFence('여기 결과입니다:\n' + body + '\n도움이 되었길 바랍니다.')).toBe(body)
  })

  it('returns the text unchanged when there is no object', () => {
    expect(stripCodeFence('  not json at all  ')).toBe('not json at all')
  })

  it('keeps nested braces intact', () => {
    const nested = '{"a": {"b": 1}}'
    expect(stripCodeFence('```\n' + nested + '\n```')).toBe(nested)
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

  it('ends every chain with the free model', () => {
    // Gemma 뒤에는 폴백이 없다. 여기까지 와서 실패하면 응답을 못 준다.
    for (const model of [MODEL_GATE, MODEL_GENERATE]) {
      const attempts = buildAttempts(model, ['k1'])
      expect(attempts[attempts.length - 1].model).toBe(MODEL_GEMMA)
    }
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

/**
 * 시도 하나가 영영 안 끝나면.
 *
 * 제한이 없으면 폴백이 첫 시도에 갇힌다. 다음 모델로 못 넘어가고, 이 요청이
 * 쥔 단일 실행 잠금 때문에 같은 질문을 누른 다른 사람까지 함께 막힌다.
 * 실제로 측정 중 한 호출이 25분을 매달렸다.
 */
describe('callWithFallback — 매달린 시도', () => {
  it('hands the attempt a deadline that actually fires', async () => {
    let given: AbortSignal | undefined
    const invoke = asInvoke(
      async (
        _key: string,
        _a: StructuredCallArgs<{ ok: boolean }>,
        signal?: AbortSignal,
      ): Promise<{ ok: boolean }> => {
        given = signal
        // 응답이 안 오는 호출을 흉내낸다. 신호가 끊어줘야 폴백이 다음으로 간다
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('operation timed out')), {
            once: true,
          })
        })
      },
    )

    await expect(
      callWithFallback(args, { keys: ['k1'], invoke, attemptTimeoutMs: 10 }),
    ).rejects.toThrow(/timed out/)

    expect(given?.aborted).toBe(true)
  })

  /** 중단 신호는 시도마다 새로 만들어야 한다. 하나를 돌려쓰면 첫 만료 뒤 전부 즉사한다 */
  it('hands each attempt its own deadline', async () => {
    const signals: (AbortSignal | undefined)[] = []
    const invoke = asInvoke(
      async (
        _key: string,
        a: StructuredCallArgs<{ ok: boolean }>,
        signal?: AbortSignal,
      ): Promise<{ ok: boolean }> => {
        signals.push(signal)
        if (signals.length < 3) throw new Error('503 unavailable')
        return { ok: true }
      },
    )

    await callWithFallback(args, { keys: ['k1'], invoke, attemptTimeoutMs: 5_000 })

    expect(signals.length).toBeGreaterThanOrEqual(3)
    expect(new Set(signals).size).toBe(signals.length)
    for (const s of signals) expect(s?.aborted).toBe(false)
  })
})

/**
 * 사슬 전체 예산.
 *
 * 서버리스 함수에는 자체 예산이 있다(발행 라우트 60초). 시도마다 45초씩 무는
 * 사슬은 최악 270초라, 첫 모델이 멈추면 두 번째 모델을 시도해 보지도 못하고
 * 함수가 죽는다. 실제로 발행이 그렇게 계속 실패했다.
 */
describe('callWithFallback — 전체 예산', () => {
  it('shrinks each attempt to what is left of the budget', async () => {
    const budgets: number[] = []
    const invoke = asInvoke(
      async (
        _key: string,
        _a: StructuredCallArgs<{ ok: boolean }>,
        signal?: AbortSignal,
      ): Promise<{ ok: boolean }> => {
        // 신호가 언제 끊기는지 재는 대신, 끊길 때까지 기다렸다 실패로 돌린다
        await new Promise<void>((r) => signal?.addEventListener('abort', () => r(), { once: true }))
        budgets.push(1)
        throw new Error('operation timed out')
      },
    )

    const t0 = Date.now()
    await expect(
      callWithFallback(args, {
        keys: ['k1'],
        invoke,
        attemptTimeoutMs: 10_000,
        totalTimeoutMs: 120,
      }),
    ).rejects.toThrow()

    // 시도당 10초씩 물었으면 사슬이 몇 분 걸린다. 예산이 그것을 잘라야 한다
    expect(Date.now() - t0).toBeLessThan(3_000)
    expect(budgets.length).toBeGreaterThan(0)
  })

  it('does not bound anything when no budget is given', async () => {
    const invoke = asInvoke(async (): Promise<{ ok: boolean }> => ({ ok: true }))
    await expect(callWithFallback(args, { keys: ['k1'], invoke })).resolves.toEqual({ ok: true })
  })
})

/**
 * 우리가 끊은 시도는 같은 조합으로 다시 두드리지 않는다.
 *
 * 문자열로 보면 timeout이라 transient로 분류되고 transient는 재시도를 부른다.
 * 서버가 잠깐 흔들린 경우에는 맞지만 제한 시간을 넘긴 경우에는 아니다.
 * 방금 안 끝난 조합이 곧바로 끝날 이유가 없고, 그 한 번이 남은 예산을 먹어
 * 다음 모델을 아예 못 쓰게 만든다.
 */
describe('callWithFallback — 끊긴 시도의 재시도', () => {
  it('moves to the next model instead of retrying the one that timed out', async () => {
    const seen: string[] = []
    const invoke = asInvoke(
      async (
        _key: string,
        a: StructuredCallArgs<{ ok: boolean }>,
        signal?: AbortSignal,
      ): Promise<{ ok: boolean }> => {
        seen.push(a.model)
        if (a.model === MODEL_GENERATE) {
          await new Promise<void>((r) =>
            signal?.addEventListener('abort', () => r(), { once: true }),
          )
          throw new Error('operation timed out')
        }
        return { ok: true }
      },
    )

    await callWithFallback(args, { keys: ['k1'], invoke, attemptTimeoutMs: 20 })

    // 첫 모델은 딱 한 번만 두드린다. 두 번이면 예산을 두 배로 먹는다
    expect(seen.filter((m) => m === MODEL_GENERATE).length).toBe(1)
    expect(seen.at(-1)).not.toBe(MODEL_GENERATE)
  })

  /** 서버 쪽 일시 오류는 여전히 한 번 더 친다 */
  it('still retries the same combination on a server blip', async () => {
    const seen: string[] = []
    let first = true
    const invoke = asInvoke(
      async (_key: string, a: StructuredCallArgs<{ ok: boolean }>): Promise<{ ok: boolean }> => {
        seen.push(a.model)
        if (first) {
          first = false
          throw new Error('503 unavailable')
        }
        return { ok: true }
      },
    )

    await callWithFallback(args, { keys: ['k1'], invoke })
    expect(seen).toEqual([MODEL_GENERATE, MODEL_GENERATE])
  })
})
