import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import React from 'react'

// This verifier never loads env files or accepts a network database.
if (
  process.env.NODE_ENV !== 'test' ||
  process.env.USE_REAL_DB !== '0' ||
  process.env.DATABASE_URL?.trim()
) {
  throw new Error(
    'Requires NODE_ENV=test USE_REAL_DB=0 and an empty DATABASE_URL',
  )
}
if (!process.execArgv.includes('--conditions=react-server')) {
  throw new Error('Run with node --conditions=react-server --import tsx')
}

const require = createRequire(import.meta.url)
const {
  renderToReadableStream,
} = require('next/dist/compiled/react-server-dom-webpack/server.node')
const { getDb, resetDb } = await import('../src/lib/db/client')
const { ensureSeeded } = await import('../src/lib/db/bootstrap')
const { insertNode } = await import('../src/lib/expand/nodes')
const { loadNode } = await import('../src/lib/expand/cache')
const { createSharedTree, loadTreeBySlug } = await import('../src/lib/db/trees')
const { loadPublicNodeForRender, loadPublicTreeForRender } = await import(
  '../src/lib/server/public-render-reads'
)

// Use the installed React server renderer, not a mocked cache dispatcher.
async function render<T>(work: () => Promise<T>): Promise<T> {
  let value!: T
  async function Root() {
    value = await work()
    return React.createElement('div', null, 'fixture')
  }
  const stream = renderToReadableStream(React.createElement(Root), {})
  await new Response(stream).text()
  return value
}

await resetDb()
await ensureSeeded()
const db = await getDb()
const originalQuery = db.query.bind(db)
const makeNode = (question: string) =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: question,
    body: 'Original public body',
    primaryCategory: 'network',
    status: 'ready',
    origin: 'on_demand',
  })
const key = await makeNode('Synthetic render fixture A')
const otherKey = await makeNode('Synthetic render fixture B')
const created = await createSharedTree({
  title: 'Synthetic shared tree',
  snapshot: {
    rootNodeId: key,
    rows: [{ tempId: 'root', nodeId: key, parentTempId: null, position: 0 }],
  },
})
assert(created.ok)
const checks: string[] = []

async function measure<T>(work: () => Promise<T>) {
  let queries = 0
  db.query = async (sql, params) => {
    queries++
    return originalQuery(sql, params)
  }
  try {
    return { value: await render(work), queries }
  } finally {
    db.query = originalQuery
  }
}

const nodeBefore = await measure(() =>
  Promise.all([loadNode(key), loadNode(key)]),
)
const nodeAfter = await measure(() =>
  Promise.all([loadPublicNodeForRender(key), loadPublicNodeForRender(key)]),
)
assert.equal(nodeBefore.queries, 4)
assert.equal(nodeAfter.queries, 2)
assert.deepEqual(nodeAfter.value, nodeBefore.value)
assert.equal(nodeAfter.value[0], nodeAfter.value[1])
checks.push(
  'Node metadata/body snapshot: four queries become two with identical public data',
)

const treeBefore = await measure(() =>
  Promise.all([loadTreeBySlug(created.slug), loadTreeBySlug(created.slug)]),
)
const treeAfter = await measure(() =>
  Promise.all([
    loadPublicTreeForRender(created.slug),
    loadPublicTreeForRender(created.slug),
  ]),
)
assert.equal(treeBefore.queries, 4)
assert.equal(treeAfter.queries, 2)
assert.deepEqual(treeAfter.value, treeBefore.value)
assert.equal(treeAfter.value[0], treeAfter.value[1])
checks.push(
  'Tree metadata/body snapshot: four queries become two with identical public data',
)

const distinct = await measure(() =>
  Promise.all([
    loadPublicNodeForRender(key),
    loadPublicNodeForRender(otherKey),
  ]),
)
assert.equal(distinct.queries, 4)
assert.notEqual(distinct.value[0]?.id, distinct.value[1]?.id)
checks.push('Different public node keys do not share data')

const invalid = await measure(() =>
  Promise.all([
    loadPublicNodeForRender('invalid'),
    loadPublicTreeForRender('invalid'),
  ]),
)
assert.equal(invalid.queries, 0)
assert.deepEqual(invalid.value, [null, null])
checks.push('Invalid node and tree addresses do not query the database')

await db.query('update qnode set body = $1 where id = $2', [
  'Changed public body',
  key,
])
await db.query('update tree set title = $1 where slug = $2', [
  'Changed public title',
  created.slug,
])
const fresh = await render(async () => ({
  node: await loadPublicNodeForRender(key),
  tree: await loadPublicTreeForRender(created.slug),
}))
assert.equal(fresh.node?.body, 'Changed public body')
assert.equal(fresh.tree?.title, 'Changed public title')
checks.push('A subsequent server request reads changed node and tree values')

const sameRequest = await render(async () => {
  const first = await loadPublicNodeForRender(key)
  await db.query('update qnode set body = $1 where id = $2', [
    'Next request body',
    key,
  ])
  return { first, second: await loadPublicNodeForRender(key) }
})
assert.equal(sameRequest.first, sameRequest.second)
assert.equal(sameRequest.second?.body, 'Changed public body')
assert.equal(
  (await render(() => loadPublicNodeForRender(key)))?.body,
  'Next request body',
)
checks.push(
  'One request has a consistent public snapshot; the next request is fresh',
)

let failures = 0
db.query = async () => {
  failures++
  throw new Error('Synthetic transient failure')
}
try {
  const failed = await render(() =>
    Promise.allSettled([
      loadPublicNodeForRender(key),
      loadPublicNodeForRender(key),
    ]),
  )
  assert(failed.every((result) => result.status === 'rejected'))
  assert.equal(failures, 1)
} finally {
  db.query = originalQuery
}
assert.equal((await render(() => loadPublicNodeForRender(key)))?.id, key)
checks.push(
  'A failed read is shared only within its request; the next request retries successfully',
)

await db.query(
  `insert into tree (slug, title, kind, category, summary, root_node_id, publish_date)
   values ($1, $2, 'daily', 'network', 'Synthetic daily fixture', $3, '2040-01-02')`,
  ['daily-2040-01-02', 'Synthetic daily tree', key],
)
const NativeDate = globalThis.Date
let clock = NativeDate.parse('2040-01-01T14:59:59Z')
globalThis.Date = new Proxy(NativeDate, {
  construct(target, args) {
    return Reflect.construct(target, args.length ? args : [clock])
  },
  get(target, property, receiver) {
    return property === 'now'
      ? () => clock
      : Reflect.get(target, property, receiver)
  },
})
try {
  assert.equal(
    await render(() => loadPublicTreeForRender('daily-2040-01-02')),
    null,
  )
  clock = NativeDate.parse('2040-01-01T15:00:00Z')
  assert.equal(
    (await render(() => loadPublicTreeForRender('daily-2040-01-02')))?.kind,
    'daily',
  )
} finally {
  globalThis.Date = NativeDate
}
checks.push(
  'A future daily tree becomes visible in the next request at Asia/Seoul midnight',
)

const report = {
  checkedAt: new Date().toISOString(),
  fixture: 'Ephemeral PGlite; installed React server renderer',
  warmSeed: true,
  samplesPerVariant: 1,
  productionAccess: false,
  nodeQueries: { before: nodeBefore.queries, after: nodeAfter.queries },
  treeQueries: { before: treeBefore.queries, after: treeAfter.queries },
  checks,
  cpuCuBillingMeasured: false,
  limits:
    'Counts cover duplicate public snapshot reads only; seed setup, related reads and private quota/vote reads are excluded. No PostgreSQL concurrency or OAuth claim.',
}
const reportPath = process.argv[2]
if (reportPath)
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
console.log('PUBLIC_RENDER_READS ' + JSON.stringify(report))
