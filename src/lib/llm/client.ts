import type { ZodType } from 'zod'
import { loadApiKeys } from '@/lib/llm/keys'
import { classifyFailure } from '@/lib/llm/failure'

/**
 * 모델 ID.
 *
 * Gemini 2.5 계열은 2026-10 종료 예정이라 사용하지 않는다.
 * - Flash-Lite: 안정 장기 지원. 호출 빈도가 가장 높은 정규화 게이트에 쓴다
 * - Flash 3.6: GA. 3.5보다 저렴하다
 * - Flash 3.5: 계획 3의 매일 발행용. Pro는 preview뿐이라 cron에 쓰지 않는다
 */
export const MODEL_GATE = 'gemini-3.1-flash-lite'
export const MODEL_GENERATE = 'gemini-3.6-flash'
export const MODEL_DAILY = 'gemini-3.5-flash'

/**
 * 모델 폴백 사슬.
 *
 * 한도(RPM·RPD)는 모델마다 따로 잡히므로 다른 모델로 넘어가면 살아난다.
 * 품질이 높은 쪽을 앞에 두고 뒤로 갈수록 가볍게 떨어뜨린다.
 *
 * 정규화 게이트는 사슬을 짧게 둔다. 모델이 바뀌면 canonical 문장이 흔들려
 * 같은 질문이 다른 해시로 갈라질 수 있다. 캐시가 갈라지느니 잠깐 실패하는 편이 낫다.
 */
export const MODEL_CHAIN: Record<string, string[]> = {
  [MODEL_GATE]: [MODEL_GATE, 'gemini-3.5-flash-lite'],
  [MODEL_GENERATE]: [MODEL_GENERATE, MODEL_DAILY, MODEL_GATE],
  [MODEL_DAILY]: [MODEL_DAILY, MODEL_GENERATE],
}

export type StructuredCallArgs<T> = {
  model: string
  schema: ZodType<T>
  system: string
  prompt: string
}

/**
 * 구조화 출력 호출 추상화.
 *
 * 테스트가 실제 모델을 부르지 않도록 주입 지점을 만든다.
 * AI SDK + Google 조합에서 z.union과 z.record는 동작하지 않으므로 스키마에서 쓰지 않는다.
 */
export type StructuredCaller = <T>(args: StructuredCallArgs<T>) => Promise<T>

/** 폴백 없이 한 번만 호출한다. 폴백 로직 테스트에서 이 함수를 대체한다. */
export async function callOnce<T>(
  apiKey: string,
  { model, schema, system, prompt }: StructuredCallArgs<T>,
): Promise<T> {
  const [{ createGoogleGenerativeAI }, { generateObject }] = await Promise.all([
    import('@ai-sdk/google'),
    import('ai'),
  ])

  const google = createGoogleGenerativeAI({ apiKey })

  // generateObject의 OUTPUT 분기는 스키마 타입으로 추론된다.
  // 제네릭 ZodType<T>로는 'object' 분기가 확정되지 않아 호출부만 좁게 캐스팅한다.
  // 공개 타입(StructuredCaller)은 그대로 안전하다.
  const call = generateObject as unknown as (
    options: Record<string, unknown>,
  ) => Promise<{ object: T }>

  const { object } = await call({
    model: google(model),
    output: 'object',
    schema,
    system,
    prompt,
  })

  return object
}

export type Attempt = { apiKey: string; model: string }

/**
 * 시도 순서를 만든다.
 *
 * 모델을 바깥 루프에 둔다. 품질이 좋은 모델을 모든 키에서 먼저 시도한 뒤에야
 * 아래 모델로 내려간다. 키를 바깥에 두면 첫 키가 죽었을 때 곧바로 품질이 떨어진다.
 */
export function buildAttempts(model: string, keys: string[]): Attempt[] {
  const chain = MODEL_CHAIN[model] ?? [model]
  return chain.flatMap((m) => keys.map((apiKey) => ({ apiKey, model: m })))
}

export type FallbackDeps = {
  keys?: string[]
  invoke?: <T>(apiKey: string, args: StructuredCallArgs<T>) => Promise<T>
  onRetry?: (info: { model: string; keyIndex: number; kind: string }) => void
}

const TRANSIENT_RETRY_MS = 600
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 키와 모델을 순서대로 시도한다.
 *
 * 인증이 깨진 키는 이번 호출 내내 건너뛴다. 다른 모델로 다시 시도해도 결과가 같아서다.
 * 프롬프트·스키마 문제(fatal)는 폴백해봐야 똑같으므로 즉시 던진다.
 */
export async function callWithFallback<T>(
  args: StructuredCallArgs<T>,
  deps: FallbackDeps = {},
): Promise<T> {
  const keys = deps.keys ?? loadApiKeys()
  if (keys.length === 0) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set')
  }

  const invoke = deps.invoke ?? callOnce
  const attempts = buildAttempts(args.model, keys)
  const deadKeys = new Set<string>()
  let lastError: unknown = new Error('no attempt was made')

  for (const attempt of attempts) {
    if (deadKeys.has(attempt.apiKey)) continue

    for (let tries = 0; tries < 2; tries += 1) {
      try {
        return await invoke<T>(attempt.apiKey, { ...args, model: attempt.model })
      } catch (error) {
        lastError = error
        const kind = classifyFailure(error)

        deps.onRetry?.({
          model: attempt.model,
          keyIndex: keys.indexOf(attempt.apiKey),
          kind,
        })

        if (kind === 'fatal') throw error
        if (kind === 'auth') {
          deadKeys.add(attempt.apiKey)
          break
        }
        if (kind === 'transient' && tries === 0) {
          await sleep(TRANSIENT_RETRY_MS)
          continue
        }
        break
      }
    }
  }

  throw lastError
}

/** 프로덕션 경로. 폴백을 포함한다. */
export const realCaller: StructuredCaller = <T>(args: StructuredCallArgs<T>): Promise<T> =>
  callWithFallback(args)
