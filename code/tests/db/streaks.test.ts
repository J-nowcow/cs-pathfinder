import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { resetSeedCache } from '@/lib/db/bootstrap'
import { mergeStreakForUser } from '@/lib/db/streaks'

/**
 * 잔디 서버 병합 — 멱등이고, 모르는 노드는 조용히 버린다.
 *
 * 여정과 달리 구조가 없어(개수뿐) 한 항목이 이상해도 전체를 거부할
 * 이유가 없다. 다만 남는 것은 실재하는 노드뿐이어야 한다.
 */
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
})

const U = 'user-1'
const NODE_A = '11111111-1111-1111-1111-111111111111'

async function seed() {
  const db = await getDb()
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified") values ($1, '', 'u@example.com', true)`,
    [U],
  )
  await db.query(
    `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin)
     values ($1, 'concept', '질문 A?', '본문', '네트워크', 'ready', 'batch')`,
    [NODE_A],
  )
}

describe('mergeStreakForUser', () => {
  it('D8 같은 days를 두 번 보내도 행이 안 늘고, 전체 맵을 돌려준다', async () => {
    await seed()
    const days = { '2026-08-01': [NODE_A] }
    const first = await mergeStreakForUser(U, days)
    const again = await mergeStreakForUser(U, days)
    expect(first.days['2026-08-01']).toEqual([NODE_A])
    expect(again.days['2026-08-01']).toEqual([NODE_A])

    const db = await getDb()
    const rows = await db.query<{ c: number }>(`select count(*)::int c from streak_read`)
    expect(rows[0].c).toBe(1)
  })

  it('D9 모르는 노드는 조용히 버리고 나머지는 남는다', async () => {
    await seed()
    const out = await mergeStreakForUser(U, {
      '2026-08-01': [NODE_A, '99999999-9999-9999-9999-999999999999'],
    })
    expect(out.days['2026-08-01']).toEqual([NODE_A])
  })

  it('uuid 모양이 아닌 값도 조용히 버린다 — 캐스팅 오류로 500이 나면 안 된다', async () => {
    await seed()
    const out = await mergeStreakForUser(U, { '2026-08-01': [NODE_A, 'not-a-uuid'] })
    expect(out.days['2026-08-01']).toEqual([NODE_A])
  })

  it('사용자를 지우면 잔디가 따라 지워진다 — 파기 의무', async () => {
    await seed()
    await mergeStreakForUser(U, { '2026-08-01': [NODE_A] })
    const db = await getDb()
    await db.query(`delete from "user" where "id" = $1`, [U])
    const rows = await db.query<{ c: number }>(`select count(*)::int c from streak_read`)
    expect(rows[0].c).toBe(0)
  })
})
