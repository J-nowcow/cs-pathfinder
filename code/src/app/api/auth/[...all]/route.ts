import { getAuth } from '@/lib/auth'

/**
 * better-auth의 모든 경로가 여기로 든다 — /api/auth/sign-in/social,
 * /api/auth/callback/google, /api/auth/get-session 전부.
 *
 * 인스턴스가 async(풀을 기다린다)라 toNextJsHandler를 못 쓰고 직접 넘긴다.
 * handler는 표준 Request→Response라 그대로 반환하면 된다.
 */
export async function GET(request: Request): Promise<Response> {
  const auth = await getAuth()
  return auth.handler(request)
}

export async function POST(request: Request): Promise<Response> {
  const auth = await getAuth()
  return auth.handler(request)
}
