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
  return cronAuth(request) === 'ok'
}

/**
 * 왜 막혔는지까지 돌려준다.
 *
 * 발행이 사람 없는 새벽에 도는데 실패 로그에 `{"error":"unauthorized"}` 한 줄만
 * 남았다. **그 한 줄로는 아무것도 못 가린다** — 서버에 값이 아예 없는 것인지,
 * 있는데 부르는 쪽과 다른 것인지. 실제로 이틀치 실패를 두고 어느 쪽인지
 * 알아내려다 시간을 다 썼다.
 *
 * 둘은 고치는 자리가 다르다. 없으면 Vercel 환경변수를 넣고 **다시 배포**해야
 * 하고(환경변수는 배포 시점에 박히므로 나중에 넣으면 옛 배포에는 없다),
 * 다르면 GitHub 시크릿과 값을 맞춰야 한다.
 *
 * **값에 대해서는 아무것도 안 흘린다.** 길이도 일부도 안 준다. "서버에 설정이
 * 있느냐"만 말하는데, 설정이 없으면 어차피 전부 막히므로 그것을 아는 것이
 * 공격에 도움이 안 된다.
 */
export type CronAuth = 'ok' | 'not_configured' | 'bad_credentials'

export function cronAuth(request: Request): CronAuth {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return 'not_configured'

  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (bearer && safeEqual(bearer, secret)) return 'ok'

  const alt = request.headers.get('x-cron-secret')?.trim() ?? ''
  if (alt.length > 0 && safeEqual(alt, secret)) return 'ok'

  return 'bad_credentials'
}
