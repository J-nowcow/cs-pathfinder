import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { createSharedTree, listTrees } from '@/lib/db/trees'
import { toggleVote, hasVoted, votedSlugs } from '@/lib/db/votes'
import type { Snapshot } from '@/lib/tree/snapshot'

const ME = 'anon:11111111-1111-4111-8111-111111111111'
const YOU = 'anon:22222222-2222-4222-8222-222222222222'

async function makeTree(title: string): Promise<string> {
  const nodeId = await insertNode({
    identityScope: 'network',
    normalizedQuestion: `${title} 뿌리 질문은?`,
    body: '해설',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

  const snapshot: Snapshot = {
    rootNodeId: nodeId,
    rows: [{ tempId: 't0', nodeId, parentTempId: null, position: 0 }],
  }

  const res = await createSharedTree({ snapshot, title })
  if (!res.ok) throw new Error(`트리 생성 실패: ${res.reason}`)
  return res.slug
}

beforeEach(async () => {
  await truncateAll()
})

describe('tree votes', () => {
  it('turns on, then off, and the counter follows', async () => {
    const slug = await makeTree('첫 트리')

    const on = await toggleVote(slug, ME)
    expect(on).toEqual({ upvotes: 1, voted: true })
    expect(await hasVoted(slug, ME)).toBe(true)

    const off = await toggleVote(slug, ME)
    expect(off).toEqual({ upvotes: 0, voted: false })
    expect(await hasVoted(slug, ME)).toBe(false)
  })

  /** 같은 사람이 여러 번 눌러도 표는 하나다. 이게 안 되면 인기 정렬이 의미를 잃는다 */
  it('counts one vote per voter', async () => {
    const slug = await makeTree('둘째 트리')

    await toggleVote(slug, ME)
    await toggleVote(slug, YOU)

    const rows = await (await getDb()).query<{ n: string }>(
      'select count(*) as n from tree_vote',
    )
    expect(Number(rows[0].n)).toBe(2)

    const again = await toggleVote(slug, YOU)
    expect(again).toEqual({ upvotes: 1, voted: false })
  })

  it('keeps voters independent', async () => {
    const slug = await makeTree('셋째 트리')

    await toggleVote(slug, ME)
    expect(await hasVoted(slug, ME)).toBe(true)
    expect(await hasVoted(slug, YOU)).toBe(false)
  })

  it('returns null for an unknown slug', async () => {
    expect(await toggleVote('zzzzzzzzzzzz', ME)).toBeNull()
  })

  /**
   * 표 행 없이 카운터만 남은 과거 데이터가 있으면 취소가 음수를 만든다.
   * 화면에 -1이 뜨느니 0에서 멈추는 편이 낫다.
   */
  it('never goes below zero', async () => {
    const slug = await makeTree('넷째 트리')
    const db = await getDb()

    // 표 행 없이 카운터만 올려 둔 상태를 만든다
    await db.query('update tree set upvotes = 0 where slug = $1', [slug])
    await db.query(
      `insert into tree_vote (tree_id, voter_key)
       select id, $2 from tree where slug = $1`,
      [slug, ME],
    )

    const off = await toggleVote(slug, ME)
    expect(off).toEqual({ upvotes: 0, voted: false })
  })

  it('reads many slugs at once', async () => {
    const a = await makeTree('A')
    const b = await makeTree('B')
    const c = await makeTree('C')

    await toggleVote(a, ME)
    await toggleVote(c, ME)
    await toggleVote(b, YOU)

    const mine = await votedSlugs([a, b, c], ME)
    expect([...mine].sort()).toEqual([a, c].sort())

    expect(await votedSlugs([], ME)).toEqual(new Set())
  })

  /**
   * 인기 정렬이 실제로 표를 따라가는지 본다. 이 기능을 붙인 이유가 그 탭이라
   * 여기가 안 맞으면 나머지가 다 맞아도 소용이 없다.
   */
  it('drives the popular sort', async () => {
    const quiet = await makeTree('조용한 트리')
    const loud = await makeTree('인기 트리')

    await toggleVote(loud, ME)
    await toggleVote(loud, YOU)

    const board = await listTrees({ sort: 'popular', limit: 10 })
    expect(board.trees[0].slug).toBe(loud)
    expect(board.trees[0].upvotes).toBe(2)
    expect(board.trees.find((t) => t.slug === quiet)?.upvotes).toBe(0)
  })
})
