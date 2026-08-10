import { getAuth } from '@/lib/auth'

/**
 * 요청에서 로그인 사용자를 읽는 유일한 통로.
 *
 * 세션이 없으면 null — 예외가 아니다. better-auth의 getSession도 그렇다.
 *
 * 별도 파일인 이유: `getAuth()`는 PGlite(테스트)에서 던지므로, 세션이
 * 필요한 라우트의 시험은 이 모듈 하나만 `vi.mock`으로 갈아끼우면 된다.
 * 라우트마다 auth 전체를 목킹하게 하면 시험이 라이브러리 내부 모양에
 * 묶인다.
 *
 * 사용자 식별은 오직 여기서 — 요청 body의 사용자 식별자는 절대 신뢰하지
 * 않는다 (quota/key.ts가 같은 방침을 적어 뒀다).
 */
export async function readUserId(headers: Headers): Promise<string | null> {
  const auth = await getAuth()
  const found = await auth.api.getSession({ headers })
  return found?.user.id ?? null
}
