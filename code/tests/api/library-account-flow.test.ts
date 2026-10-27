import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { resetDb, getDb } from '@/lib/db/client'
import {
  LibraryAccountClient,
  libraryAccountKey,
  type AccountTransport,
} from '@/lib/library/account-client'
import { editLibrary } from '@/lib/library/local-edit'
import { LIBRARY_KEY } from '@/lib/library/storage'
const auth = vi.hoisted(() => ({ user: 'alice' }))
vi.mock('@/lib/auth/session', () => ({ readUserId: async () => auth.user }))
const { GET, PUT } = await import('@/app/api/library-study/route')
const url = 'https://app.example/api/library-study'
function memory() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}
const transport: AccountTransport = async (_url, init) => {
  const headers = new Headers(init?.headers)
  headers.set('origin', 'https://app.example')
  const request = new Request(url, { ...init, headers })
  return init?.method === 'PUT' ? PUT(request) : GET(request)
}
const meta = {
  title: 'Normal forms',
  href: '/learn/engineer/normalization',
  track: 'engineer' as const,
}
const id = 'topic:normalization'
beforeEach(async () => {
  const db = await resetDb()
  for (const owner of ['alice', 'bob'])
    await db.query(
      'insert into "user" ("id", "name", "email", "emailVerified") values ($1, $1, $2, true)',
      [owner, owner + '@example.invalid'],
    )
  auth.user = 'alice'
  vi.stubEnv('LIBRARY_ACCOUNT_SYNC_ENABLED', '1')
})
afterEach(() => vi.unstubAllEnvs())
describe('account client through real route and isolated PGlite', () => {
  it('writes an explanation, checks and review, restores in another client, isolates accounts, and cascades deletion', async () => {
    const local = memory()
    editLibrary(
      local,
      id,
      meta,
      { kind: 'draft', text: 'Guest untouched', expected: '' },
      '2026-10-28T00:00:00Z',
    )
    const guest = local.getItem(LIBRARY_KEY)
    const alice = new LibraryAccountClient(
      'alice',
      local,
      transport,
      () => auth.user,
    )
    await alice.open()
    expect(alice.get().working.entries[id]).toBeUndefined()
    alice.importGuest()
    const store = alice.scopedStorage()
    editLibrary(
      store,
      id,
      meta,
      {
        kind: 'draft',
        text: 'My account explanation',
        expected: 'Guest untouched',
      },
      '2026-10-28T00:01:00Z',
    )
    editLibrary(
      store,
      id,
      meta,
      { kind: 'check', value: 'Dependencies explained', checked: true },
      '2026-10-28T00:02:00Z',
    )
    editLibrary(
      store,
      id,
      meta,
      { kind: 'review', status: 'review' },
      '2026-10-28T00:03:00Z',
    )
    await alice.flush()
    const other = new LibraryAccountClient(
      'alice',
      memory(),
      transport,
      () => auth.user,
    )
    await other.open()
    expect(other.get().working.entries[id]).toMatchObject({
      draft: 'My account explanation',
      checks: ['Dependencies explained'],
      status: 'review',
      due: '2026-10-29',
    })
    expect(local.getItem(LIBRARY_KEY)).toBe(guest)
    auth.user = 'bob'
    const bob = new LibraryAccountClient(
      'bob',
      local,
      transport,
      () => auth.user,
    )
    await bob.open()
    expect(bob.get().working.entries).toEqual({})
    expect(() => alice.get()).toThrow()
    expect(local.getItem(libraryAccountKey('alice'))).toContain(
      'My account explanation',
    )
    const db = await getDb()
    await db.query('delete from "user" where id = $1', ['alice'])
    expect(
      await db.query(
        'select * from library_study_snapshot where user_id = $1',
        ['alice'],
      ),
    ).toEqual([])
    expect(
      await db.query('select * from library_study_write where user_id = $1', [
        'alice',
      ]),
    ).toEqual([])
    expect(local.getItem(libraryAccountKey('alice'))).toContain(
      'My account explanation',
    )
  })
  it('recovers a committed write whose response was lost without duplicate revision or lost subsequent edits', async () => {
    const local = memory()
    let lose = true
    const client = new LibraryAccountClient(
      'alice',
      local,
      async (path, init) => {
        const response = await transport(path, init)
        if (init?.method && lose) {
          lose = false
          throw Error('reply lost after commit')
        }
        return response
      },
      () => auth.user,
    )
    await client.open()
    const store = client.scopedStorage()
    editLibrary(
      store,
      id,
      meta,
      { kind: 'draft', text: 'Sent', expected: '' },
      '2026-10-28T00:00:00Z',
    )
    await expect(client.flush()).rejects.toMatchObject({ code: 'offline' })
    editLibrary(
      store,
      id,
      meta,
      { kind: 'draft', text: 'Edited while pending', expected: 'Sent' },
      '2026-10-28T00:01:00Z',
    )
    await client.flush()
    expect(client.get().base.revision).toBe(1)
    expect(client.get().working.entries[id].draft).toBe('Edited while pending')
    await client.flush()
    expect(client.get().base.revision).toBe(2)
    const db = await getDb()
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from library_study_write where user_id = $1',
          ['alice'],
        )
      )[0].n,
    ).toBe(2)
  })
})
