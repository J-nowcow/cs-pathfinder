import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode, ensureEdge } from '@/lib/expand/nodes'
import { createSharedTree, listTrees, loadTreeBySlug, bumpTreeViews } from '@/lib/db/trees'
import { isShareSlug } from '@/lib/tree/slug'
import { encodeCursor } from '@/lib/tree/cursor'
import type { Snapshot } from '@/lib/tree/snapshot'

const node = (question: string, category = '네트워크') =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: question,
    body: `${question} 에 대한 해설`,
    primaryCategory: category,
    status: 'ready',
    origin: 'on_demand',
  })

/** a → b → {c, d} */
async function sampleSnapshot(): Promise<{ snapshot: Snapshot; ids: string[] }> {
  const a = await node('뿌리 질문은?')
  const b = await node('그 다음은?')
  const c = await node('더 깊게는?')
  const d = await node('옆으로는?')

  return {
    ids: [a, b, c, d],
    snapshot: {
      rootNodeId: a,
      rows: [
        { tempId: 'a', nodeId: a, parentTempId: null, position: 0 },
        { tempId: 'b', nodeId: b, parentTempId: 'a', position: 0 },
        { tempId: 'c', nodeId: c, parentTempId: 'b', position: 0 },
        { tempId: 'd', nodeId: d, parentTempId: 'b', position: 1 },
      ],
    },
  }
}

describe('createSharedTree', () => {
  beforeEach(truncateAll)

  it('stores the tree and hands back a usable slug', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(isShareSlug(res.slug)).toBe(true)
  })

  it('inherits the category from the root node rather than trusting the client', async () => {
    const root = await node('DB 뿌리는?', '데이터베이스')
    const res = await createSharedTree({
      snapshot: { rootNodeId: root, rows: [{ tempId: 'r', nodeId: root, parentTempId: null, position: 0 }] },
    })
    if (!res.ok) throw new Error('expected ok')

    const tree = await loadTreeBySlug(res.slug)
    expect(tree!.category).toBe('데이터베이스')
  })

  it('titles the tree after the root question when nothing was typed', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot })
    if (!res.ok) throw new Error('expected ok')

    expect((await loadTreeBySlug(res.slug))!.title).toBe('뿌리 질문은?')
  })

  it('keeps the title the sharer typed', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot, title: '내가 판 굴' })
    if (!res.ok) throw new Error('expected ok')

    expect((await loadTreeBySlug(res.slug))!.title).toBe('내가 판 굴')
  })

  it('summarises with the deepest trail, read from the database not the client', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot })
    if (!res.ok) throw new Error('expected ok')

    const tree = await loadTreeBySlug(res.slug)
    expect(tree!.summary).toContain('뿌리 질문은?')
    expect(tree!.summary).toContain('→')
  })

  it('refuses a node id that is not a ready question', async () => {
    const ghost = '99999999-9999-4999-8999-999999999999'
    const res = await createSharedTree({
      snapshot: { rootNodeId: ghost, rows: [{ tempId: 'r', nodeId: ghost, parentTempId: null, position: 0 }] },
    })
    expect(res).toEqual({ ok: false, reason: 'unknown_node' })
  })

  it('leaves nothing behind when the snapshot is rejected', async () => {
    const db = await getDb()
    const ghost = '99999999-9999-4999-8999-999999999999'
    await createSharedTree({
      snapshot: { rootNodeId: ghost, rows: [{ tempId: 'r', nodeId: ghost, parentTempId: null, position: 0 }] },
    })
    expect(await db.query('select 1 from tree')).toHaveLength(0)
  })
})

describe('loadTreeBySlug', () => {
  beforeEach(truncateAll)

  it('rebuilds the parent links that were frozen at share time', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot })
    if (!res.ok) throw new Error('expected ok')

    const tree = await loadTreeBySlug(res.slug)
    expect(tree!.nodes).toHaveLength(4)

    const root = tree!.nodes.find((n) => n.parentOccurrenceId === null)!
    expect(root.question).toBe('뿌리 질문은?')

    const mid = tree!.nodes.find((n) => n.parentOccurrenceId === root.occurrenceId)!
    const leaves = tree!.nodes.filter((n) => n.parentOccurrenceId === mid.occurrenceId)
    expect(leaves.map((n) => n.question)).toEqual(['더 깊게는?', '옆으로는?'])
  })

  it('does not change shape when a new edge appears in the global graph', async () => {
    // 설계 §5가 노드 id 배열을 금지한 이유가 이것이다. 배열이면 여기서 모양이 변한다
    const { snapshot, ids } = await sampleSnapshot()
    const [a, , c, d] = ids

    const res = await createSharedTree({ snapshot })
    if (!res.ok) throw new Error('expected ok')

    const before = await loadTreeBySlug(res.slug)

    // 공유한 뒤 전역 그래프에 없던 간선이 생긴다
    await ensureEdge(a, c)
    await ensureEdge(c, d)

    const after = await loadTreeBySlug(res.slug)
    expect(after!.nodes).toEqual(before!.nodes)
  })

  it('returns null for a slug nobody minted', async () => {
    expect(await loadTreeBySlug('zzzzzzzzzzzz')).toBeNull()
  })
})

describe('bumpTreeViews', () => {
  beforeEach(truncateAll)

  it('counts a visit', async () => {
    const { snapshot } = await sampleSnapshot()
    const res = await createSharedTree({ snapshot })
    if (!res.ok) throw new Error('expected ok')

    expect((await loadTreeBySlug(res.slug))!.views).toBe(0)
    await bumpTreeViews(res.slug)
    await bumpTreeViews(res.slug)
    expect((await loadTreeBySlug(res.slug))!.views).toBe(2)
  })

  it('shrugs at an unknown slug', async () => {
    await expect(bumpTreeViews('zzzzzzzzzzzz')).resolves.toBeUndefined()
  })
})

describe('listTrees', () => {
  beforeEach(truncateAll)

  /** 같은 순간에 발행된 트리를 만든다. 커서가 동점을 어떻게 다루는지 보려는 것이다*/
  async function seedBoard(count: number, category = '네트워크') {
    const db = await getDb()
    const slugs: string[] = []

    for (let i = 0; i < count; i += 1) {
      const root = await node(`${category} 질문 ${i}`, category)
      const res = await createSharedTree({
        snapshot: { rootNodeId: root, rows: [{ tempId: 'r', nodeId: root, parentTempId: null, position: 0 }] },
      })
      if (!res.ok) throw new Error('seed failed')
      slugs.push(res.slug)

      await db.query('update tree set upvotes = $1 where slug = $2', [i % 3, res.slug])
    }
    return slugs
  }

  it('puts the newest first', async () => {
    await seedBoard(3)
    const page = await listTrees({ sort: 'recent', limit: 10 })
    expect(page.trees.map((t) => t.title)).toEqual([
      '네트워크 질문 2',
      '네트워크 질문 1',
      '네트워크 질문 0',
    ])
  })

  it('puts the most upvoted first', async () => {
    await seedBoard(4)
    const page = await listTrees({ sort: 'popular', limit: 10 })
    expect(page.trees[0].upvotes).toBe(2)
    const votes = page.trees.map((t) => t.upvotes)
    expect([...votes].sort((a, b) => b - a)).toEqual(votes)
  })

  it('filters by category', async () => {
    await seedBoard(2, '네트워크')
    await seedBoard(3, '운영체제')

    const page = await listTrees({ sort: 'recent', category: '운영체제', limit: 10 })
    expect(page.trees).toHaveLength(3)
    expect(page.trees.every((t) => t.category === '운영체제')).toBe(true)
  })

  it('walks every tree exactly once across pages', async () => {
    // 겹침도 빠짐도 없어야 한다. offset을 쓰면 여기가 깨진다
    await seedBoard(7)

    const seen: string[] = []
    let cursor: string | null = null

    for (let guard = 0; guard < 10; guard += 1) {
      const page: Awaited<ReturnType<typeof listTrees>> = await listTrees({
        sort: 'recent',
        limit: 3,
        cursor,
      })
      seen.push(...page.trees.map((t) => t.slug))
      cursor = page.nextCursor
      if (!cursor) break
    }

    expect(seen).toHaveLength(7)
    expect(new Set(seen).size).toBe(7)
  })

  it('pages the popular sort without losing ties', async () => {
    await seedBoard(9)

    const seen: string[] = []
    let cursor: string | null = null

    for (let guard = 0; guard < 12; guard += 1) {
      const page: Awaited<ReturnType<typeof listTrees>> = await listTrees({
        sort: 'popular',
        limit: 2,
        cursor,
      })
      seen.push(...page.trees.map((t) => t.slug))
      cursor = page.nextCursor
      if (!cursor) break
    }

    expect(new Set(seen).size).toBe(9)
  })

  it('reports no next cursor on the last page', async () => {
    await seedBoard(2)
    const page = await listTrees({ sort: 'recent', limit: 10 })
    expect(page.nextCursor).toBeNull()
  })

  it('treats a forged cursor as the first page', async () => {
    await seedBoard(2)
    const page = await listTrees({ sort: 'recent', limit: 10, cursor: 'garbage!!' })
    expect(page.trees).toHaveLength(2)
  })

  it('counts the questions in each tree', async () => {
    const { snapshot } = await sampleSnapshot()
    await createSharedTree({ snapshot })

    const page = await listTrees({ sort: 'recent', limit: 10 })
    expect(page.trees[0].nodeCount).toBe(4)
  })

  it('comes back empty rather than throwing when nothing is shared yet', async () => {
    const page = await listTrees({ sort: 'recent', limit: 10 })
    expect(page).toEqual({ trees: [], nextCursor: null })
  })

  it('accepts a cursor built from a row it returned', async () => {
    const slugs = await seedBoard(3)
    const first = await listTrees({ sort: 'recent', limit: 1 })

    const next = await listTrees({
      sort: 'recent',
      limit: 5,
      cursor: encodeCursor({
        id: first.trees[0].id,
        publishedAt: first.trees[0].publishedAt,
        upvotes: first.trees[0].upvotes,
      }),
    })

    expect(next.trees.map((t) => t.slug)).not.toContain(first.trees[0].slug)
    expect(next.trees).toHaveLength(slugs.length - 1)
  })
})

/**
 * 아직 오지 않은 발행분은 감춘다.
 *
 * 매일 하나씩 낸다는 것이 이 서비스의 약속이다. 미리 뽑아둔 내일 질문이
 * 게시판에 보이면 그 약속이 깨진다. 실제로 8월 7일 질문이 6일 아침에
 * 게시판과 홈 목록 양쪽에 떠 있었다.
 */
describe('listTrees — 미래 발행분', () => {
  beforeEach(truncateAll)

  /** 발행분 트리를 직접 넣는다. 발행 경로를 통째로 돌리지 않아도 되는 검사다 */
  async function daily(date: string, question: string) {
    const db = await getDb()
    const root = await node(question)
    await db.query(
      `insert into tree (slug, title, kind, category, summary, root_node_id, publish_date)
       values ($1, $2, 'daily', '네트워크', $3, $4, $5::date)`,
      [`daily-${date}`, question, question, root, date],
    )
  }

  it('hides a daily published for a later date', async () => {
    await daily('2099-12-31', '먼 미래의 질문은?')
    await daily('2020-01-01', '지난 질문은?')

    const { trees } = await listTrees({ sort: 'recent' })
    const titles = trees.map((t) => t.title)

    expect(titles).toContain('지난 질문은?')
    expect(titles).not.toContain('먼 미래의 질문은?')
  })

  /** 공유 트리 slug는 daily- 모양이 아니라 이 필터에 걸리면 안 된다 */
  it('leaves shared trees alone', async () => {
    const { snapshot } = await sampleSnapshot()
    await createSharedTree({ snapshot })

    const { trees } = await listTrees({ sort: 'recent' })
    expect(trees.length).toBe(1)
    expect(isShareSlug(trees[0].slug)).toBe(true)
  })
})

/**
 * 목록에서만 빼면 반쪽이다. 발행분 slug가 `daily-YYYY-MM-DD`라 내일 날짜를
 * 넣어보면 그대로 열린다. 링크를 미리 퍼뜨릴 수도 있다.
 */
describe('loadTreeBySlug — 미래 발행분', () => {
  beforeEach(truncateAll)

  async function daily(date: string, question: string) {
    const db = await getDb()
    const root = await node(question)
    await db.query(
      `insert into tree (slug, title, kind, category, summary, root_node_id, publish_date)
       values ($1, $2, 'daily', '네트워크', $3, $4, $5::date)`,
      [`daily-${date}`, question, question, root, date],
    )
  }

  it('does not open a daily published for a later date', async () => {
    await daily('2099-12-31', '먼 미래의 질문은?')
    expect(await loadTreeBySlug('daily-2099-12-31')).toBeNull()
  })

  it('opens a past daily as usual', async () => {
    await daily('2020-01-01', '지난 질문은?')
    const tree = await loadTreeBySlug('daily-2020-01-01')
    expect(tree?.title).toBe('지난 질문은?')
  })
})
