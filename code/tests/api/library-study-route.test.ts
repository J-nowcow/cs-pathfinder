import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { getDb, resetDb } from '@/lib/db/client'
import { MAX_LIBRARY_BYTES } from '@/lib/library/account-schema'
const auth = vi.hoisted(() => ({ user: null as string | null, calls: 0 }))
vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => {
    auth.calls++
    return auth.user
  },
}))
const { GET, PUT } = await import('@/app/api/library-study/route')
const url = 'https://app.example/api/library-study'
const badOrigins: Record<string, string>[] = [
  { origin: 'https://evil.example' },
  { origin: '' },
  { 'sec-fetch-site': 'cross-site' },
]
const body = () => ({
  baseRevision: 0,
  requestId: randomUUID(),
  state: { version: 1, entries: {} },
})
const request = (
  data: unknown = body(),
  headers: Record<string, string> = {},
) =>
  new Request(url, {
    method: 'PUT',
    headers: {
      origin: 'https://app.example',
      'content-type': 'application/json',
      'x-library-owner': 'alice',
      ...headers,
    },
    body: JSON.stringify(data),
  })
beforeEach(async () => {
  const db = await resetDb()
  for (const id of ['alice', 'bob'])
    await db.query(
      'insert into "user" ("id", "name", "email", "emailVerified") values ($1, $1, $2, true)',
      [id, id + '@example.invalid'],
    )
  vi.stubEnv('LIBRARY_ACCOUNT_SYNC_ENABLED', '1')
  auth.user = null
  auth.calls = 0
})
afterEach(() => vi.unstubAllEnvs())
describe('private library account API', () => {
  it('stays disabled without rollout approval and never initializes auth', async () => {
    vi.stubEnv('LIBRARY_ACCOUNT_SYNC_ENABLED', '')
    expect((await GET(new Request(url))).status).toBe(503)
    expect((await PUT(request())).status).toBe(503)
    expect(auth.calls).toBe(0)
  })
  it('requires a session, returns private no-store responses, and never seeds', async () => {
    const a = await GET(new Request(url)),
      b = await PUT(request())
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.headers.get('cache-control')).toBe('private, no-store')
    const db = await getDb()
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from qnode'))[0].n,
    ).toBe(0)
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from library_study_snapshot',
        )
      )[0].n,
    ).toBe(0)
  })
  it('uses only the session owner and rejects supplied owner IDs', async () => {
    auth.user = 'alice'
    expect((await PUT(request({ ...body(), userId: 'bob' }))).status).toBe(400)
    expect((await PUT(request())).status).toBe(200)
    const alice = await (await GET(new Request(url))).json()
    expect(alice.revision).toBe(1)
    auth.user = 'bob'
    expect(await (await GET(new Request(url))).json()).toEqual({
      ownerId: 'bob',
      revision: 0,
      state: { version: 1, entries: {} },
    })
  })
  it('refuses a changed session owner before writing any account snapshot', async () => {
    auth.user = 'bob'
    const res = await PUT(request())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'account_changed' })
    const db = await getDb()
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from library_study_snapshot',
        )
      )[0].n,
    ).toBe(0)
  })
  it.each(badOrigins)(
    'rejects cross-origin writes before session work',
    async (headers) => {
      expect((await PUT(request(body(), headers))).status).toBe(403)
      expect(auth.calls).toBe(0)
    },
  )
  it('rejects non-JSON, malformed JSON, invalid dates, excessive entries and oversize bodies', async () => {
    auth.user = 'alice'
    expect(
      (await PUT(request(body(), { 'content-type': 'text/plain' }))).status,
    ).toBe(415)
    expect(
      (
        await PUT(
          new Request(url, {
            method: 'PUT',
            headers: {
              origin: 'https://app.example',
              'content-type': 'application/json',
              'x-library-owner': 'alice',
            },
            body: '{bad',
          }),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await PUT(
          request(body(), { 'content-length': String(MAX_LIBRARY_BYTES + 1) }),
        )
      ).status,
    ).toBe(413)
    expect(
      (await PUT(request({ padding: 'x'.repeat(MAX_LIBRARY_BYTES) }))).status,
    ).toBe(413)
    const entries = Object.fromEntries(
      Array.from({ length: 201 }, (_, n) => ['topic:t' + n, {}]),
    )
    expect(
      (await PUT(request({ ...body(), state: { version: 1, entries } })))
        .status,
    ).toBe(400)
  })
  it('acknowledges retries and returns409 with current data for stale clients', async () => {
    auth.user = 'alice'
    const first = body()
    expect((await PUT(request(first))).status).toBe(200)
    expect(await (await PUT(request(first))).json()).toMatchObject({
      kind: 'ok',
      replayed: true,
      acknowledgedRevision: 1,
    })
    const stale = await PUT(request(body()))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      kind: 'conflict',
      snapshot: { revision: 1 },
    })
  })
  it('returns unavailable for a missing migration without creating tables or changing guest data', async () => {
    auth.user = 'alice'
    const db = await getDb()
    await db.exec(
      'drop table library_study_write; drop table library_study_snapshot;',
    )
    expect((await GET(new Request(url))).status).toBe(503)
    expect((await PUT(request())).status).toBe(503)
    expect(
      (
        await db.query<{ present: boolean }>(
          "select to_regclass('public.library_study_snapshot') is not null as present",
        )
      )[0].present,
    ).toBe(false)
  })
})
