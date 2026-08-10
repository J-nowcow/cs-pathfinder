import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'

/**
 * 여정 라우트의 약속.
 *
 * - 세션 없으면 401이고 DB는 그대로다 — 인증 게이트를 지우면 여기서 잡힌다
 * - 문장은 qnode에서 실어 온다 — 클라이언트 문장을 믿는 순간 남의 화면에
 *   임의 텍스트를 띄우는 통로가 열린다 (share와 같은 결정)
 * - 개인 기록이라 절대 캐시하지 않는다
 *
 * 세션은 auth/session 모듈만 목킹한다. getAuth()는 PGlite에서 던지므로
 * 그 아래를 목킹하면 시험이 라이브러리 내부 모양에 묶인다.
 */
const mockUserId = vi.hoisted(() => ({ value: null as string | null }))
vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => mockUserId.value,
}))

const { GET } = await import('@/app/api/journey/route')
const { POST } = await import('@/app/api/journey/merge/route')

function getReq() {
  return new Request('http://localhost/api/journey')
}
function postReq(body: unknown) {
  return new Request('http://localhost/api/journey/merge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const node = (q: string) =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: q,
    body: '해설',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

async function seedUser(id = 'user-1') {
  const db = await getDb()
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified") values ($1, '', 'u@example.com', true)`,
    [id],
  )
  return id
}

beforeEach(async () => {
  await truncateAll()
  mockUserId.value = null
})

describe('GET /api/journey', () => {
  it('R1 세션 없으면 401', async () => {
    const res = await GET(getReq())
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('unauthorized')
  })

  it('빈 사용자는 빈 스냅샷, 캐시 금지', async () => {
    mockUserId.value = await seedUser()
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const body = await res.json()
    expect(body.occurrences).toEqual([])
    expect(body.current_id).toBeNull()
  })
})

describe('POST /api/journey/merge', () => {
  it('R1 세션 없으면 401이고 DB에 아무것도 안 남는다', async () => {
    const a = await node('뿌리는?')
    const res = await POST(postReq({ occurrences: [{ id: 'a', node_id: a, parent_id: null }], current_id: 'a' }))
    expect(res.status).toBe(401)
    const db = await getDb()
    const rows = await db.query<{ c: number }>(`select count(*)::int c from journey_occurrence`)
    expect(rows[0].c).toBe(0)
  })

  it('R2 문장은 qnode에서 온다 — 요청에 문장을 실어도 무시된다', async () => {
    mockUserId.value = await seedUser()
    const a = await node('진짜 질문?')
    const res = await POST(
      postReq({
        occurrences: [{ id: 'a', node_id: a, parent_id: null, question: '<script>주입</script>' }],
        current_id: 'a',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.occurrences[0].question).toBe('진짜 질문?')
  })

  it('R4 병합 후 전체 세트를 돌려준다 — 2왕복이 필요 없다', async () => {
    mockUserId.value = await seedUser()
    const a = await node('뿌리는?')
    const b = await node('그 다음은?')
    await POST(postReq({ occurrences: [{ id: 'x', node_id: a, parent_id: null }], current_id: 'x' }))
    const res = await POST(
      postReq({
        occurrences: [
          { id: 'p', node_id: a, parent_id: null },
          { id: 'q', node_id: b, parent_id: 'p' },
        ],
        current_id: 'q',
      }),
    )
    const body = await res.json()
    expect(body.occurrences).toHaveLength(2)
    expect(body.current_id).toBe(body.occurrences.find((o: { node_id: string }) => o.node_id === b).id)
  })

  it('잘못된 forest는 400', async () => {
    mockUserId.value = await seedUser()
    const a = await node('뿌리는?')
    const res = await POST(
      postReq({ occurrences: [{ id: 'a', node_id: a, parent_id: 'ghost' }], current_id: null }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_forest')
  })

  it('모르는 노드만 있으면 200에 빈 세트 — 거부가 아니라 드롭이다', async () => {
    // 재시드로 사라진 노드가 localStorage에 남은 사용자도 동기화는 돼야 한다
    mockUserId.value = await seedUser()
    const res = await POST(
      postReq({
        occurrences: [
          { id: 'a', node_id: '99999999-9999-9999-9999-999999999999', parent_id: null },
        ],
        current_id: null,
      }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).occurrences).toEqual([])
  })
})
