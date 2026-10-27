import { beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { getDb, resetDb, type Db } from '@/lib/db/client'
import { loadLibraryForUser, writeLibraryForUser } from '@/lib/db/library-study'
import { emptyLibrary, parseLibrary } from '@/lib/library/storage'
import type { LibraryState } from '@/lib/library/storage'
import { libraryAccountStateSchema } from '@/lib/library/account-schema'
const state = (draft = 'My explanation'): LibraryState => ({
  version: 1,
  entries: {
    'topic:normalization': {
      title: 'Normal forms',
      href: '/learn/engineer/normalization',
      track: 'engineer',
      visitedAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:01:00Z',
      draft,
      checks: ['Dependencies identified'],
      status: 'review',
      due: '2026-10-29',
    },
  },
})
const write = (baseRevision = 0, draft?: string, requestId = randomUUID()) => ({
  baseRevision,
  state: state(draft),
  requestId,
})
beforeEach(async () => {
  const db = await resetDb()
  for (const id of ['alice', 'bob'])
    await db.query(
      'insert into "user" ("id", "name", "email", "emailVerified") values ($1, $1, $2, true)',
      [id, id + '@example.invalid'],
    )
})
describe('account library snapshots', () => {
  it('strictly validates legacy-shaped entries without silently dropping invalid or future fields', () => {
    const good = state()
    expect(libraryAccountStateSchema.parse(good)).toEqual(good)
    const entry = good.entries['topic:normalization']
    for (const change of [
      { due: '2026-02-30' },
      { draft: 'x'.repeat(6001) },
      { href: 'https://evil.example' },
      { futureField: true },
      { checks: Array(31).fill('check') },
    ]) {
      expect(
        libraryAccountStateSchema.safeParse({
          version: 1,
          entries: { 'topic:normalization': { ...entry, ...change } },
        }).success,
      ).toBe(false)
    }
    expect(
      libraryAccountStateSchema.safeParse({ ...good, version: 2 }).success,
    ).toBe(false)
    const entries = Object.fromEntries(
      Array.from({ length: 200 }, (_, n) => ['topic:item-' + n, entry]),
    )
    expect(
      libraryAccountStateSchema.safeParse({ version: 1, entries }).success,
    ).toBe(true)
    entries['topic:extra'] = entry
    expect(
      libraryAccountStateSchema.safeParse({ version: 1, entries }).success,
    ).toBe(false)
  })
  it('loads an empty account without creating records and preserves schema1 backup values', async () => {
    expect(await loadLibraryForUser('alice')).toEqual({
      revision: 0,
      state: emptyLibrary(),
    })
    const result = await writeLibraryForUser('alice', write())
    expect(result.kind).toBe('ok')
    const saved = await loadLibraryForUser('alice')
    expect(saved).toEqual({ revision: 1, state: state() })
    expect(parseLibrary(JSON.stringify(saved.state))).toEqual(saved.state)
  })
  it('isolates owners, including request IDs and deletion cascades', async () => {
    const requestId = randomUUID()
    await writeLibraryForUser(
      'alice',
      write(0, 'Alice private draft', requestId),
    )
    expect(await loadLibraryForUser('bob')).toEqual({
      revision: 0,
      state: emptyLibrary(),
    })
    await writeLibraryForUser('bob', write(0, 'Bob private draft', requestId))
    const db = await getDb()
    await db.query('delete from "user" where id = $1', ['alice'])
    expect(await loadLibraryForUser('alice')).toEqual({
      revision: 0,
      state: emptyLibrary(),
    })
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from library_study_write where user_id = $1',
          ['alice'],
        )
      )[0].n,
    ).toBe(0)
    expect(
      (await loadLibraryForUser('bob')).state.entries['topic:normalization']
        .draft,
    ).toBe('Bob private draft')
  })
  it('refuses stale revisions without replacing stored drafts, checks or review', async () => {
    await writeLibraryForUser('alice', write())
    const result = await writeLibraryForUser('alice', write(0, 'Stale draft'))
    expect(result).toEqual({
      kind: 'conflict',
      snapshot: { revision: 1, state: state() },
    })
    expect((await loadLibraryForUser('alice')).revision).toBe(1)
  })
  it('replays a lost acknowledgement without rewriting a later snapshot', async () => {
    const first = write()
    await writeLibraryForUser('alice', first)
    await writeLibraryForUser('alice', write(1, 'Later edit'))
    const retry = await writeLibraryForUser('alice', first)
    expect(retry).toMatchObject({
      kind: 'ok',
      replayed: true,
      acknowledgedRevision: 1,
      snapshot: { revision: 2 },
    })
    expect(
      (await loadLibraryForUser('alice')).state.entries['topic:normalization']
        .draft,
    ).toBe('Later edit')
  })
  it('refuses changing a payload under the same request ID, even at a new base', async () => {
    const first = write()
    await writeLibraryForUser('alice', first)
    expect(
      await writeLibraryForUser('alice', {
        ...first,
        baseRevision: 1,
        state: state('Changed payload'),
      }),
    ).toEqual({ kind: 'request_id_reused' })
    expect((await loadLibraryForUser('alice')).revision).toBe(1)
  })
  it('uses stable object-key ordering for identical retransmissions', async () => {
    const first = write()
    await writeLibraryForUser('alice', first)
    const entry = first.state.entries['topic:normalization']
    const reordered = Object.fromEntries(
      Object.entries(entry).reverse(),
    ) as typeof entry
    expect(
      await writeLibraryForUser('alice', {
        ...first,
        state: { entries: { 'topic:normalization': reordered }, version: 1 },
      }),
    ).toMatchObject({ kind: 'ok', replayed: true })
  })
  it('retains at most64 receipts; an older retry still conflicts instead of overwriting', async () => {
    const first = write()
    await writeLibraryForUser('alice', first)
    for (let revision = 1; revision <= 65; revision++)
      await writeLibraryForUser('alice', write(revision, 'Edit ' + revision))
    const db = await getDb()
    expect(
      (
        await db.query<{ n: number }>(
          'select count(*)::int n from library_study_write where user_id = $1',
          ['alice'],
        )
      )[0].n,
    ).toBe(64)
    expect(await writeLibraryForUser('alice', first)).toMatchObject({
      kind: 'conflict',
      snapshot: { revision: 66 },
    })
  })
  it('rolls back the draft when recording its acknowledgement fails', async () => {
    await writeLibraryForUser('alice', write())
    const db = await getDb()
    const fault: Db = {
      ...db,
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({
            query: async (sql, params) => {
              if (sql.startsWith('insert into library_study_write'))
                throw Error('test receipt failure')
              return tx.query(sql, params)
            },
          }),
        ),
    }
    await expect(
      writeLibraryForUser('alice', write(1, 'Must roll back'), fault),
    ).rejects.toThrow('test receipt failure')
    expect(await loadLibraryForUser('alice')).toEqual({
      revision: 1,
      state: state(),
    })
  })
  it('rejects corrupt server state instead of returning an empty reset', async () => {
    await writeLibraryForUser('alice', write())
    const db = await getDb()
    await db.query(
      'update library_study_snapshot set state = $2::jsonb where user_id = $1',
      ['alice', JSON.stringify({ version: 1, entries: { invalid: {} } })],
    )
    await expect(loadLibraryForUser('alice')).rejects.toThrow()
    await expect(writeLibraryForUser('alice', write(1))).rejects.toThrow()
  })
  it('keeps direct non-owner access denied even if SELECT is granted', async () => {
    await writeLibraryForUser('alice', write())
    const db = await getDb()
    await db.exec(
      'create role library_test_reader; grant select on library_study_snapshot, library_study_write to library_test_reader;',
    )
    try {
      await db.transaction(async (tx) => {
        await tx.query('set local role library_test_reader')
        expect(await tx.query('select * from library_study_snapshot')).toEqual(
          [],
        )
        expect(await tx.query('select * from library_study_write')).toEqual([])
      })
    } finally {
      await db.exec(
        'drop owned by library_test_reader; drop role library_test_reader;',
      )
    }
  })
  it('applies the new migration twice and refuses invalid direct SQL shapes', async () => {
    const db = await getDb()
    const { readMigrations } = await import('@/lib/db/client')
    await db.exec(
      readMigrations().find((m) => m.name === '0022_library_study.sql')!.sql,
    )
    await expect(
      db.query(
        'insert into library_study_snapshot (user_id, state) values ($1, $2::jsonb)',
        ['alice', '{}'],
      ),
    ).rejects.toMatchObject({ code: '23514' })
    await expect(
      writeLibraryForUser('missing-user', write()),
    ).rejects.toMatchObject({ code: '23503' })
  })
  it('allows empty-table rollback but refuses removal once account records exist', async () => {
    const db = await getDb()
    const sql = readFileSync(
      new URL(
        '../../docs/operations/library-account-empty-rollback.sql',
        import.meta.url,
      ),
      'utf8',
    )
    await db.exec(sql)
    const { readMigrations } = await import('@/lib/db/client')
    await db.exec(
      readMigrations().find((m) => m.name === '0022_library_study.sql')!.sql,
    )
    await writeLibraryForUser('alice', write())
    await expect(db.exec(sql)).rejects.toThrow('Library snapshots exist')
    await db.exec('rollback')
    expect((await loadLibraryForUser('alice')).revision).toBe(1)
    expect(
      (await db.query<{ n: number }>('select count(*)::int n from "user"'))[0]
        .n,
    ).toBe(2)
  })
})
