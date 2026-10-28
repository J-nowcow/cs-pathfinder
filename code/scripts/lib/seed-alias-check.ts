import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Pool } from 'pg'
import type { Tx } from '../../src/lib/db/client'
import { insertSeedAliases } from '../../src/lib/db/seed-aliases'

/** Only the verifier's owned disposable PostgreSQL database may run this fixture. */
export async function checkSeedAliasBatch(pool: Pool, schemaPath: string) {
  assert.equal(
    (await pool.query('select current_database() name')).rows[0].name,
    'cs_pathfinder_seed_alias_check',
  )
  await pool.query('create table qnode(id uuid primary key)')
  const ddl = readFileSync(schemaPath, 'utf8').match(
    /create table qnode_alias \([\s\S]*?\n\);/,
  )?.[0]
  assert(ddl)
  await pool.query(ddl)
  const a = randomUUID(),
    b = randomUUID()
  await pool.query('insert into qnode(id) values($1),($2)', [a, b])
  const rows = Array.from({ length: 430 }, (_, i) => ({
    hash: 'synthetic-' + i,
    nodeId: a,
  }))
  let queries = 0
  const adapter: Tx = {
    query: async <T>(sql: string, params?: unknown[]) => {
      queries++
      return (await pool.query(sql, params)).rows as T[]
    },
  }
  const snapshot = async () =>
    (
      await pool.query(
        'select normalizer_version,normalized_hash,qnode_id from qnode_alias order by normalizer_version,normalized_hash',
      )
    ).rows
  const setup = async () => {
    await pool.query('truncate qnode_alias')
    await pool.query(
      'insert into qnode_alias(normalizer_version,normalized_hash,qnode_id) values($1,$2,$3)',
      ['fixture', rows[0].hash, b],
    )
  }
  await setup()
  for (const row of rows)
    await pool.query(
      `insert into qnode_alias(normalizer_version,normalized_hash,qnode_id) values($1,$2,$3)
     on conflict(normalizer_version,normalized_hash) do nothing`,
      ['fixture', row.hash, row.nodeId],
    )
  const expected = await snapshot()
  await setup()
  await insertSeedAliases(adapter, 'fixture', [
    ...rows,
    { hash: rows[1].hash, nodeId: b },
  ])
  assert.equal(queries, 2)
  assert.deepEqual(await snapshot(), expected)
  const versions = (
    await pool.query('select id,ctid::text tuple from qnode_alias order by id')
  ).rows
  await insertSeedAliases(adapter, 'fixture', rows)
  assert.deepEqual(
    (
      await pool.query(
        'select id,ctid::text tuple from qnode_alias order by id',
      )
    ).rows,
    versions,
  )

  await pool.query('truncate qnode_alias')
  let attempt = 0
  const failing: Tx = {
    query: async <T>(sql: string, params?: unknown[]) => {
      if (++attempt === 2)
        throw new Error('Synthetic second-batch transport failure')
      return (await pool.query(sql, params)).rows as T[]
    },
  }
  await assert.rejects(insertSeedAliases(failing, 'retry', rows))
  const partial = (await pool.query('select count(*)::int n from qnode_alias'))
    .rows[0].n
  assert(partial > 0 && partial < rows.length)
  await insertSeedAliases(adapter, 'retry', rows)
  assert.equal(
    (await pool.query('select count(*)::int n from qnode_alias')).rows[0].n,
    rows.length,
  )
  await insertSeedAliases(adapter, 'another-version', [
    { hash: rows[0].hash, nodeId: b },
  ])
  assert.equal(
    (
      await pool.query(
        'select qnode_id from qnode_alias where normalizer_version=$1',
        ['another-version'],
      )
    ).rows[0].qnode_id,
    b,
  )

  await assert.rejects(
    insertSeedAliases(adapter, 'bad-fk', [
      { hash: 'valid', nodeId: a },
      { hash: 'missing', nodeId: randomUUID() },
    ]),
  )
  assert.equal(
    (
      await pool.query(
        'select count(*)::int n from qnode_alias where normalizer_version=$1',
        ['bad-fk'],
      )
    ).rows[0].n,
    0,
  )

  const holder = await pool.connect()
  let pending: Promise<void> | undefined
  try {
    await holder.query('begin')
    await insertSeedAliases(
      {
        query: async <T>(sql: string, params?: unknown[]) =>
          (await holder.query(sql, params)).rows as T[],
      },
      'concurrent',
      [{ hash: 'locked', nodeId: b }],
    )
    pending = insertSeedAliases(adapter, 'concurrent', [
      { hash: 'locked', nodeId: a },
    ])
    let blocked = false
    for (let i = 0; i < 200; i++) {
      const rows = (
        await pool.query(
          "select 1 from pg_stat_activity where datname=current_database() and wait_event='transactionid'",
        )
      ).rows
      if (rows.length) {
        blocked = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert(
      blocked,
      'A competing insert must wait on the uncommitted unique key',
    )
    await holder.query('commit')
    await pending
    assert.equal(
      (
        await pool.query(
          'select qnode_id from qnode_alias where normalizer_version=$1',
          ['concurrent'],
        )
      ).rows[0].qnode_id,
      b,
    )
  } finally {
    await holder.query('rollback')
    holder.release()
    await pending
  }
  return {
    productionAccess: false,
    aliases: rows.length,
    baselineInsertStatements: rows.length,
    batchedInsertStatements: 2,
    sameMappings: true,
    firstInputPrecedence: true,
    existingAliasPreserved: true,
    noTupleRewriteOnReplay: true,
    partialBatchRetry: true,
    distinctNormalizerVersions: true,
    foreignKeyBatchAtomicity: true,
    concurrentConflictPreserved: true,
    limit:
      'Owned PostgreSQL/TLS synthetic fixture; no production CPU/CU, application seed concurrency or OAuth claim.',
  }
}
