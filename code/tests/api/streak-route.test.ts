import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'

/** 잔디 라우트 — 여정과 같은 인증 게이트, 합집합 응답 (R5·R6) */
const mockUserId = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => mockUserId.value,
}))

const { POST } = await import('@/app/api/streak/merge/route')

function postReq(body: unknown) {
  return new Request('http://localhost/api/streak/merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await truncateAll()
  mockUserId.value = null
})

describe('POST /api/streak/merge', () => {
  it('R5 세션 없으면 401이고 DB 무변화', async () => {
    const res = await POST(postReq({ days: { '2026-08-01': [] } }))
    expect(res.status).toBe(401)
  })

  it('R6 병합 후 서버 전체 days를 돌려준다', async () => {
    const db = await getDb()
    await db.query(
      `insert into "user" ("id", "name", "email", "emailVerified") values ('user-1', '', 'u@example.com', true)`,
    )
    mockUserId.value = 'user-1'
    const a = await insertNode({
      identityScope: 'network',
      normalizedQuestion: '질문?',
      body: '해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })

    await POST(postReq({ days: { '2026-08-01': [a] } }))
    const res = await POST(postReq({ days: { '2026-08-02': [a] } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const body = await res.json()
    expect(Object.keys(body.days).sort()).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('망가진 body는 400', async () => {
    mockUserId.value = 'user-1'
    const res = await POST(postReq({ days: '엉망' }))
    expect(res.status).toBe(400)
  })
})
