import { getDb } from '@/lib/db/client'

/**
 * 추천 토글.
 *
 * 표를 남기는 행(tree_vote)과 정렬에 쓰는 카운터(tree.upvotes)가 따로 있다.
 * 카운터를 안 두고 매번 세면 게시판 인기 정렬이 커서 페이지네이션과 함께
 * 집계 쿼리를 돌게 되는데, 인덱스를 못 타서 목록 전체를 훑는다.
 *
 * 둘이 어긋나면 정렬만 이상해지는 게 아니라 사용자가 자기 표를 잃는다.
 * 그래서 한 트랜잭션에서 같이 움직이고, 트리 행을 먼저 잠근다. 같은 트리에
 * 동시에 두 표가 들어오면 잠금 없이는 카운터가 하나만 오른다.
 */

export type VoteResult = { upvotes: number; voted: boolean }

export async function toggleVote(slug: string, voterKey: string): Promise<VoteResult | null> {
  const db = await getDb()

  return db.transaction(async (tx) => {
    // for update가 이 트리에 들어오는 다른 표를 줄 세운다
    const found = await tx.query<{ id: string }>(
      'select id from tree where slug = $1 for update',
      [slug],
    )
    if (found.length === 0) return null
    const treeId = found[0].id

    const removed = await tx.query<{ ok: number }>(
      'delete from tree_vote where tree_id = $1 and voter_key = $2 returning 1 as ok',
      [treeId, voterKey],
    )

    // 지운 게 없으면 아직 안 누른 사람이다
    const voted = removed.length === 0

    if (voted) {
      await tx.query('insert into tree_vote (tree_id, voter_key) values ($1, $2)', [
        treeId,
        voterKey,
      ])
    }

    // greatest로 바닥을 막는다. 표 행 없이 카운터만 올라간 과거 데이터가 있으면
    // 취소가 음수를 만든다. 화면에 -1이 뜨는 것보다 0에서 멈추는 편이 낫다
    const updated = await tx.query<{ upvotes: number }>(
      'update tree set upvotes = greatest(0, upvotes + $2) where id = $1 returning upvotes',
      [treeId, voted ? 1 : -1],
    )

    return { upvotes: Number(updated[0].upvotes), voted }
  })
}

/** 이 사람이 이 트리를 이미 눌렀나. 첫 렌더에서 버튼 상태를 정한다 */
export async function hasVoted(slug: string, voterKey: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query<{ ok: number }>(
    `select 1 as ok from tree_vote v
     join tree t on t.id = v.tree_id
     where t.slug = $1 and v.voter_key = $2`,
    [slug, voterKey],
  )
  return rows.length > 0
}

/**
 * 이 사람이 누른 트리들을 한 번에 읽는다.
 *
 * 게시판 카드마다 조회를 돌면 목록 크기만큼 왕복한다. 보이는 slug를 통째로 넘긴다.
 */
export async function votedSlugs(slugs: string[], voterKey: string): Promise<Set<string>> {
  if (slugs.length === 0) return new Set()
  const db = await getDb()
  const rows = await db.query<{ slug: string }>(
    `select t.slug from tree_vote v
     join tree t on t.id = v.tree_id
     where v.voter_key = $1 and t.slug = any($2)`,
    [voterKey, slugs],
  )
  return new Set(rows.map((r) => r.slug))
}
