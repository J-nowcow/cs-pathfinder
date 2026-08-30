import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { relatedForDisplay } from '@/lib/expand/nodes'

/**
 * **접힌 잉여를 관련 질문에 세우지 않는다.**
 *
 * `qnode_equivalence`가 중복 쌍을 접고 `equivalence.ts` 주석은 "화면(목록·지도)은
 * 정본만 세운다"고 적어 두었다. 그런데 `NOT_FOLDED_SQL`을 쓰는 곳이 `roots.ts`와
 * `graph.ts`뿐이라 **관련 질문 경로가 빠져 있었다.**
 *
 * 실제로 `/q/411`의 관련 질문에 `인덱스 생성 시 읽기 성능과…`와
 * `인덱스 생성 시 조회 성능과…`가 나란히 떴다. 뒤엣것은 이미 접힌 잉여다.
 *
 * 벡터 경로가 더 나빴다. 접기 후보였던 쌍은 임베딩 유사도가 0.90+라
 * 문턱(`RELATION_MIN_SIMILARITY` 0.76)을 늘 넘고, 거리 오름차순으로 정렬하니
 * **잉여가 목록 1번으로 올라온다.** 방금 읽은 질문과 사실상 같은 것을
 * "이것도 보라"고 권하는 자리였다.
 */
beforeEach(async () => {
  await resetDb()
})

const CANON = '11111111-0000-0000-0000-000000000001'
const FOLDED = '11111111-0000-0000-0000-000000000002'
const OTHER = '11111111-0000-0000-0000-000000000003'
const ME = '11111111-0000-0000-0000-000000000004'

async function seed() {
  const db = await getDb()
  const rows: Array<[string, string, number]> = [
    [CANON, '인덱스 생성 시 읽기 성능과 쓰기 성능의 트레이드오프는?', 101],
    [FOLDED, '인덱스 생성 시 조회 성능과 쓰기 성능의 트레이드오프는?', 102],
    [OTHER, '인덱스를 어느 칸부터 놓아야 하는가?', 103],
    [ME, '트라이의 공간 복잡도 한계는 무엇인가?', 104],
  ]
  for (const [id, q, number] of rows) {
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number)
       values ($1, 'generic', $2, '본문', '데이터베이스', 'ready', 'batch', $3)`,
      [id, q, number],
    )
  }
  /* 넷을 다 관계로 이어 둔다. 걸러지는 것은 접힘 때문이어야 한다 */
  for (const to of [CANON, FOLDED, OTHER]) {
    await db.query(
      `insert into semantic_relation (from_id, to_id, kind, source, reason, votes)
       values ($1, $2, 'shares_concept', 'llm', '같은 주제다', 5)`,
      [ME, to],
    )
  }
  await db.query(
    `insert into qnode_equivalence (node_a, node_b, canonical_id, active, decided_by)
     values ($1, $2, $1, true, 'test')`,
    [CANON, FOLDED],
  )
}

describe('관련 질문은 정본만 세운다', () => {
  it('접힌 잉여가 목록에 안 나온다', async () => {
    await seed()
    const out = await relatedForDisplay(ME, 10)
    const ids = out.map((r) => r.id)
    expect(ids).toContain(CANON)
    expect(ids).not.toContain(FOLDED)
  })

  /* 접기와 무관한 것까지 사라지면 필터가 너무 넓은 것이다 */
  it('접히지 않은 것은 그대로 나온다', async () => {
    await seed()
    const out = await relatedForDisplay(ME, 10)
    expect(out.map((r) => r.id)).toContain(OTHER)
  })
})
