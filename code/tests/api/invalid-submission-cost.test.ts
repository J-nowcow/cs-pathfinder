import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFile } from 'node:fs/promises'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { MAX_OCCURRENCES } from '@/lib/journey/storage'
import { MAX_DAYS } from '@/lib/streak/storage'
import { MAX_SNAPSHOT_NODES } from '@/lib/tree/snapshot'

vi.mock('@/lib/auth/session', () => ({ readUserId: async () => 'fixture-owner' }))
vi.mock('@/lib/db/bootstrap', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/db/bootstrap')>()
  return { ...real, ensureSeeded: vi.fn(real.ensureSeeded) }
})
import { POST as share } from '@/app/api/share/route'
import { POST as journey } from '@/app/api/journey/merge/route'
import { POST as streak } from '@/app/api/streak/merge/route'

if (process.env.USE_REAL_DB !== '0' || process.env.DATABASE_URL?.trim())
  throw new Error('Invalid-submission fixture requires isolated PGlite')

const occurrence = {
  id: 'fixture',
  node_id: '99999999-9999-4999-8999-999999999999',
  parent_id: null,
}
const routes = [
  {
    name: 'share', run: share,
    invalid: { occurrences: 'invalid', current_id: 'fixture' },
    excessive: { occurrences: Array(MAX_SNAPSHOT_NODES + 1).fill(occurrence), current_id: 'fixture' },
  },
  {
    name: 'journey', run: journey,
    invalid: { occurrences: 'invalid', current_id: null },
    excessive: { occurrences: Array(MAX_OCCURRENCES + 1).fill(occurrence), current_id: null },
  },
  {
    name: 'streak', run: streak,
    invalid: { days: 'invalid' },
    excessive: { days: Object.fromEntries(Array.from({ length: MAX_DAYS + 1 }, (_, i) => [String(i), []])) },
  },
]
const samples: unknown[] = []
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
})
afterAll(async () => {
  if (process.env.INVALID_SUBMISSION_COST_REPORT)
    await writeFile(process.env.INVALID_SUBMISSION_COST_REPORT, JSON.stringify({
      at: new Date().toISOString(),
      fixture: 'Ephemeral PGlite, synthetic authenticated private requests and anonymous share; no production access',
      samples,
      authQueriesExcluded: true,
      cpuCuBillingMeasured: false,
      limits: 'One sample per route/input/seed condition. Schema initialization and setup seeding excluded. Seed promise reset is not a whole-process cold start.',
    }, null, 2) + '\n')
})

describe('invalid submissions do not prepare the public corpus', () => {
  for (const condition of ['empty', 'populated-reset', 'warm'] as const)
    for (const route of routes)
      for (const input of ['malformed-json', 'invalid-shape', 'excessive-count'] as const)
        it(`${route.name}: ${condition}, ${input}`, async () => {
          if (condition !== 'empty') await ensureSeeded()
          if (condition !== 'warm') resetSeedCache()
          vi.mocked(ensureSeeded).mockClear()
          const db = await getDb(), original = db.query.bind(db)
          const calls: string[] = []
          const spy = vi.spyOn(db, 'query').mockImplementation(async (sql, params) => {
            calls.push(sql)
            return original(sql, params)
          })
          let response: Response
          try {
            response = await route.run(new Request('https://fixture.example/api/' + route.name, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: input === 'malformed-json' ? '{invalid JSON' : JSON.stringify(input === 'invalid-shape' ? route.invalid : route.excessive),
            }))
          } finally { spy.mockRestore() }
          const body = await response.text()
          samples.push({ route: route.name, condition, input, status: response.status, body,
            cacheControl: response.headers.get('cache-control'),
            seedCalls: vi.mocked(ensureSeeded).mock.calls.length,
            queries: calls.length,
            writeStatements: calls.filter((sql) => /^\s*(insert|update|delete)\b/i.test(sql)).length,
          })
          expect(response.status).toBe(400)
          expect(JSON.parse(body).error).toBe('invalid_input')
          expect(response.headers.get('cache-control')).toBe('private, no-store')
          expect(calls).toEqual([])
          expect(ensureSeeded).not.toHaveBeenCalled()
        })
})
