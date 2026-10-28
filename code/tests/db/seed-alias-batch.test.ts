import { beforeEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getDb, truncateAll, type Tx } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { insertSeedAliases } from '@/lib/db/seed-aliases'

const node = (question: string) =>
  insertNode({
    normalizedQuestion: question,
    identityScope: 'network',
    primaryCategory: 'network',
    body: 'Synthetic body',
    status: 'ready',
    origin: 'batch',
  })
beforeEach(truncateAll)

describe('seed alias batches', () => {
  it('keeps existing mappings, first input precedence and separate normalizer versions', async () => {
    const db = await getDb(),
      a = await node('Fixture A'),
      b = await node('Fixture B')
    await insertSeedAliases(db, 'v1', [{ hash: 'existing', nodeId: b }])
    await insertSeedAliases(db, 'v1', [
      { hash: 'existing', nodeId: a },
      { hash: 'new', nodeId: a },
      { hash: 'new', nodeId: b },
    ])
    await insertSeedAliases(db, 'v2', [{ hash: 'new', nodeId: b }])
    expect(
      await db.query(
        'select normalizer_version,normalized_hash,qnode_id from qnode_alias order by normalizer_version,normalized_hash',
      ),
    ).toEqual([
      { normalizer_version: 'v1', normalized_hash: 'existing', qnode_id: b },
      { normalizer_version: 'v1', normalized_hash: 'new', qnode_id: a },
      { normalizer_version: 'v2', normalized_hash: 'new', qnode_id: b },
    ])
  })

  it('retries a partially completed batch without erasing the committed mappings', async () => {
    const db = await getDb(),
      a = await node('Fixture A')
    const rows = Array.from({ length: 600 }, (_, i) => ({
      hash: 'fixture-' + i,
      nodeId: a,
    }))
    let attempt = 0
    const failing: Tx = {
      query: async <T>(sql: string, params?: unknown[]) => {
        if (++attempt === 2) throw new Error('Synthetic transport failure')
        return db.query<T>(sql, params)
      },
    }
    await expect(insertSeedAliases(failing, 'fixture', rows)).rejects.toThrow(
      'Synthetic transport failure',
    )
    const before = await db.query<{ normalized_hash: string; id: string }>(
      'select normalized_hash,id from qnode_alias',
    )
    expect(before.length).toBeGreaterThan(0)
    expect(before.length).toBeLessThan(rows.length)
    await insertSeedAliases(db, 'fixture', rows)
    const after = await db.query<{ normalized_hash: string; id: string }>(
      'select normalized_hash,id from qnode_alias',
    )
    expect(after).toHaveLength(rows.length)
    for (const original of before)
      expect(
        after.find((row) => row.normalized_hash === original.normalized_hash),
      ).toEqual(original)
  })

  it('keeps valid-request seed roundtrips within the batch budget', async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--import', 'tsx', 'scripts/measure-seed-startup.ts'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: 'test',
          USE_REAL_DB: '0',
          DATABASE_URL: '',
          NODE_TLS_REJECT_UNAUTHORIZED: '1',
        },
        timeout: 25_000,
      },
    )
    const report = JSON.parse(stdout.trim())
    expect(
      report.samples.every(
        (sample: { status: number }) => sample.status === 200,
      ),
    ).toBe(true)
    for (const sample of report.samples.slice(1, 4)) {
      expect(sample.aliasInserts).toBeLessThan(report.publicData.aliases / 10)
      expect(sample.queries).toBeLessThan(report.publicData.nodes * 2)
    }
    expect(report.samples.at(-1).aliasInserts).toBe(0)
  })
})
