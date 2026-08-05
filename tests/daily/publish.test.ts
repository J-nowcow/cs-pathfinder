import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { publishDaily } from '@/lib/daily/publish'
import { makeCaller, failingCaller, insertSeeds, countRows } from './helpers'

const DATE = '2026-08-06'

describe('publishDaily', () => {
  beforeEach(truncateAll)

  it('creates the root node, its suggestions, the tree and the root occurrence', async () => {
    await insertSeeds([{ term: '인덱스', category: '데이터베이스' }])
    const call = makeCaller()

    const out = await publishDaily({ date: DATE, call })
    expect(out.kind).toBe('published')
    if (out.kind !== 'published') return

    expect(out.tree.publishDate).toBe(DATE)
    expect(out.tree.category).toBe('데이터베이스')
    expect(out.tree.root.question).toContain('인덱스')
    expect(out.tree.root.suggestions).toHaveLength(5)

    expect(await countRows('tree', "kind = 'daily'")).toBe(1)
    expect(await countRows('tree_occurrence')).toBe(1)
    expect(await countRows('qnode_suggestion')).toBe(5)
  })

  it('marks the root as batch origin and ready so home can list it', async () => {
    await insertSeeds([{ term: 'TLB', category: '운영체제' }])
    const out = await publishDaily({ date: DATE, call: makeCaller() })
    if (out.kind !== 'published') throw new Error(out.kind)

    const db = await getDb()
    const rows = await db.query<{ origin: string; status: string; primary_category: string }>(
      'select origin, status, primary_category from qnode where id = $1',
      [out.tree.root.id],
    )
    expect(rows[0].origin).toBe('batch')
    expect(rows[0].status).toBe('ready')
    expect(rows[0].primary_category).toBe('운영체제')
  })

  it('points the root occurrence at the root node with no parent', async () => {
    await insertSeeds([{ term: 'GC', category: '언어 · 런타임' }])
    const out = await publishDaily({ date: DATE, call: makeCaller() })
    if (out.kind !== 'published') throw new Error(out.kind)

    const db = await getDb()
    const rows = await db.query<{ qnode_id: string; parent_occurrence_id: string | null }>(
      'select qnode_id, parent_occurrence_id from tree_occurrence where tree_id = $1',
      [out.tree.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].qnode_id).toBe(out.tree.root.id)
    expect(rows[0].parent_occurrence_id).toBeNull()
  })

  it('links the tree to the seed it consumed', async () => {
    await insertSeeds([{ term: 'CORS', category: '네트워크' }])
    const out = await publishDaily({ date: DATE, call: makeCaller() })
    if (out.kind !== 'published') throw new Error(out.kind)

    const db = await getDb()
    const rows = await db.query<{ seed_id: string | null; term: string | null }>(
      `select t.seed_id, s.term
       from tree t left join topic_seed s on s.id = t.seed_id
       where t.id = $1`,
      [out.tree.id],
    )
    expect(rows[0].seed_id).not.toBeNull()
    expect(rows[0].term).toBe('CORS')
  })

  it('consumes exactly one seed', async () => {
    await insertSeeds([
      { term: 'a', category: '네트워크' },
      { term: 'b', category: '운영체제' },
    ])
    await publishDaily({ date: DATE, call: makeCaller() })
    expect(await countRows('topic_seed', 'consumed_at is not null')).toBe(1)
  })

  it('binds an alias so the same question does not regenerate later', async () => {
    await insertSeeds([{ term: 'mutex', category: '운영체제' }])
    await publishDaily({ date: DATE, call: makeCaller() })
    expect(await countRows('qnode_alias')).toBe(1)
  })

  // ── 하루 하나 보장 ────────────────────────────────────────
  // HTTP 응답만 유실돼도 워크플로가 재시도한다. 그때 두 번째 트리가 생기면 안 된다.

  it('returns the existing tree on a second call for the same day', async () => {
    await insertSeeds([
      { term: 'a', category: '네트워크' },
      { term: 'b', category: '운영체제' },
    ])
    const call = makeCaller()

    const first = await publishDaily({ date: DATE, call })
    const second = await publishDaily({ date: DATE, call })

    expect(first.kind).toBe('published')
    expect(second.kind).toBe('already_published')
    if (first.kind !== 'published' || second.kind !== 'already_published') return
    expect(second.tree.id).toBe(first.tree.id)
  })

  it('does not call the model again when the day is already published', async () => {
    await insertSeeds([
      { term: 'a', category: '네트워크' },
      { term: 'b', category: '운영체제' },
    ])
    const call = makeCaller()

    await publishDaily({ date: DATE, call })
    await publishDaily({ date: DATE, call })

    expect(call.calls).toHaveLength(1)
  })

  it('does not consume a second seed when the day is already published', async () => {
    await insertSeeds([
      { term: 'a', category: '네트워크' },
      { term: 'b', category: '운영체제' },
    ])
    const call = makeCaller()

    await publishDaily({ date: DATE, call })
    await publishDaily({ date: DATE, call })

    expect(await countRows('topic_seed', 'consumed_at is not null')).toBe(1)
    expect(await countRows('tree', "kind = 'daily'")).toBe(1)
    expect(await countRows('qnode')).toBe(1)
  })

  it('publishes a separate tree on a different day', async () => {
    await insertSeeds([
      { term: 'a', category: '네트워크' },
      { term: 'b', category: '운영체제' },
    ])
    const call = makeCaller()

    await publishDaily({ date: '2026-08-06', call })
    const next = await publishDaily({ date: '2026-08-07', call })

    expect(next.kind).toBe('published')
    expect(await countRows('tree', "kind = 'daily'")).toBe(2)
  })

  // ── 시드 소진 ─────────────────────────────────────────────

  it('reports seed exhaustion instead of failing silently', async () => {
    const call = makeCaller()
    const out = await publishDaily({ date: DATE, call })

    expect(out.kind).toBe('seed_exhausted')
    expect(call.calls).toHaveLength(0)
    expect(await countRows('tree')).toBe(0)
  })

  it('reports exhaustion when every seed is already consumed', async () => {
    await insertSeeds([{ term: 'a', category: '네트워크' }])
    const db = await getDb()
    await db.query('update topic_seed set consumed_at = now()')

    const out = await publishDaily({ date: DATE, call: makeCaller() })
    expect(out.kind).toBe('seed_exhausted')
  })

  // ── 생성 실패 ─────────────────────────────────────────────

  it('gives the seed back when generation fails', async () => {
    await insertSeeds([{ term: 'a', category: '네트워크' }])

    const out = await publishDaily({ date: DATE, call: failingCaller })
    expect(out.kind).toBe('generation_failed')

    // 시드를 소비한 채로 두면 실패할 때마다 13개월치가 조용히 녹는다
    expect(await countRows('topic_seed', 'consumed_at is not null')).toBe(0)
    expect(await countRows('tree')).toBe(0)
    expect(await countRows('qnode')).toBe(0)
  })

  it('gives the seed back when the model returns an empty body', async () => {
    await insertSeeds([{ term: 'a', category: '네트워크' }])
    const call = makeCaller(() => ({
      question: '질문?',
      identity_scope: 'generic',
      body: '   ',
      summary: '요약',
      suggestions: [{ text: '꼬리?' }],
    }))

    const out = await publishDaily({ date: DATE, call })
    expect(out.kind).toBe('generation_failed')
    expect(await countRows('topic_seed', 'consumed_at is not null')).toBe(0)
  })

  it('retries cleanly after a failure', async () => {
    await insertSeeds([{ term: 'a', category: '네트워크' }])

    await publishDaily({ date: DATE, call: failingCaller })
    const retry = await publishDaily({ date: DATE, call: makeCaller() })

    expect(retry.kind).toBe('published')
  })

  // ── 카테고리 균형 ─────────────────────────────────────────

  it('does not drain one category on consecutive days', async () => {
    await insertSeeds([
      { term: 'db1', category: '데이터베이스' },
      { term: 'db2', category: '데이터베이스' },
      { term: 'db3', category: '데이터베이스' },
      { term: 'net1', category: '네트워크' },
      { term: 'net2', category: '네트워크' },
      { term: 'os1', category: '운영체제' },
    ])
    const call = makeCaller()

    const picked: string[] = []
    for (const date of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      const out = await publishDaily({ date, call })
      if (out.kind !== 'published') throw new Error(out.kind)
      picked.push(out.tree.category)
    }

    expect(new Set(picked).size).toBe(3)
  })

  it('picks the category that has waited longest', async () => {
    await insertSeeds([
      { term: 'net1', category: '네트워크' },
      { term: 'net2', category: '네트워크' },
      { term: 'os1', category: '운영체제' },
      { term: 'os2', category: '운영체제' },
    ])
    const call = makeCaller()

    await publishDaily({ date: '2026-08-01', call })
    await publishDaily({ date: '2026-08-02', call })

    // 첫날 카테고리를 아주 오래 전으로 밀면 다음 차례는 그쪽이어야 한다
    const db = await getDb()
    const first = await db.query<{ category: string }>(
      "select category from tree where publish_date = '2026-08-01'",
    )
    await db.query(
      `update tree set published_at = now() - interval '30 days' where category = $1`,
      [first[0].category],
    )

    const third = await publishDaily({ date: '2026-08-03', call })
    if (third.kind !== 'published') throw new Error(third.kind)
    expect(third.tree.category).toBe(first[0].category)
  })

  it('keeps going when a category runs out of seeds', async () => {
    await insertSeeds([
      { term: 'net1', category: '네트워크' },
      { term: 'os1', category: '운영체제' },
      { term: 'os2', category: '운영체제' },
    ])
    const call = makeCaller()

    for (const date of ['2026-08-01', '2026-08-02', '2026-08-03']) {
      const out = await publishDaily({ date, call })
      expect(out.kind).toBe('published')
    }
    expect(await countRows('topic_seed', 'consumed_at is null')).toBe(0)
  })
})
