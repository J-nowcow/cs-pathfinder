import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  hash,
  reviewedSqlHash,
  targetIdentity,
  validatePlan,
  type MigrationPlan,
} from '../../scripts/lib/library-migration'
const url = 'postgres://synthetic:password@localhost:5432/disposable'
const sql = readFileSync(
  new URL('../../supabase/migrations/0022_library_study.sql', import.meta.url),
  'utf8',
)
const backup = Buffer.from('synthetic schema-only archive')
const now = Date.parse('2026-10-28T01:00:00Z')
const plan: MigrationPlan = {
  version: 1,
  createdAt: new Date(now).toISOString(),
  target: targetIdentity(url),
  migration: '0022_library_study.sql',
  sqlHash: hash(sql),
  schemaHash: hash('schema'),
  backupHash: hash(backup),
}
describe('restricted library migration plans', () => {
  it('pins the reviewed SQL and allows credential rotation without changing the target', () => {
    expect(hash(sql)).toBe(reviewedSqlHash)
    expect(() =>
      validatePlan(
        plan,
        url.replace(':password@', ':rotated@'),
        sql,
        backup,
        now,
      ),
    ).not.toThrow()
  })
  it.each([
    url.replace('localhost', 'other.invalid'),
    url.replace('5432', '5433'),
    url.replace('synthetic:', 'other:'),
    url.replace('/disposable', '/other'),
  ])('refuses target host, port, role or database drift (%#)', (other) => {
    expect(() => validatePlan(plan, other, sql, backup, now)).toThrow(
      'PLAN_REFUSED',
    )
  })
  it.each([now - 1, now + 24 * 3600_000 + 1, NaN])(
    'refuses future, expired and invalid plan clocks (%#)',
    (clock) => {
      expect(() => validatePlan(plan, url, sql, backup, clock)).toThrow(
        'PLAN_REFUSED',
      )
    },
  )
  it('refuses modifying SQL even when a plan is rewritten to match it', () => {
    const changed = sql + '-- not reviewed'
    expect(() =>
      validatePlan(
        { ...plan, sqlHash: hash(changed) },
        url,
        changed,
        backup,
        now,
      ),
    ).toThrow('PLAN_REFUSED')
  })
  it('refuses unknown versions, different migrations and corrupt archive hashes', () => {
    for (const changed of [
      { version: 2 },
      { migration: '0021_seed_state.sql' },
      { schemaHash: 'bad' },
      { backupHash: hash('changed') },
      { createdAt: 'invalid' },
    ])
      expect(() =>
        validatePlan(
          { ...plan, ...changed } as MigrationPlan,
          url,
          sql,
          backup,
          now,
        ),
      ).toThrow('PLAN_REFUSED')
  })
})
