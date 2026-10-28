import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDb, resetDb, truncateAll } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { GET } from '@/app/api/node/[id]/route'
beforeAll(async () => {
  await resetDb()
  await ensureSeeded()
})
afterAll(truncateAll)
describe('invalid public node requests avoid DB initialization work', () => {
  it('returns404 without queries after the process seed promise is reset', async () => {
    const db = await getDb()
    resetSeedCache()
    const spy = vi.spyOn(db, 'query')
    try {
      const response = await GET(
        new Request('https://app.example/api/node/not-a-node'),
        { params: Promise.resolve({ id: 'not-a-node' }) },
      )
      const calls = spy.mock.calls.map(([sql]) =>
        sql.trim().split(/\s/)[0].toLowerCase(),
      )
      console.log(
        'INVALID_NODE_COST ' +
          JSON.stringify({
            fixture:
              'isolated PGlite, populated DB, process seed promise reset',
            queryCalls: calls.length,
            insertCalls: calls.filter((x) => x === 'insert').length,
            selectCalls: calls.filter((x) => x === 'select').length,
            status: response.status,
            productionMeasurement: false,
          }),
      )
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'not_found' })
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
