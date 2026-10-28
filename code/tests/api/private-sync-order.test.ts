import { beforeEach, describe, expect, it, vi } from 'vitest'

const control = vi.hoisted(() => ({
  owner: null as string | null,
  authFailure: null as Error | null,
  seedFailure: null as Error | null,
  events: [] as string[],
}))
vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => {
    control.events.push('session')
    if (control.authFailure) throw control.authFailure
    return control.owner
  },
}))
vi.mock('@/lib/db/bootstrap', () => ({
  ensureSeeded: async () => {
    control.events.push('seed')
    if (control.seedFailure) throw control.seedFailure
  },
}))
vi.mock('@/lib/db/journeys', () => ({
  loadJourneyForUser: async (owner: string) => {
    control.events.push(`read:${owner}`)
    return { occurrences: [], currentId: null }
  },
  mergeJourneyForUser: async (owner: string) => {
    control.events.push(`merge:${owner}`)
    return {
      kind: 'ok',
      droppedUnknown: 0,
      journey: { occurrences: [], currentId: null },
    }
  },
}))
vi.mock('@/lib/db/streaks', () => ({
  mergeStreakForUser: async (owner: string) => {
    control.events.push(`streak:${owner}`)
    return { days: {} }
  },
}))
import { GET } from '@/app/api/journey/route'
import { POST as merge } from '@/app/api/journey/merge/route'
import { POST as streak } from '@/app/api/streak/merge/route'

const routes = [
  {
    name: 'journey read',
    run: GET,
    method: 'GET',
    body: undefined,
    operation: 'read',
  },
  {
    name: 'journey merge',
    run: merge,
    method: 'POST',
    body: { occurrences: [], current_id: null },
    operation: 'merge',
  },
  {
    name: 'streak merge',
    run: streak,
    method: 'POST',
    body: { days: {} },
    operation: 'streak',
  },
]
beforeEach(() => {
  control.owner = null
  control.authFailure = null
  control.seedFailure = null
  control.events = []
})
describe('private sync failure and retry boundaries', () => {
  for (const route of routes) {
    const request = () =>
      new Request('https://fixture.example/api/private-sync', {
        method: route.method,
        ...(route.body
          ? { body: JSON.stringify({ ...route.body, userId: 'forged-owner' }) }
          : {}),
      })
    it(`${route.name}: unavailable corpus cannot turn a missing session into a seed failure`, async () => {
      control.seedFailure = new Error('Synthetic seed outage')
      const denied = await route.run(request())
      expect(denied.status).toBe(401)
      expect(denied.headers.get('cache-control')).toBe('private, no-store')
      expect(control.events).toEqual(['session'])
      control.owner = 'alice'
      await expect(route.run(request())).rejects.toThrow(
        'Synthetic seed outage',
      )
      control.seedFailure = null
      control.events = []
      const retry = await route.run(request())
      expect(retry.status).toBe(200)
      expect(retry.headers.get('cache-control')).toBe('private, no-store')
      expect(control.events).toEqual([
        'session',
        'seed',
        `${route.operation}:alice`,
      ])
      control.owner = 'bob'
      control.events = []
      expect((await route.run(request())).status).toBe(200)
      expect(control.events).toEqual([
        'session',
        'seed',
        `${route.operation}:bob`,
      ])
    })
    it(`${route.name}: authentication errors propagate before corpus or personal-data access`, async () => {
      control.authFailure = new Error('Synthetic authentication outage')
      await expect(route.run(request())).rejects.toThrow(
        'Synthetic authentication outage',
      )
      expect(control.events).toEqual(['session'])
    })
  }
})
