import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  owner: 'alice' as string | null,
  authFailure: null as Error | null,
  seedFailure: null as Error | null,
  events: [] as string[],
}))
vi.mock('@/lib/auth/session', () => ({ readUserId: async () => {
  control.events.push('session')
  if (control.authFailure) throw control.authFailure
  return control.owner
} }))
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: async () => {
  control.events.push('seed')
  if (control.seedFailure) throw control.seedFailure
} }))
vi.mock('@/lib/db/trees', () => ({ createSharedTree: async () => {
  control.events.push('share')
  return { ok: true, slug: 'fixture', title: 'Fixture title' }
} }))
vi.mock('@/lib/db/journeys', () => ({ mergeJourneyForUser: async (owner: string) => {
  control.events.push('journey:' + owner)
  return { kind: 'ok', droppedUnknown: 0, journey: { occurrences: [], currentId: null } }
} }))
vi.mock('@/lib/db/streaks', () => ({ mergeStreakForUser: async (owner: string) => {
  control.events.push('streak:' + owner)
  return { days: {} }
} }))
import { POST as share } from '@/app/api/share/route'
import { POST as journey } from '@/app/api/journey/merge/route'
import { POST as streak } from '@/app/api/streak/merge/route'

const routes = [
  { name: 'share', run: share, private: false, valid: { occurrences: [{ id: 'root', node_id: '99999999-9999-4999-8999-999999999999', parent_id: null }], current_id: 'root' } },
  { name: 'journey', run: journey, private: true, valid: { occurrences: [], current_id: null } },
  { name: 'streak', run: streak, private: true, valid: { days: {} } },
]
function request(raw: string) {
  const req = new Request('https://fixture.example/api/submission', { method: 'POST', body: raw })
  const json = req.json.bind(req)
  vi.spyOn(req, 'json').mockImplementation(() => { control.events.push('parse'); return json() })
  return req
}
beforeEach(() => {
  control.owner = 'alice'; control.authFailure = null; control.seedFailure = null; control.events = []
})
describe('submission admission and recovery order', () => {
  for (const route of routes) {
    for (const input of ['{invalid', '{}'])
      it(`${route.name}: invalid input is rejected even during a corpus outage`, async () => {
        control.seedFailure = new Error('Synthetic corpus outage')
        const response = await route.run(request(input))
        expect(response.status).toBe(400)
        expect((await response.json()).error).toBe('invalid_input')
        expect(response.headers.get('cache-control')).toBe('private, no-store')
        expect(control.events).toEqual(route.private ? ['session', 'parse'] : ['parse'])
      })
    it(`${route.name}: valid input still requires seed, propagates its failure, and can retry`, async () => {
      control.seedFailure = new Error('Synthetic corpus outage')
      await expect(route.run(request(JSON.stringify(route.valid)))).rejects.toThrow('Synthetic corpus outage')
      expect(control.events).toEqual([...(route.private ? ['session'] : []), 'parse', 'seed'])
      control.events = []; control.seedFailure = null
      const response = await route.run(request(JSON.stringify({ ...route.valid, userId: 'forged-owner' })))
      expect(response.status).toBe(route.private ? 200 : 201)
      expect(control.events).toEqual([...(route.private ? ['session'] : []), 'parse', 'seed', route.private ? route.name + ':alice' : 'share'])
    })
    if (route.private) {
      it(`${route.name}: absent and failing sessions still prevent parsing and seeding`, async () => {
        control.owner = null
        expect((await route.run(request('{invalid'))).status).toBe(401)
        expect(control.events).toEqual(['session'])
        control.events = []; control.authFailure = new Error('Synthetic auth outage')
        await expect(route.run(request('{}'))).rejects.toThrow('Synthetic auth outage')
        expect(control.events).toEqual(['session'])
      })
    }
  }
})
