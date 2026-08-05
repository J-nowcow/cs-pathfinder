import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { derivedUuid } from '@/lib/db/uuid'
import { seedExampleNodes, ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { EXAMPLE_NODES } from '../../data/example-nodes'

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('derivedUuid', () => {
  it('is stable for the same seed', () => {
    expect(derivedUuid('a')).toBe(derivedUuid('a'))
  })

  it('differs for a different seed', () => {
    expect(derivedUuid('a')).not.toBe(derivedUuid('b'))
  })

  it('has uuid v4 shape so postgres accepts it', () => {
    expect(derivedUuid('TCP 3-way handshake란?')).toMatch(UUID_SHAPE)
  })
})

describe('seedExampleNodes', () => {
  beforeEach(truncateAll)

  it('inserts every example root', async () => {
    const r = await seedExampleNodes()
    expect(r.inserted).toBe(EXAMPLE_NODES.length)

    const db = await getDb()
    const rows = await db.query<{ n: string }>(
      "select count(*) as n from qnode where origin = 'batch'",
    )
    expect(Number(rows[0].n)).toBe(EXAMPLE_NODES.length)
  })

  it('is idempotent so a second boot does not duplicate', async () => {
    await seedExampleNodes()
    const second = await seedExampleNodes()
    expect(second.inserted).toBe(0)

    const db = await getDb()
    const rows = await db.query<{ n: string }>('select count(*) as n from qnode')
    expect(Number(rows[0].n)).toBe(EXAMPLE_NODES.length)
  })

  it('gives each node a derived id so urls survive a restart', async () => {
    await seedExampleNodes()
    const first = EXAMPLE_NODES[0]

    const db = await getDb()
    const rows = await db.query<{ id: string }>(
      'select id from qnode where normalized_question = $1',
      [first.question],
    )
    expect(rows[0].id).toBe(derivedUuid(`node:${first.identityScope}:${first.question}`))
  })

  it('attaches the suggestions of each root', async () => {
    await seedExampleNodes()
    const first = EXAMPLE_NODES[0]
    const nodeId = derivedUuid(`node:${first.identityScope}:${first.question}`)

    const db = await getDb()
    const rows = await db.query<{ text: string }>(
      'select text from qnode_suggestion where qnode_id = $1 order by position',
      [nodeId],
    )
    expect(rows.map((r) => r.text)).toEqual(first.suggestions)
  })

  it('binds an alias so the cache can find the root by hash', async () => {
    await seedExampleNodes()
    const db = await getDb()
    const rows = await db.query<{ n: string }>('select count(*) as n from qnode_alias')
    expect(Number(rows[0].n)).toBe(EXAMPLE_NODES.length)
  })
})

describe('ensureSeeded', () => {
  beforeEach(async () => {
    await truncateAll()
    resetSeedCache()
  })

  it('runs the seed only once even under concurrent callers', async () => {
    // 불리언 플래그는 첫 호출이 끝나기 전에 두 번째 호출이 통과한다.
    // promise 캐싱이라야 동시 요청에서 시드가 두 번 돌지 않는다.
    await Promise.all([ensureSeeded(), ensureSeeded(), ensureSeeded()])

    const db = await getDb()
    const rows = await db.query<{ n: string }>('select count(*) as n from qnode')
    expect(Number(rows[0].n)).toBe(EXAMPLE_NODES.length)
  })
})

describe('listRoots', () => {
  beforeEach(truncateAll)

  it('returns nothing before seeding', async () => {
    expect(await listRoots()).toEqual([])
  })

  it('returns every seeded root with question and category', async () => {
    await seedExampleNodes()
    const roots = await listRoots()

    expect(roots).toHaveLength(EXAMPLE_NODES.length)
    for (const r of roots) {
      expect(r.question.length).toBeGreaterThan(0)
      expect(r.category.length).toBeGreaterThan(0)
    }
  })

  it('excerpts the first paragraph of the body for card display', async () => {
    await seedExampleNodes()
    const roots = await listRoots()
    const target = roots.find((r) => r.question === EXAMPLE_NODES[0].question)

    expect(target!.excerpt).toBe(EXAMPLE_NODES[0].body.split('\n\n')[0])
  })
})
