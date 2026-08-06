import { timingSafeEqual } from 'node:crypto'

/** 길이가 다르면 timingSafeEqual이 던진다. 길이 비교를 먼저 한다 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * GitHub Actions만 부를 수 있게 한다.
 *
 * CRON_SECRET이 없으면 잠근다. 설정이 빠졌을 때 열어두면 누구나 부를 수 있고,
 * 그 사실을 아무도 모른 채로 지나간다.
 *
 * 발행과 목록 두 라우트가 같은 판단을 쓴다. 한쪽만 고치면 다른 쪽이 조용히
 * 열리므로 한자리에 둔다.
 */
export function authorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (bearer && safeEqual(bearer, secret)) return true

  const alt = request.headers.get('x-cron-secret')?.trim() ?? ''
  return alt.length > 0 && safeEqual(alt, secret)
}
