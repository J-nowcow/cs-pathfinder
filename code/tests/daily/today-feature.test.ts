import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const fixture = vi.hoisted(() => ({
  pg: null as PGlite | null,
  calls: [] as string[],
  fault: null as string | null,
  error: null as Error | null,
  changeRootAfterTree: false,
}))
function stage(sql: string) {
  if (sql.includes('from tree t') && sql.includes('t.kind =')) return 'daily'
  if (/from qnode where (id|number) =/.test(sql)) return 'node'
  if (sql.includes('from qnode_suggestion')) return 'suggestions'
  if (sql.includes('from qnode') && sql.includes('origin =')) return 'roots'
  throw new Error('Unexpected fixture query')
}
vi.mock('@/lib/db/client', () => ({ getDb: async () => ({ query: async (text: string, params: unknown[] = []) => {
  const at = stage(text.replace(/\s+/g, ' ').trim())
  fixture.calls.push(at)
  if (at === fixture.fault) throw fixture.error
  const result = await fixture.pg!.query(text, params)
  if (at === 'daily' && fixture.changeRootAfterTree) {
    fixture.changeRootAfterTree = false
    await fixture.pg!.query("update qnode set status = 'pending' where id = $1", [A])
  }
  return result.rows
} }) }))
vi.mock('@/lib/llm/gate', () => ({ NORMALIZER_VERSION: 'unused-synthetic' }))
vi.mock('@/lib/expand/nodes', () => ({ relatedForDisplay: () => { throw new Error('Unexpected related query') } }))
import { getTodayTree, findDailyTree, getTodayFeature } from '@/lib/daily/today'
import { listRoots } from '@/lib/db/roots'

const TODAY = '2026-10-28'
const A = '11111111-1111-4111-8111-111111111111'
const F = '22222222-2222-4222-8222-222222222222'
const MISSING = '99999999-9999-4999-8999-999999999999'
beforeAll(async () => {
  fixture.pg = new PGlite()
  await fixture.pg.waitReady
  await fixture.pg.exec(`
    create table qnode(id uuid primary key, number int, normalized_question text, body text not null, identity_scope text, primary_category text, tags text[], level text, status text, origin text, created_at timestamptz);
    create table tree(id uuid primary key, slug text, title text, category text, summary text, publish_date date, published_at timestamptz, root_node_id uuid, kind text);
    create table qnode_suggestion(id uuid primary key, qnode_id uuid, text text, target_node_id uuid, position int);
    create table qnode_equivalence(active boolean, canonical_id uuid, node_a uuid, node_b uuid);
  `)
  vi.useFakeTimers({ toFake: ['Date'] })
})
beforeEach(async () => {
  await fixture.pg!.exec('truncate qnode, tree, qnode_suggestion, qnode_equivalence')
  fixture.calls = []
  fixture.fault = null
  fixture.error = null
  fixture.changeRootAfterTree = false
  vi.setSystemTime(new Date('2026-10-28T00:00:00Z'))
})
afterAll(async () => {
  vi.useRealTimers()
  await fixture.pg?.close()
})
type Options = { kind?: string; date?: string; root?: string; status?: string; body?: string; suggestions?: number; older?: boolean }
async function setup(options: Options = {}) {
  await fixture.pg!.query(`insert into qnode values ($1,1,'Synthetic daily title',$2,'generic','Synthetic node category',array['synthetic'],'basic',$3,'batch','2026-10-28T00:00:00Z'),($4,2,'Synthetic fallback title','Fallback first\n\nFallback rest','generic','Synthetic fallback category',array[]::text[],null,'ready','batch','2026-10-27T00:00:00Z')`, [A, options.body ?? 'First paragraph\n\nSecond paragraph', options.status ?? 'ready', F])
  if (options.kind !== 'none') await fixture.pg!.query(`insert into tree values ($1,$2,'Synthetic tree title','Synthetic tree category','Synthetic summary',$3::date,'2026-10-28T00:00:00Z',$4,$5)`, [A, 'daily-' + (options.date ?? TODAY), options.date ?? TODAY, options.root ?? A, options.kind ?? 'daily'])
  if (options.older) await fixture.pg!.query(`insert into tree values ($1,'daily-2026-10-27','Older ready tree','Older tree category','Older summary','2026-10-27','2026-10-27T00:00:00Z',$1,'daily')`, [F])
  for (let n = 0; n < (options.suggestions ?? 5); n++) await fixture.pg!.query('insert into qnode_suggestion values ($1,$2,$3,null,$4)', ['33333333-3333-4333-8333-' + String(n + 1).padStart(12, '0'), A, 'Synthetic suggestion ' + n, n])
}
async function card(useFeature: boolean) {
  const [daily, roots] = await Promise.all([useFeature ? getTodayFeature() : getTodayTree(), listRoots({ limit: 13 })])
  const first = roots[0]
  if (!daily) return first ? { nodeId: first.id, question: first.question, category: first.category, excerpt: first.excerpt, isToday: false, treeSlug: null } : null
  return 'nodeId' in daily ? daily : {
    nodeId: daily.root.id, question: daily.root.question, category: daily.category,
    excerpt: daily.root.body.split('\n\n')[0] ?? '', isToday: daily.isToday, treeSlug: daily.slug,
  }
}
const cases: { name: string; options: Options; dailyQueries: number }[] = [
  { name: 'ready with suggestions', options: {}, dailyQueries: 2 },
  { name: 'ready without suggestions', options: { suggestions: 0 }, dailyQueries: 2 },
  { name: 'no daily tree', options: { kind: 'none' }, dailyQueries: 1 },
  { name: 'latest pending with older ready', options: { status: 'pending', older: true }, dailyQueries: 2 },
  { name: 'latest missing root', options: { root: MISSING }, dailyQueries: 2 },
  { name: 'future-only tree', options: { date: '2026-10-29' }, dailyQueries: 1 },
  { name: 'shared-only tree', options: { kind: 'shared' }, dailyQueries: 1 },
  { name: 'past ready tree', options: { date: '2026-10-27' }, dailyQueries: 2 },
]
it.each(cases)('preserves the feature for $name without a suggestion read', async ({ options, dailyQueries }) => {
  await setup(options)
  const expected = await card(false)
  fixture.calls = []
  expect(await card(true)).toEqual(expected)
  expect(fixture.calls.filter(c => c !== 'roots')).toHaveLength(dailyQueries)
  expect(fixture.calls).not.toContain('suggestions')
  expect(fixture.calls.filter(c => c !== 'roots')).toEqual(dailyQueries === 1 ? ['daily'] : ['daily', 'node'])
})
it.each(['', '\n\nLeading empty paragraph', 'α 한글\n\nβ', 'First\r\n\r\nSecond', '# Title\nline\n\nBody'])('preserves exact paragraph bytes for %j', async body => {
  await setup({ body })
  expect(await card(true)).toEqual(await card(false))
  expect((await getTodayFeature())?.excerpt).toBe(body.split('\n\n')[0])
})
it.each(['daily', 'node'])('propagates the original mandatory %s error', async fault => {
  await setup()
  fixture.fault = fault
  fixture.error = new Error('Synthetic mandatory read unavailable')
  await expect(getTodayFeature()).rejects.toBe(fixture.error)
  await expect(getTodayTree()).rejects.toBe(fixture.error)
})
it('removes only the feature dependency on suggestion errors, keeping reading APIs strict', async () => {
  await setup()
  fixture.fault = 'suggestions'
  fixture.error = new Error('Synthetic suggestions unavailable')
  expect((await getTodayFeature())?.question).toBe('Synthetic daily title')
  await expect(getTodayTree()).rejects.toBe(fixture.error)
  await expect(findDailyTree(TODAY)).rejects.toBe(fixture.error)
})
it('keeps full body, number, tags and ordered suggestions in both reading APIs', async () => {
  await setup()
  const daily = await getTodayTree()
  const exact = await findDailyTree(TODAY)
  expect(exact).toEqual(daily)
  expect(daily?.root).toMatchObject({ number: 1, body: 'First paragraph\n\nSecond paragraph', tags: ['synthetic'], identityScope: 'generic', level: 'basic' })
  expect(daily?.root.suggestions.map(s => s.text)).toEqual(Array.from({ length: 5 }, (_, n) => 'Synthetic suggestion ' + n))
})
it('checks root readiness after selecting the latest tree', async () => {
  await setup({ older: true })
  fixture.changeRootAfterTree = true
  expect(await getTodayFeature()).toBeNull()
  expect(fixture.calls).toEqual(['daily', 'node'])
})
it('keeps the implicit KST date fresh across midnight', async () => {
  await setup()
  vi.setSystemTime(new Date('2026-10-27T14:59:59Z'))
  expect(await getTodayFeature()).toBeNull()
  vi.setSystemTime(new Date('2026-10-27T15:00:00Z'))
  expect((await getTodayFeature())?.isToday).toBe(true)
})
it('keeps an empty catalogue empty', async () => {
  expect(await card(true)).toBeNull()
  expect(await card(false)).toBeNull()
})
