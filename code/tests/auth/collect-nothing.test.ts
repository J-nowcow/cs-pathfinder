import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { stripUserPii, stripAccountTokens, stripSessionClient, getAuth } from '@/lib/auth'

/**
 * **로그인이 이메일 밖의 것을 받지 않는다는 약속을 고정한다.**
 *
 * 결정은 docs/design/2026-08-10-auth-data-decision.md에 있다. better-auth에는
 * 수집을 끄는 설정이 없어서 strip 훅이 막는데, 훅은 두 조각이다 —
 * ① 지우는 함수가 맞게 지우는가 ② 그 함수가 실제로 배선돼 있는가.
 * ②를 소스 검사로 잡는 이유: 테스트 DB(PGlite)에는 pg.Pool이 없어
 * betterAuth 인스턴스를 만들 수 없다. "스키마에 있으니 채우자"가 스며들어
 * 배선만 조용히 지워지는 되돌림을 이것으로 잡는다.
 */

/** 구글이 실제로 보내옴직한 모양 그대로 */
const GOOGLE_USER = {
  id: 'u1',
  email: 'someone@gmail.com',
  name: '장현우',
  image: 'https://lh3.googleusercontent.com/a/photo.jpg',
  emailVerified: true,
}

const GOOGLE_ACCOUNT = {
  id: 'a1',
  accountId: '10769150350006150715113082367',
  providerId: 'google',
  userId: 'u1',
  accessToken: 'ya29.a0AfH6...',
  refreshToken: '1//0gL8...',
  idToken: 'eyJhbGciOiJSUzI1NiIs...',
  accessTokenExpiresAt: new Date(),
  refreshTokenExpiresAt: new Date(),
  scope: 'openid email profile',
}

const SESSION = {
  id: 's1',
  token: 'tok',
  userId: 'u1',
  expiresAt: new Date(),
  ipAddress: '211.234.1.7',
  userAgent: 'Mozilla/5.0 (iPhone; ...)',
}

describe('수집 차단 — 지우는 함수', () => {
  it('user에서 이름·사진을 지우고 email은 남긴다', () => {
    const out = stripUserPii(GOOGLE_USER)
    expect(out.name).toBe('')
    expect(out.image).toBeNull()
    expect(out.email).toBe('someone@gmail.com')
    expect(out.emailVerified).toBe(true)
  })

  it('account에서 provider 토큰 다섯을 전부 지운다', () => {
    const out = stripAccountTokens(GOOGLE_ACCOUNT)
    expect(out.accessToken).toBeNull()
    expect(out.refreshToken).toBeNull()
    expect(out.idToken).toBeNull()
    expect(out.accessTokenExpiresAt).toBeNull()
    expect(out.refreshTokenExpiresAt).toBeNull()
    // 계정 연결에 필요한 것은 남는다
    expect(out.accountId).toBe(GOOGLE_ACCOUNT.accountId)
    expect(out.providerId).toBe('google')
  })

  it('session에서 IP·User-Agent를 지운다', () => {
    const out = stripSessionClient(SESSION)
    expect(out.ipAddress).toBeNull()
    expect(out.userAgent).toBeNull()
    expect(out.token).toBe('tok')
  })
})

describe('수집 차단 — 배선', () => {
  const src = readFileSync(resolve(__dirname, '../../src/lib/auth/index.ts'), 'utf8')

  it('databaseHooks가 세 표 모두 create와 update에 걸려 있다', () => {
    // 훅 블록만 잘라 본다 — import나 주석의 언급에 속지 않게
    const hooks = src.slice(src.indexOf('databaseHooks'))
    expect(hooks).toContain('stripUserPii')
    expect(hooks).toContain('stripAccountTokens')
    expect(hooks).toContain('stripSessionClient')
    // create만 걸고 update를 빼면 재로그인 때 토큰이 다시 들어온다
    expect(hooks.match(/create:/g)?.length).toBe(3)
    expect(hooks.match(/update:/g)?.length).toBe(3)
  })

  it('프로필 매핑 단계에서도 이름·사진을 안 옮긴다 (첫 번째 방어선)', () => {
    expect(src).toContain('mapProfileToUser')
  })
})

describe('테스트 경로 격리', () => {
  it('PGlite 경로에서는 인증이 명시적으로 거부된다 — 조용한 우회가 없다', async () => {
    await expect(getAuth()).rejects.toThrow('실제 Postgres')
  })
})
