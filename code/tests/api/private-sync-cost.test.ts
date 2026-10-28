import { beforeEach, describe, expect, it, vi } from 'vitest'
import { writeFile } from 'node:fs/promises'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'

const session = vi.hoisted(() => ({
  read: vi.fn(async (_headers: Headers) => null),
}))
vi.mock('@/lib/auth/session', () => ({ readUserId: session.read }))
import { GET } from '@/app/api/journey/route'
import { POST as journeyMerge } from '@/app/api/journey/merge/route'
import { POST as streakMerge } from '@/app/api/streak/merge/route'

if (process.env.USE_REAL_DB !== '0' || process.env.DATABASE_URL?.trim()) {
  throw new Error(
    'Cost fixture requires USE_REAL_DB=0 and an empty DATABASE_URL',
  )
}

const routes = [
  { name: 'journey read', path: '/api/journey', method: 'GET', run: GET },
  {
    name: 'journey merge',
    path: '/api/journey/merge',
    method: 'POST',
    run: journeyMerge,
  },
  {
    name: 'streak merge',
    path: '/api/streak/merge',
    method: 'POST',
    run: streakMerge,
  },
]
const measurements: unknown[] = []
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
  session.read.mockClear()
})

describe('private sync rejects expired sessions without public corpus work', () => {
  for (const populated of [false, true])
    for (const route of routes) {
      it(`${route.name}: ${populated ? 'populated DB, seed promise reset' : 'empty DB, first request'}`, async () => {
        if (populated) await ensureSeeded()
        resetSeedCache()
        const db = await getDb()
        const original = db.query.bind(db)
        const calls: string[] = []
        const spy = vi
          .spyOn(db, 'query')
          .mockImplementation(async (sql, params) => {
            calls.push(sql)
            return original(sql, params)
          })
        const request = new Request('https://fixture.example' + route.path, {
          method: route.method,
          headers: { 'x-user-id': 'untrusted-owner' },
          ...(route.method === 'POST' ? { body: '{invalid JSON' } : {}),
        })
        const parse = vi.spyOn(request, 'json')
        let response: Response
        try {
          response = await route.run(request)
        } finally {
          spy.mockRestore()
        }
        expect(response.status).toBe(401)
        expect(await response.text()).toBe('{"error":"unauthorized"}')
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(session.read).toHaveBeenCalledExactlyOnceWith(request.headers)
        expect(parse).not.toHaveBeenCalled()
        expect(calls).toEqual([])
        expect(
          (
            await db.query<{ count: number }>(
              'select count(*)::int count from qnode',
            )
          )[0].count > 0,
        ).toBe(populated)
        for (const table of [
          'journey_occurrence',
          'journey_cursor',
          'streak_read',
        ])
          expect(
            (
              await db.query<{ count: number }>(
                `select count(*)::int count from ${table}`,
              )
            )[0].count,
          ).toBe(0)
        measurements.push({
          route: route.name,
          condition: populated
            ? 'populated database; seed promise reset'
            : 'empty database; first request',
          queries: calls.length,
          writeStatements: calls.filter((sql) =>
            /^\s*(insert|update|delete)\b/i.test(sql),
          ).length,
          status: response.status,
        })
        if (process.env.PRIVATE_SYNC_COST_REPORT)
          await writeFile(
            process.env.PRIVATE_SYNC_COST_REPORT,
            JSON.stringify(
              {
                checkedAt: new Date().toISOString(),
                fixture:
                  'Ephemeral PGlite with initialized schema and synthetic null session; empty DATABASE_URL and no production access',
                samples: measurements,
                authQueriesExcluded: true,
                cpuCuBillingMeasured: false,
                limit:
                  'Schema migrations, module loading and actual better-auth session queries excluded. Reset simulates only seed promise, not actual process cold start. Each route/condition sampled once.',
              },
              null,
              2,
            ) + '\n',
          )
      })
    }
})
