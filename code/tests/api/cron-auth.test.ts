import { describe, it, expect, afterEach } from 'vitest'
import { cronAuth, authorizedCron } from '@/lib/api/cron-auth'

/**
 * 왜 막혔는지 말해 주는가.
 *
 * 발행이 사람 없는 새벽에 돈다. 실패 로그에 `{"error":"unauthorized"}` 한 줄만
 * 남아서 **이틀치 실패를 두고 원인을 못 가렸다** — 서버에 값이 없는 것인지,
 * 있는데 부르는 쪽과 다른 것인지.
 *
 * 둘은 고치는 자리가 다르다. 없으면 환경변수를 넣고 다시 배포해야 하고,
 * 다르면 시크릿 값을 맞춰야 한다.
 */
const req = (headers: Record<string, string> = {}) => new Request('https://x/', { headers })

afterEach(() => {
  delete process.env.CRON_SECRET
})

describe('cronAuth', () => {
  it('맞으면 통과한다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(cronAuth(req({ authorization: 'Bearer abc123' }))).toBe('ok')
  })

  it('x-cron-secret 머리로도 통과한다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(cronAuth(req({ 'x-cron-secret': 'abc123' }))).toBe('ok')
  })

  /* 이게 이 시험의 이유다. 둘을 가려야 어디를 고칠지 안다 */
  it('서버에 값이 없으면 not_configured다', () => {
    expect(cronAuth(req({ authorization: 'Bearer abc123' }))).toBe('not_configured')
  })

  it('값이 다르면 bad_credentials다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(cronAuth(req({ authorization: 'Bearer wrong' }))).toBe('bad_credentials')
  })

  it('머리가 아예 없어도 bad_credentials다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(cronAuth(req())).toBe('bad_credentials')
  })

  /* 길이가 다르면 timingSafeEqual이 던진다. 길이 비교가 먼저다 */
  it('길이가 달라도 안 던진다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(cronAuth(req({ authorization: 'Bearer a' }))).toBe('bad_credentials')
  })

  it('예전 이름도 그대로 동작한다', () => {
    process.env.CRON_SECRET = 'abc123'
    expect(authorizedCron(req({ authorization: 'Bearer abc123' }))).toBe(true)
    expect(authorizedCron(req({ authorization: 'Bearer wrong' }))).toBe(false)
  })
})
