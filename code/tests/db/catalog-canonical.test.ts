import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const state = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ getDb: async () => ({ query: state.query }) }))
import { loadCatalog } from '@/lib/db/catalog'

const TODAY = '2026-11-09'
const db = new PGlite()
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`

beforeAll(async () => {
  await db.exec(`
    create table qnode (id uuid primary key, normalized_question text, primary_category text,
      body text, status text, origin text, created_at timestamptz default now());
    create table tree (root_node_id uuid, kind text, publish_date date);
    create table qnode_equivalence (node_a uuid, node_b uuid, canonical_id uuid, active boolean);
  `)
  state.query.mockImplementation(async (sql: string, params?: unknown[]) => (await db.query(sql, params)).rows)
})
beforeEach(async () => {
  await db.exec('truncate qnode, tree, qnode_equivalence')
  state.query.mockClear()
})
afterAll(async () => { await db.close() })

async function node(n: number, origin = 'batch', status = 'ready') {
  await db.query(`insert into qnode(id, normalized_question, primary_category, body, origin, status)
    values ($1,$2,'network',$3,$4,$5)`, [id(n), `Question ${n}`, `Answer ${n}`, origin, status])
}
async function pair(a: number, b: number, canonical: number | null = b, active = true) {
  await db.query('insert into qnode_equivalence values ($1,$2,$3,$4)',
    [id(a), id(b), canonical === null ? null : id(canonical), active])
}
async function daily(n: number, date: string) {
  await db.query("insert into tree values ($1,'daily',$2::date)", [id(n), date])
}
async function canonicalIds() {
  return (await loadCatalog(TODAY, { canonicalOnly: true })).entries.map(e => e.id)
}

describe('canonical public catalog opt-in', () => {
  it('omits only a folded copy with a published ready batch representative, in one read', async () => {
    await node(1); await node(2); await pair(1, 2)
    await daily(2, TODAY)
    const out = await loadCatalog(TODAY, { canonicalOnly: true, withBody: true })
    expect(out.entries).toEqual([{ id: id(2), question: 'Question 2', category: 'network',
      publishDate: TODAY, body: 'Answer 2' }])
    expect(state.query).toHaveBeenCalledOnce()
    expect((await loadCatalog(TODAY)).entries.map(e => e.id)).toEqual([id(1), id(2)])
  })

  it.each(['on_demand', 'future', 'pending', 'missing'])('retains the original when representative is %s', async kind => {
    await node(1)
    if (kind !== 'missing') await node(2, kind === 'on_demand' ? 'on_demand' : 'batch', kind === 'pending' ? 'pending' : 'ready')
    if (kind === 'future') await daily(2, '2099-12-31')
    await pair(1, 2)
    expect(await canonicalIds()).toEqual([id(1)])
  })

  it.each(['inactive', 'undecided'])('retains both nodes for an %s relationship', async kind => {
    await node(1); await node(2)
    await pair(1, 2, kind === 'undecided' ? null : 2, kind !== 'inactive')
    expect(await canonicalIds()).toEqual([id(1), id(2)])
  })

  it('does not hide a copy behind a representative that is itself folded', async () => {
    await node(1); await node(2); await node(3)
    await pair(1, 2); await pair(2, 3)
    expect(await canonicalIds()).toEqual([id(1), id(3)])
  })

  it('keeps private and future source nodes out, including a future node with an earlier publication', async () => {
    await node(1, 'on_demand'); await node(2); await node(3)
    await daily(2, '2026-11-01'); await daily(2, '2099-12-31')
    expect(await canonicalIds()).toEqual([id(3)])
  })
})
