import { getDb } from '@/lib/db/client'
import type { StreakState } from '@/lib/streak/storage'

/**
 * 잔디의 서버 쪽 절반 (C4).
 *
 * 여정과 달리 구조가 없다 — (날짜, 노드) 쌍의 집합이다. 그래서 병합도
 * insert on conflict do nothing 뿐이고, 한 항목이 이상해도 전체를 거부하지
 * 않는다. 모르는 노드는 조용히 버린다 — 개수지 구조가 아니다.
 *
 * 날짜는 클라이언트의 KST 판정을 그대로 받는다. 서버가 now()로 다시
 * 정하면 자정 근처 업로드가 다른 날로 적힌다.
 */

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 병합하고, 서버가 든 전체 days 맵을 돌려준다 */
export async function mergeStreakForUser(
  userId: string,
  days: Record<string, string[]>,
): Promise<StreakState> {
  const db = await getDb()

  // 모양부터 거른다 — uuid가 아닌 값이 캐스팅에서 500을 내면 안 된다
  const pairs: Array<{ date: string; nodeId: string }> = []
  for (const [date, ids] of Object.entries(days)) {
    if (!DATE_SHAPE.test(date)) continue
    for (const id of ids) {
      if (UUID_SHAPE.test(id)) pairs.push({ date, nodeId: id })
    }
  }

  if (pairs.length > 0) {
    // 실재하는 노드만 남긴다
    const nodeIds = [...new Set(pairs.map((p) => p.nodeId))]
    const found = await db.query<{ id: string }>(
      `select id from qnode where id = any($1::uuid[])`,
      [nodeIds],
    )
    const exists = new Set(found.map((r) => r.id))
    const valid = pairs.filter((p) => exists.has(p.nodeId))

    if (valid.length > 0) {
      await db.query(
        `insert into streak_read (user_id, read_date, qnode_id)
         select $1, d, n
           from unnest($2::date[], $3::uuid[]) as t(d, n)
         on conflict (user_id, read_date, qnode_id) do nothing`,
        [userId, valid.map((p) => p.date), valid.map((p) => p.nodeId)],
      )
    }
  }

  return loadStreakForUser(userId)
}

export async function loadStreakForUser(userId: string): Promise<StreakState> {
  const db = await getDb()
  const rows = await db.query<{ read_date: string; qnode_id: string }>(
    `select to_char(read_date, 'YYYY-MM-DD') as read_date, qnode_id
       from streak_read
      where user_id = $1
      order by read_date, created_at`,
    [userId],
  )
  const days: Record<string, string[]> = {}
  for (const r of rows) {
    ;(days[r.read_date] ??= []).push(r.qnode_id)
  }
  return { days }
}
