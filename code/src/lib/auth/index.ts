import { getPool } from '@/lib/db/client'

/**
 * 로그인이 저장하는 것 — email과 세션뿐이다.
 *
 * 항목별 결정은 `docs/design/2026-08-10-auth-data-decision.md`에 있다.
 * 구글이 보내와도 **받지 않는 것**: 이름·프로필 사진·provider 토큰 3종·
 * 세션의 IP·User-Agent. 안 쓰는 것은 안 받는 것이 지키기 쉽다 —
 * 받아 놓고 안 쓰는 것은 방침 위반이 자라는 자리다.
 *
 * better-auth에는 이 필드들의 수집을 끄는 설정이 없다(1.6.26에서 확인).
 * 컬럼은 생기되 **항상 비어 있게** 아래 strip 훅으로 막고, 그 사실을
 * `tests/auth/collect-nothing.test.ts`가 고정한다.
 */

/** user 행에서 개인정보를 지운다. email은 계정 식별에 필요해 남긴다. */
export function stripUserPii<T extends Record<string, unknown>>(user: T): T {
  // name은 not null 컬럼이라 빈 문자열로 둔다. 표시할 화면이 없다.
  return { ...user, name: '', image: null }
}

/**
 * provider 토큰을 지운다.
 *
 * 구글 API를 재호출할 일이 없다 — 로그인 확인이 전부다. 토큰을 장기
 * 보관하면 유출 시 피해가 로그인 밖으로 번진다. 재로그인 때 update로
 * 다시 들어오므로 create와 update 양쪽에 걸어야 한다.
 */
export function stripAccountTokens<T extends Record<string, unknown>>(account: T): T {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  }
}

/**
 * 세션에서 IP·User-Agent를 지운다.
 *
 * 공표된 방침이 "IP는 하루 한도에만"이다. 기기별 로그아웃 화면이
 * 없으니 쓸 곳도 없다.
 */
export function stripSessionClient<T extends Record<string, unknown>>(session: T): T {
  return { ...session, ipAddress: null, userAgent: null }
}

/**
 * 우리가 쓰는 표면만 좁혀 둔 타입.
 *
 * betterAuth의 반환 타입은 옵션에 종속된 제네릭이라 그대로 이름 붙이면
 * 옵션이 조금만 달라져도 할당이 깨진다. handler와 getSession만 쓴다 —
 * getSession은 C4(여정 서버 저장)가 라우트에서 세션을 읽는 자리다.
 */
export interface Auth {
  handler: (request: Request) => Promise<Response>
  api: {
    getSession: (ctx: {
      headers: Headers
    }) => Promise<{ session: { userId: string }; user: { id: string; email: string } } | null>
  }
}

/**
 * 인스턴스는 약속으로 캐싱한다 — `db/client.ts`의 `getDb`와 같은 이유다.
 * 결과만 캐싱하면 동시 요청이 인스턴스를 여러 개 만든다.
 */
let opening: Promise<Auth> | null = null

export async function getAuth(): Promise<Auth> {
  if (!opening) {
    opening = create().catch((e) => {
      opening = null
      throw e
    })
  }
  return opening
}

async function create(): Promise<Auth> {
  const pool = await getPool()
  /*
   * PGlite 경로(테스트)에는 pg.Pool이 없다. 조용히 우회하지 않고 바로
   * 말한다 — 로그인은 실제 Postgres에서만 돈다.
   */
  if (!pool) {
    throw new Error('로그인은 실제 Postgres에서만 돈다. PGlite 경로에는 인증이 없다.')
  }

  const { betterAuth } = await import('better-auth')
  return betterAuth({
    database: pool,
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID ?? '',
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
        /*
         * 첫 번째 방어선 — 프로필에서 이름·사진을 아예 안 옮긴다.
         * 아래 databaseHooks가 두 번째 방어선이다. 하나만 두면 라이브러리
         * 업데이트가 경로를 바꿨을 때 조용히 새기 시작한다.
         */
        mapProfileToUser: () => ({ name: '', image: undefined }),
      },
    },
    databaseHooks: {
      user: {
        create: { before: async (user) => ({ data: stripUserPii(user) }) },
        update: { before: async (user) => ({ data: stripUserPii(user) }) },
      },
      account: {
        create: { before: async (account) => ({ data: stripAccountTokens(account) }) },
        update: { before: async (account) => ({ data: stripAccountTokens(account) }) },
      },
      session: {
        create: { before: async (session) => ({ data: stripSessionClient(session) }) },
        update: { before: async (session) => ({ data: stripSessionClient(session) }) },
      },
    },
  })
}
