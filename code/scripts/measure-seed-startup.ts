import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

if (
  process.env.NODE_ENV !== 'test' ||
  process.env.USE_REAL_DB !== '0' ||
  process.env.DATABASE_URL?.trim()
) {
  throw new Error(
    'Requires NODE_ENV=test USE_REAL_DB=0 and empty DATABASE_URL; no env files are loaded',
  )
}
const { getDb, resetDb } = await import('../src/lib/db/client')
const { resetSeedCache } = await import('../src/lib/db/bootstrap')
const { GET } = await import('../src/app/api/node/[id]/route')
await resetDb()
const db = await getDb() // Migration/setup queries are excluded.
const query = db.query.bind(db)
async function sample(name: string, reset: boolean) {
  if (reset) resetSeedCache()
  const calls: string[] = []
  db.query = async (sql, params) => {
    calls.push(sql)
    return query(sql, params)
  }
  try {
    const response = await GET(
      new Request('https://fixture.example/api/node/1'),
      { params: Promise.resolve({ id: '1' }) },
    )
    assert.equal(response.status, 200)
    const node = await response.json()
    assert(node.question && node.body)
    return {
      name,
      status: response.status,
      queries: calls.length,
      aliasInserts: calls.filter((sql) =>
        /insert into qnode_alias\b/i.test(sql),
      ).length,
      nodeInserts: calls.filter((sql) => /insert into qnode\b/i.test(sql))
        .length,
      insertStatements: calls.filter((sql) => /^\s*insert/i.test(sql)).length,
    }
  } finally {
    db.query = query
  }
}
const samples = [await sample('empty database, first seed', true)]
for (let i = 0; i < 3; i++)
  samples.push(
    await sample('populated database, process seed promise reset', true),
  )
samples.push(
  await sample('populated database, same process seed promise', false),
)
const nodes = await db.query(
  'select id, number, normalized_question, body, identity_scope, primary_category, origin, status, tags, level from qnode order by id',
)
const aliases = await db.query(
  'select normalizer_version, normalized_hash, qnode_id from qnode_alias order by normalizer_version, normalized_hash',
)
const suggestions = await db.query(
  'select id, qnode_id, text, position, target_node_id from qnode_suggestion order by id',
)
const relations = await db.query(
  'select from_id,to_id,kind,source,reason,votes,active from semantic_relation order by from_id,to_id,kind',
)
const checksum = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const report = {
  checkedAt: new Date().toISOString(),
  fixture: 'Ephemeral PGlite, initialized schema; valid node API request',
  productionAccess: false,
  samples,
  publicData: {
    nodes: nodes.length,
    aliases: aliases.length,
    suggestions: suggestions.length,
    relations: relations.length,
    checksum: checksum({ nodes, aliases, suggestions, relations }),
  },
  cpuCuBillingMeasured: false,
  limits:
    'Database migration/setup and module loading excluded; resetSeedCache simulates only process seed state. No actual process cold-start, connection or production latency measurement. INSERT counts are statements, not changed rows.',
}
if (process.argv[2])
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report))
