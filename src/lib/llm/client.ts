import type { ZodType } from 'zod'

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
 * 실제 호출.
 *
 * AI SDK를 지연 로딩한다. API 키가 없는 환경에서 모듈을 임포트만 해도
 * 실패하는 것을 막기 위해서다.
 */
export const realCaller: StructuredCaller = async <T>({
  model,
  schema,
  system,
  prompt,
}: StructuredCallArgs<T>): Promise<T> => {
  const [{ google }, { generateObject }] = await Promise.all([
    import('@ai-sdk/google'),
    import('ai'),
  ])

  const { object } = await generateObject({
    model: google(model),
    schema: schema as never,
    system,
    prompt,
  })

  return object as T
}
