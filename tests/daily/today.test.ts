import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { publishDaily } from '@/lib/daily/publish'
import { getTodayTree, findDailyTree } from '@/lib/daily/today'
import { makeCaller, insertSeeds } from './helpers'

const TODAY = '2026-08-06'

async function seedAndPublish(date: string, term: string, category: string) {
  await insertSeeds([{ term, category }])
  const out = await publishDaily({ date, call: makeCaller() })
  if (out.kind !== 'published') throw new Error(out.kind)
  return out.tree
}

describe('getTodayTree', () => {
  beforeEach(truncateAll)

  it('returns null before anything is published', async () => {
    expect(await getTodayTree(TODAY)).toBeNull()
  })

  it("returns today's tree with isToday true", async () => {
    const published = await seedAndPublish(TODAY, '인덱스', '데이터베이스')

    const tree = await getTodayTree(TODAY)
    expect(tree).not.toBeNull()
    expect(tree!.id).toBe(published.id)
    expect(tree!.isToday).toBe(true)
    expect(tree!.publishDate).toBe(TODAY)
  })

  it('falls back to the most recent past tree and says it is not today', async () => {
    await seedAndPublish('2026-08-04', 'a', '네트워크')
    const newer = await seedAndPublish('2026-08-05', 'b', '운영체제')

    const tree = await getTodayTree(TODAY)
    expect(tree!.id).toBe(newer.id)
    expect(tree!.isToday).toBe(false)
    expect(tree!.publishDate).toBe('2026-08-05')
  })

  it('prefers today over a newer-looking past row', async () => {
    await seedAndPublish('2026-08-05', 'a', '네트워크')
    const today = await seedAndPublish(TODAY, 'b', '운영체제')

    const tree = await getTodayTree(TODAY)
    expect(tree!.id).toBe(today.id)
    expect(tree!.isToday).toBe(true)
  })

  it('carries the root question, body and suggestions for the reading view', async () => {
    await seedAndPublish(TODAY, 'TIME_WAIT', '네트워크')

    const tree = await getTodayTree(TODAY)
    expect(tree!.root.question).toContain('TIME_WAIT')
    expect(tree!.root.body.length).toBeGreaterThan(0)
    expect(tree!.root.suggestions).toHaveLength(5)
    expect(tree!.root.suggestions[0].resolved).toBe(false)
    expect(tree!.root.identityScope.length).toBeGreaterThan(0)
  })

  it('carries the board fields', async () => {
    await seedAndPublish(TODAY, 'CORS', '네트워크')

    const tree = await getTodayTree(TODAY)
    expect(tree!.slug).toBe(`daily-${TODAY}`)
    expect(tree!.title.length).toBeGreaterThan(0)
    expect(tree!.summary.length).toBeGreaterThan(0)
    expect(tree!.category).toBe('네트워크')
    expect(new Date(tree!.publishedAt).getTime()).toBeGreaterThan(0)
  })

  it('ignores shared trees', async () => {
    await seedAndPublish('2026-08-04', 'a', '네트워크')

    // 사용자 공유 트리가 오늘의 질문 자리를 차지하면 안 된다
    const { getDb } = await import('@/lib/db/client')
    const db = await getDb()
    const root = await db.query<{ id: string }>('select id from qnode limit 1')
    await db.query(
      `insert into tree (slug, title, kind, category, root_node_id, summary)
       values ('shared-x', '공유', 'shared', '네트워크', $1, '요약')`,
      [root[0].id],
    )

    const tree = await getTodayTree(TODAY)
    expect(tree!.slug).toBe('daily-2026-08-04')
  })
})

describe('findDailyTree', () => {
  beforeEach(truncateAll)

  it('finds the tree of an exact date', async () => {
    const published = await seedAndPublish(TODAY, 'a', '네트워크')
    const found = await findDailyTree(TODAY)
    expect(found!.id).toBe(published.id)
    expect(found!.publishDate).toBe(TODAY)
  })

  it('returns null for a day with nothing published', async () => {
    await seedAndPublish(TODAY, 'a', '네트워크')
    expect(await findDailyTree('2026-08-07')).toBeNull()
  })
})
