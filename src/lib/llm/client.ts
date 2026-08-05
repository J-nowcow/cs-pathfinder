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
 * Gemma 4. Gemini API에서 서빙되고 입력·출력·캐싱이 전부 무료다.
 * 유료 티어가 없는 무료 전용 모델이라 한도를 넘어도 과금되지 않는다.
 *
 * 후보 매칭 정확도는 Flash-Lite와 동률로 실측됐다(후보 3·10·25·50개에서 각 7/7).
 * 대신 눈에 띄게 느려서 1순위로 두지 않는다. 게이트는 모든 확장의 임계 경로다.
 *
 * 네이티브 구조화 출력을 지원하지 않아 응답을 코드펜스로 감싼다.
 * stripCodeFence가 그걸 복구한다.
 */
export const MODEL_GEMMA = 'gemma-4-31b-it'

/**
 * 모델 폴백 사슬.
 *
 * 한도(RPM·RPD)는 모델마다 따로 잡히므로 다른 모델로 넘어가면 살아난다.
 * 앞은 빠르고 뒤는 무료다. 평소엔 빠른 쪽을 쓰고 한도가 떨어지면 무료로 버틴다.
 *
 * 게이트가 "생성"이 아니라 "후보 선택"이라 모델이 바뀌어도 출력이 id다.
 * 그래서 게이트도 사슬을 길게 가져갈 수 있다. 생성 방식이었다면 모델을 바꾸는 순간
 * canonical 문장이 흔들려 캐시가 갈라졌을 것이다.
 *
 * 사슬 끝을 Gemma로 닫는 이유는 그 뒤가 없기 때문이다. Gemma는 무료 전용이라
 * 여기까지 왔는데도 실패하면 서비스가 응답을 못 준다.
 */
export const MODEL_CHAIN: Record<string, string[]> = {
  [MODEL_GATE]: [MODEL_GATE, 'gemini-3.5-flash-lite', MODEL_GEMMA],
  [MODEL_GENERATE]: [MODEL_GENERATE, MODEL_DAILY, MODEL_GATE, MODEL_GEMMA],
  [MODEL_DAILY]: [MODEL_DAILY, MODEL_GENERATE, MODEL_GEMMA],
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

/**
 * 마크다운 코드펜스를 벗긴다.
 *
 * Gemma는 네이티브 구조화 출력을 지원하지 않아 SDK가 프롬프트 기반 JSON으로 떨어진다.
 * 그때 Gemma는 응답을 ```json ... ``` 로 감싸서 파서가 깨진다.
 * 내용은 멀쩡한데 형식만 어긋나는 것이라 여기서 되살린다.
 */
export function stripCodeFence(text: string): string {
  const withoutFence = text
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```[.\s]*$/, '')
    .trim()

  // 여는 펜스 없이 닫는 펜스만 붙거나 앞뒤에 설명이 섞이는 경우가 있다.
  // 가장 바깥 중괄호 구간만 잘라낸다.
  const start = withoutFence.indexOf('{')
  const end = withoutFence.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return withoutFence

  return withoutFence.slice(start, end + 1)
}

/** 폴백 없이 한 번만 호출한다. 폴백 로직 테스트에서 이 함수를 대체한다. */
export async function callOnce<T>(
  apiKey: string,
  { model, schema, system, prompt }: StructuredCallArgs<T>,
  abortSignal?: AbortSignal,
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
    abortSignal,
    experimental_repairText: async ({ text }: { text: string }) => stripCodeFence(text),
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
  invoke?: <T>(apiKey: string, args: StructuredCallArgs<T>, abortSignal?: AbortSignal) => Promise<T>
  /** 시도 하나에 허용할 시간. 시험에서 줄여 쓴다 */
  attemptTimeoutMs?: number
  onRetry?: (info: { model: string; keyIndex: number; kind: string }) => void
}

const TRANSIENT_RETRY_MS = 600

/**
 * 시도 하나에 허용하는 시간.
 *
 * 제한이 없으면 응답이 영영 안 오는 호출에 매달린다. 그러면 폴백도 못 넘어가고,
 * 이 요청이 쥔 단일 실행 잠금 때문에 같은 질문을 누른 다른 사람까지 함께 막힌다.
 * 실제로 측정 중 한 호출이 25분을 매달린 적이 있다.
 *
 * 정상 생성이 5~20초라 20초로 끊는다. 끊긴 시도는 transient로 분류되어
 * (AbortSignal.timeout의 메시지에 timeout이 들어간다) 다음 모델로 넘어간다.
 */
const ATTEMPT_TIMEOUT_MS = 20_000
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
        return await invoke<T>(
          attempt.apiKey,
          { ...args, model: attempt.model },
          AbortSignal.timeout(deps.attemptTimeoutMs ?? ATTEMPT_TIMEOUT_MS),
        )
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
