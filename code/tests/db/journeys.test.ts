import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { resetSeedCache } from '@/lib/db/bootstrap'
import { mergeJourneyForUser, loadJourneyForUser } from '@/lib/db/journeys'

/**
 * 서버 병합의 약속을 고정한다.
 *
 * - 멱등: 같은 forest를 두 번 보내도 행이 안 는다 (응답 유실 후 재시도 대비)
 * - 정체성 = pathKey: 브라우저마다 다른 occurrence id로는 안 접힌다
 * - 원자성: unknown node가 하나라도 있으면 아무것도 안 남는다
 * - 파기: 사용자 행을 지우면 여정·커서가 따라 지워진다 (개인정보 파기 의무)
 */
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
})

const U = 'user-1'
const NODE_A = '11111111-1111-1111-1111-111111111111'
const NODE_B = '22222222-2222-2222-2222-222222222222'

async function seedUserAndNodes() {
  const db = await getDb()
  await db.query(
    `insert into "user" ("id", "name", "email", "emailVerified") values ($1, '', 'u@example.com', true)`,
    [U],
  )
  for (const [id, q] of [
    [NODE_A, '질문 A?'],
    [NODE_B, '질문 B?'],
  ]) {
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin)
       values ($1, 'concept', $2, '본문', '네트워크', 'ready', 'batch')`,
      [id, q],
    )
  }
}

/** 클라이언트 A→B 제출 모양 */
function forestAB() {
  return [
    { id: 'local-1', nodeId: NODE_A, parentId: null },
    { id: 'local-2', nodeId: NODE_B, parentId: 'local-1' },
  ]
}

describe('mergeJourneyForUser', () => {
  it('D1 같은 forest를 두 번 보내도 행 수가 안 변한다', async () => {
    await seedUserAndNodes()
    const first = await mergeJourneyForUser(U, forestAB(), 'local-2')
    expect(first.kind).toBe('ok')

    const again = await mergeJourneyForUser(U, forestAB(), 'local-2')
    expect(again.kind).toBe('ok')

    const db = await getDb()
    const rows = await db.query<{ c: number }>(
      `select count(*)::int c from journey_occurrence where user_id = $1`,
      [U],
    )
    expect(rows[0].c).toBe(2)
  })

  it('D2 다른 브라우저 id라도 같은 경로면 한 행으로 접힌다', async () => {
    await seedUserAndNodes()
    await mergeJourneyForUser(U, forestAB(), null)
    await mergeJourneyForUser(
      U,
      [
        { id: 'other-9', nodeId: NODE_A, parentId: null },
        { id: 'other-8', nodeId: NODE_B, parentId: 'other-9' },
      ],
      null,
    )
    const db = await getDb()
    const rows = await db.query<{ c: number }>(
      `select count(*)::int c from journey_occurrence where user_id = $1`,
      [U],
    )
    expect(rows[0].c).toBe(2)
  })

  it('D3 다른 경로로 같은 노드에 닿으면 두 행이다 — visit 의미론', async () => {
    await seedUserAndNodes()
    await mergeJourneyForUser(U, forestAB(), null) // A>B
    await mergeJourneyForUser(U, [{ id: 'x', nodeId: NODE_B, parentId: null }], null) // B (뿌리)
    const db = await getDb()
    const rows = await db.query<{ c: number }>(
      `select count(*)::int c from journey_occurrence where user_id = $1 and qnode_id = $2`,
      [U, NODE_B],
    )
    expect(rows[0].c).toBe(2)
  })

  it('D4 부모가 서버 id로 이어지고 position은 부모가 앞이다', async () => {
    await seedUserAndNodes()
    const out = await mergeJourneyForUser(U, forestAB(), null)
    if (out.kind !== 'ok') throw new Error(out.kind)

    const db = await getDb()
    const rows = await db.query<{
      id: string
      parent_occurrence_id: string | null
      position: number
    }>(`select id, parent_occurrence_id, position from journey_occurrence where user_id = $1 order by position`, [U])
    expect(rows[0].parent_occurrence_id).toBeNull()
    expect(rows[1].parent_occurrence_id).toBe(rows[0].id)
    expect(rows[0].position).toBeLessThan(rows[1].position)
  })

  it('D5 모르는 노드가 하나라도 있으면 아무것도 안 남는다', async () => {
    await seedUserAndNodes()
    const out = await mergeJourneyForUser(
      U,
      [
        { id: 'a', nodeId: NODE_A, parentId: null },
        { id: 'b', nodeId: '99999999-9999-9999-9999-999999999999', parentId: 'a' },
      ],
      null,
    )
    expect(out.kind).toBe('unknown_node')
    const db = await getDb()
    const rows = await db.query<{ c: number }>(
      `select count(*)::int c from journey_occurrence where user_id = $1`,
      [U],
    )
    expect(rows[0].c).toBe(0)
  })

  it('D6 손상 forest(없는 부모·중복 id)는 거부한다', async () => {
    await seedUserAndNodes()
    const orphan = await mergeJourneyForUser(
      U,
      [{ id: 'a', nodeId: NODE_A, parentId: 'ghost' }],
      null,
    )
    expect(orphan.kind).toBe('invalid_forest')

    const dup = await mergeJourneyForUser(
      U,
      [
        { id: 'a', nodeId: NODE_A, parentId: null },
        { id: 'a', nodeId: NODE_B, parentId: null },
      ],
      null,
    )
    expect(dup.kind).toBe('invalid_forest')
  })

  it('D7 사용자를 지우면 여정과 커서가 따라 지워진다 — 파기 의무', async () => {
    await seedUserAndNodes()
    await mergeJourneyForUser(U, forestAB(), 'local-2')
    const db = await getDb()
    await db.query(`delete from "user" where "id" = $1`, [U])
    const occ = await db.query<{ c: number }>(`select count(*)::int c from journey_occurrence`)
    const cur = await db.query<{ c: number }>(`select count(*)::int c from journey_cursor`)
    expect(occ[0].c).toBe(0)
    expect(cur[0].c).toBe(0)
  })

  it('병합 응답이 전체 세트를 qnode의 문장으로 돌려준다 — 클라이언트 문장은 안 믿는다', async () => {
    await seedUserAndNodes()
    const out = await mergeJourneyForUser(U, forestAB(), 'local-2')
    if (out.kind !== 'ok') throw new Error(out.kind)
    expect(out.journey.occurrences).toHaveLength(2)
    expect(out.journey.occurrences[0].question).toBe('질문 A?')
    expect(out.journey.occurrences[0].category).toBe('네트워크')
    // 커서는 제출 currentId(local-2)의 경로에 해당하는 서버 행
    const b = out.journey.occurrences.find((o) => o.nodeId === NODE_B)!
    expect(out.journey.currentId).toBe(b.id)
  })
})

describe('loadJourneyForUser', () => {
  it('빈 사용자는 빈 스냅샷', async () => {
    await seedUserAndNodes()
    const snap = await loadJourneyForUser(U)
    expect(snap.occurrences).toEqual([])
    expect(snap.currentId).toBeNull()
  })
})
