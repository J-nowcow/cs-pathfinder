import { createAuthClient } from 'better-auth/react'

/**
 * 브라우저 쪽 인증 손잡이. baseURL을 안 주면 같은 origin의 /api/auth를
 * 본다 — 우리 라우트가 정확히 거기 있다.
 */
export const authClient = createAuthClient()
