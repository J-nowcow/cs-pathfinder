/** Synthetic A/B row-version check, only called inside the owned TLS PG fixture. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Pool } from 'pg'
import { saveRelations, type NewRelation } from '../../src/lib/db/relations'
import type { Tx } from '../../src/lib/db/client'
export async function checkRelationWriteCost(
  pool: Pool,
  migrationPath: string,
) {
  assert.equal(
    (await pool.query('select current_database() name')).rows[0].name,
    'cs_pathfinder_relation_check',
  )
  await pool.query('create table qnode(id uuid primary key)')
  await pool.query(readFileSync(migrationPath, 'utf8'))
  const from = randomUUID(),
    ids = Array.from({ length: 400 }, () => randomUUID())
  await pool.query('insert into qnode(id) select unnest($1::uuid[])', [
    [from, ...ids],
  ])
  const batch: NewRelation[] = ids.map((id, i) => ({
    fromId: from,
    toId: id,
    kind: 'prerequisite',
    source: 'llm',
    reason: 'Synthetic evidence ' + i,
    votes: 3,
  }))
  let sql = '',
    parameters: unknown[] = []
  await saveRelations(batch, {
    query: async <T>(text: string, params?: unknown[]) => {
      sql = text
      parameters = params ?? []
      return [] as T[]
    },
  })
  const legacy = sql.replace(
    /\n\s+where excluded.votes > semantic_relation.votes\s+or \(excluded.source = 'human' and semantic_relation.source <> 'human'\)\s*$/,
    '',
  )
  assert.notEqual(legacy, sql)
  const adapter: Tx = {
    query: async <T>(text: string, params?: unknown[]) =>
      (await pool.query(text, params)).rows as T[],
  }
  async function snapshot() {
    return (
      await pool.query(
        'select to_id,ctid::text position,kind,source,reason,votes,active from semantic_relation order by to_id',
      )
    ).rows
  }
  const result: Record<string, unknown> = {
    fixture: 'owned real PostgreSQL with verified TLS',
    rows: 400,
    warmRounds: 5,
    productionAccess: false,
    queryRoundTripsReduced: false,
    baselineMethod:
      'Same previous UPSERT expressions with only the new WHERE guard removed',
    cpuOrBilledUsageMeasured: false,
  }
  let expected: unknown
  for (const variant of ['baseline', 'optimized']) {
    await pool.query('truncate semantic_relation')
    if (variant === 'baseline') await pool.query(legacy, parameters)
    else await saveRelations(batch, adapter)
    let rewritten = 0
    const elapsed: number[] = []
    for (let n = 0; n < 5; n++) {
      const before = new Map(
        (await snapshot()).map((row) => [row.to_id, row.position]),
      )
      const start = performance.now()
      if (variant === 'baseline') await pool.query(legacy, parameters)
      else await saveRelations(batch, adapter)
      elapsed.push(Math.round((performance.now() - start) * 1000) / 1000)
      for (const row of await snapshot())
        if (before.get(row.to_id) !== row.position) rewritten++
    }
    const meaning = (await snapshot()).map(
      ({ position: _position, ...row }) => row,
    )
    if (variant === 'baseline') expected = meaning
    else assert.deepEqual(meaning, expected)
    result[variant] = {
      unchangedRowsRewritten: rewritten,
      upsertCalls: 5,
      localRoundtripMilliseconds: elapsed,
    }
    assert.equal(rewritten, variant === 'baseline' ? 2000 : 0)
  }
  await pool.query('update semantic_relation set active=false where to_id=$1', [
    ids[0],
  ])
  await Promise.all([
    saveRelations(
      [{ ...batch[0], votes: 7, reason: 'Stronger evidence' }],
      adapter,
    ),
    saveRelations(
      [
        {
          ...batch[0],
          votes: 1,
          reason: 'Human confirmation',
          source: 'human',
        },
      ],
      adapter,
    ),
  ])
  const final = (await snapshot()).find((row) => row.to_id === ids[0])!
  assert.equal(final.votes, 7)
  assert.equal(final.reason, 'Stronger evidence')
  assert.equal(final.source, 'human')
  assert.equal(final.active, false)
  await saveRelations([{ ...batch[0], votes: 1, source: 'human' }], adapter)
  assert.deepEqual(
    (await snapshot()).find((row) => row.to_id === ids[0]),
    final,
  )
  result.concurrentHigherVoteAndHumanPromotionPreserved = true
  result.deactivationPreserved = true
  result.sameVisibleData = true
  result.limit =
    'Conditional ON CONFLICT still performs index checks and row locking; not zero WAL, zero queries or a measured production CU/CPU saving.'
  return result
}
