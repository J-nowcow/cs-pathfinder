import type { StructuredCaller } from '@/lib/llm/client'
import { stubCaller } from '@/lib/llm/dev-stub'

/**
 * 어떤 caller를 쓸지 정한다.
 *
 * 키가 있으면 undefined를 낸다. 호출부가 기본값인 realCaller를 쓰게 하기 위해서다.
 * 이 함수가 realCaller를 직접 반환하면 AI SDK가 항상 로드된다.
 */
export function resolveCaller(): StructuredCaller | undefined {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
  return key ? undefined : stubCaller
}
