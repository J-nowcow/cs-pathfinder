/**
 * 익명 사용자 식별 키.
 *
 * 확장 API와 읽기 화면이 **같은 키를 만들어야 한다.** 화면은 남은 횟수를 보여주려고
 * 이 키로 조회하고, API는 이 키로 차감한다. 둘이 어긋나면 화면이 남았다고 하는데
 * 눌러보면 막히거나 그 반대가 된다.
 *
 * 예전에는 API 라우트 안에만 있었다. 화면에서 같은 값이 필요해지면서 밖으로 뺐다.
 *
 * 인증이 붙으면 검증된 세션 UID를 우선한다. 요청 body의 사용자 식별자는
 * 절대 신뢰하지 않는다.
 */
export function quotaKeyFromHeaders(headers: {
  get(name: string): string | null
}): string {
  const forwarded = headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return `anon:${ip}`
}

/**
 * 익명 하루 한도.
 *
 * 캐시에 걸리면 차감하지 않는다. 그래서 이 숫자는 "새로 만드는 질문"의 상한이다.
 * 다만 그래프가 작을수록 새 생성이 많아서, 서비스가 가장 비어 있을 때 사용자가
 * 가장 빨리 막힌다. 값은 환경변수로 뺀다.
 */
export function anonDailyLimit(): number {
  const raw = Number(process.env.QUOTA_ANON_DAILY)
  return Number.isFinite(raw) && raw > 0 ? raw : 5
}
