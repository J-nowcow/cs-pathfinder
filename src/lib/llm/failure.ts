export type FailureKind = 'quota' | 'auth' | 'transient' | 'fatal'

/**
 * 실패 종류에 따라 폴백 경로가 다르다.
 *
 * - quota  → 같은 키의 다른 모델, 또는 다음 키. 모델마다 한도 버킷이 다르다
 * - auth   → 이 키는 이번 실행 내내 건너뛴다. 다른 모델로 재시도해봐야 똑같다
 * - transient → 같은 조합을 한 번 더. 서버 일시 장애다
 * - fatal  → 프롬프트나 스키마 문제다. 폴백해도 같은 결과라 즉시 중단한다
 *
 * SDK가 오류 형태를 보장하지 않아 문자열로 분류한다. 넓게 잡아 오분류하면
 * 폴백을 한 번 더 도는 정도라 손해가 작다. 반대로 좁게 잡아 fatal로 떨구면
 * 살릴 수 있는 요청이 죽는다.
 */
export function classifyFailure(error: unknown): FailureKind {
  const text = describe(error).toLowerCase()

  if (
    text.includes('resource_exhausted') ||
    text.includes('429') ||
    text.includes('quota') ||
    text.includes('rate limit') ||
    text.includes('too many requests')
  ) {
    return 'quota'
  }

  if (
    text.includes('api_key_invalid') ||
    text.includes('api key not valid') ||
    text.includes('permission_denied') ||
    text.includes('unauthenticated') ||
    text.includes('401') ||
    text.includes('403')
  ) {
    return 'auth'
  }

  if (
    text.includes('unavailable') ||
    text.includes('overloaded') ||
    text.includes('deadline') ||
    text.includes('timeout') ||
    text.includes('econnreset') ||
    text.includes('500') ||
    text.includes('502') ||
    text.includes('503') ||
    text.includes('504')
  ) {
    return 'transient'
  }

  return 'fatal'
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause ? ` ${describe(error.cause)}` : ''
    const status = (error as { statusCode?: number }).statusCode ?? ''
    return `${error.name} ${error.message} ${status}${cause}`
  }
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
