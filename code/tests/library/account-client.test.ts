import { describe, expect, it, vi } from 'vitest'
import {
  LibraryAccountClient,
  LibraryAccountError,
  libraryAccountKey,
  reconcileLibrary,
  type AccountTransport,
} from '@/lib/library/account-client'
import {
  emptyLibrary,
  LIBRARY_KEY,
  type LibraryState,
} from '@/lib/library/storage'
import { editLibrary } from '@/lib/library/local-edit'

const id = 'topic:normalization'
const meta = {
  title: 'Normal forms',
  href: '/learn/engineer/normalization',
  track: 'engineer' as const,
}
const date = '2026-10-28T00:00:00Z'
const state = (draft: string): LibraryState => ({
  version: 1,
  entries: {
    [id]: {
      ...meta,
      draft,
      checks: [],
      status: 'learning',
      updatedAt: date,
      visitedAt: date,
    },
  },
})
function memory() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
  }
}
function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { resolve, promise }
}
const json = (v: unknown, status = 200) =>
  Promise.resolve(Response.json(v, { status }))
function remote(initial = emptyLibrary()) {
  let revision = 0,
    current = initial
  const receipts = new Map<string, number>(),
    requests: string[] = []
  const fetch: AccountTransport = async (_url, init) => {
    if (!init?.method)
      return Response.json({ ownerId: 'alice', revision, state: current })
    requests.push(init.body as string)
    const p = JSON.parse(init.body as string)
    if (receipts.has(p.requestId))
      return Response.json({
        ownerId: 'alice',
        kind: 'ok',
        acknowledgedRevision: receipts.get(p.requestId),
        replayed: true,
        snapshot: { revision, state: current },
      })
    if (p.baseRevision !== revision)
      return Response.json(
        {
          ownerId: 'alice',
          kind: 'conflict',
          snapshot: { revision, state: current },
        },
        { status: 409 },
      )
    current = p.state
    revision++
    receipts.set(p.requestId, revision)
    return Response.json({
      ownerId: 'alice',
      kind: 'ok',
      acknowledgedRevision: revision,
      replayed: false,
      snapshot: { revision, state: current },
    })
  }
  return {
    fetch,
    requests,
    get: () => ({ revision, state: current }),
    replace: (s: LibraryState) => {
      current = s
      revision++
    },
  }
}
const edit = (c: LibraryAccountClient, text: string) =>
  editLibrary(
    c.scopedStorage(),
    id,
    meta,
    { kind: 'draft', text, expected: c.get().working.entries[id]?.draft ?? '' },
    date,
  )
describe('opt-in library account client', () => {
  it('calls the supplied Web fetch function without binding it to a client object', async () => {
    const server = remote()
    const transport: AccountTransport = function(this: unknown, url, init) {
      expect(this).toBeUndefined()
      return server.fetch(url, init)
    }
    const client = new LibraryAccountClient('alice', memory(), transport, () => 'alice')
    await client.open(); edit(client, 'Native transport'); await client.flush()
    expect(server.get().state.entries[id].draft).toBe('Native transport')
  })
  it('opens account data without uploading or replacing guest records, then restores in a separate session', async () => {
    const store = memory(),
      server = remote()
    store.setItem(LIBRARY_KEY, JSON.stringify(state('Guest original')))
    const original = store.getItem(LIBRARY_KEY)
    const client = new LibraryAccountClient(
      'alice',
      store,
      server.fetch,
      () => 'alice',
    )
    await client.open()
    expect(client.get().working).toEqual(emptyLibrary())
    expect(server.requests).toEqual([])
    client.importGuest()
    expect(server.requests).toEqual([])
    expect(store.getItem(LIBRARY_KEY)).toBe(original)
    edit(client, 'Account answer')
    await client.flush()
    const separate = new LibraryAccountClient(
      'alice',
      memory(),
      server.fetch,
      () => 'alice',
    )
    await separate.open()
    expect(separate.get().working.entries[id].draft).toBe('Account answer')
    expect(separate.get().base.revision).toBe(1)
    expect(store.getItem(LIBRARY_KEY)).toBe(original)
  })
  it('retains a stable write after lost acknowledgement and preserves edits made while it was pending', async () => {
    const store = memory(),
      server = remote()
    let fail = true
    const client = new LibraryAccountClient(
      'alice',
      store,
      async (url, init) => {
        const response = await server.fetch(url, init)
        if (init?.method && fail) {
          fail = false
          throw Error('connection lost after commit')
        }
        return response
      },
      () => 'alice',
    )
    await client.open()
    edit(client, 'First write')
    await expect(client.flush()).rejects.toMatchObject({ code: 'offline' })
    const pending = client.get().pending
    edit(client, 'Later edit')
    await client.flush()
    expect(server.requests[0]).toBe(server.requests[1])
    expect(JSON.parse(server.requests[1]).requestId).toBe(pending!.requestId)
    expect(client.get().working.entries[id].draft).toBe('Later edit')
    expect(client.get().base.state.entries[id].draft).toBe('First write')
    await client.flush()
    expect(server.get().state.entries[id].draft).toBe('Later edit')
    expect(server.get().revision).toBe(2)
  })
  it('keeps a sent request unchanged across dispose/reopen and late server edits become explicit conflicts', async () => {
    const store = memory(),
      server = remote(state('Original'))
    const first = new LibraryAccountClient(
      'alice',
      store,
      async (url, init) => {
        const response = await server.fetch(url, init)
        if (init?.method) throw Error('lost reply')
        return response
      },
      () => 'alice',
    )
    await first.open()
    edit(first, 'Sent draft')
    await expect(first.flush()).rejects.toMatchObject({ code: 'offline' })
    edit(first, 'Unsent edit')
    first.dispose()
    server.replace(state('Remote edit after acknowledgement'))
    const next = new LibraryAccountClient(
      'alice',
      store,
      server.fetch,
      () => 'alice',
    )
    await next.open()
    await next.flush()
    expect(server.requests[0]).toBe(server.requests[1])
    expect(next.get().working.entries[id].draft).toBe('Unsent edit')
    expect(next.get().conflict?.ids).toEqual([id])
    expect(next.get().conflict?.ancestor.entries[id].draft).toBe('Sent draft')
    await expect(next.flush()).rejects.toMatchObject({ code: 'conflict' })
    next.resolve(id, 'local')
    await next.flush()
    expect(server.get().state.entries[id].draft).toBe('Unsent edit')
  })
  it('rejects stale/wrong-owner replies and leaves each owner pending data isolated', async () => {
    const store = memory(),
      server = remote(),
      gate = deferred<Response>()
    let owner: string | null = 'alice'
    const client = new LibraryAccountClient(
      'alice',
      store,
      server.fetch,
      () => owner,
    )
    await client.open()
    edit(client, 'Alice private')
    const delayed = new LibraryAccountClient(
      'alice',
      store,
      (_url, init) => (init?.method ? gate.promise : server.fetch(_url, init)),
      () => owner,
    )
    await delayed.open()
    const sending = delayed.flush()
    const savedRaw = store.getItem(libraryAccountKey('alice'))
    owner = 'bob'
    gate.resolve(
      Response.json({
        ownerId: 'bob',
        kind: 'ok',
        snapshot: { revision: 1, state: state('Bob private') },
        acknowledgedRevision: 1,
        replayed: false,
      }),
    )
    await expect(sending).rejects.toMatchObject({ code: 'owner' })
    expect(store.getItem(libraryAccountKey('alice'))).toBe(savedRaw)
    expect(store.getItem(libraryAccountKey('bob'))).toBeNull()
    expect(() => client.get()).toThrow(LibraryAccountError)
    const wrong = new LibraryAccountClient(
      'bob',
      store,
      () => json({ ownerId: 'alice', ...server.get() }),
      () => 'bob',
    )
    await expect(wrong.open()).rejects.toMatchObject({ code: 'owner' })
    expect(store.getItem(libraryAccountKey('bob'))).toBeNull()
  })
  it('does not adopt a delayed GET after the session changes', async () => {
    const store = memory(),
      gate = deferred<Response>()
    let owner = 'alice'
    const client = new LibraryAccountClient(
      'alice',
      store,
      () => gate.promise,
      () => owner,
    )
    const opening = client.open()
    owner = 'bob'
    gate.resolve(
      Response.json({ ownerId: 'alice', revision: 1, state: state('Private') }),
    )
    await expect(opening).rejects.toMatchObject({ code: 'owner' })
    expect(store.data.size).toBe(0)
  })
  it('merges independent edits but requires explicit choice for competing drafts or deletions', () => {
    const base = state('Base'),
      local = state('Local'),
      server = state('Base')
    server.entries[id].checks = ['Checked']
    expect(reconcileLibrary(base, local, server)).toEqual({
      state: {
        ...local,
        entries: { [id]: { ...local.entries[id], checks: ['Checked'] } },
      },
      conflicts: [],
    })
    server.entries[id].draft = 'Remote'
    expect(reconcileLibrary(base, local, server).conflicts).toEqual([id])
    expect(reconcileLibrary(base, local, emptyLibrary()).conflicts).toEqual([
      id,
    ])
  })
  it('does not silently resolve server conflicts; remote choice is an explicit whole-entry action', async () => {
    const store = memory(),
      server = remote(state('Base'))
    const client = new LibraryAccountClient(
      'alice',
      store,
      server.fetch,
      () => 'alice',
    )
    await client.open()
    edit(client, 'Local')
    server.replace(state('Remote'))
    await client.flush()
    expect(client.get().working.entries[id].draft).toBe('Local')
    expect(server.get().state.entries[id].draft).toBe('Remote')
    expect(client.get().conflict?.ancestor.entries[id].draft).toBe('Base')
    client.resolve(id, 'remote')
    expect(client.get().working.entries[id].draft).toBe('Remote')
    expect(client.get().conflict).toBeUndefined()
    const count = server.requests.length
    await client.flush()
    expect(server.requests.length).toBe(count)
  })
  it('preserves malformed bytes, refuses unsafe import, and does not send before durable pending storage succeeds', async () => {
    const store = memory(),
      server = remote(state('Account'))
    store.setItem(libraryAccountKey('alice'), '{bad')
    const fetch = vi.fn(server.fetch),
      client = new LibraryAccountClient('alice', store, fetch, () => 'alice')
    await expect(client.open()).rejects.toMatchObject({ code: 'format' })
    expect(fetch).not.toHaveBeenCalled()
    expect(store.getItem(libraryAccountKey('alice'))).toBe('{bad')
    store.data.delete(libraryAccountKey('alice'))
    await client.open()
    store.setItem(LIBRARY_KEY, JSON.stringify(state('Guest')))
    const before = store.getItem(libraryAccountKey('alice'))
    expect(() => client.importGuest()).toThrow(LibraryAccountError)
    expect(store.getItem(libraryAccountKey('alice'))).toBe(before)
    edit(client, 'Changed')
    vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw Error('quota')
    })
    await expect(client.flush()).rejects.toMatchObject({ code: 'storage' })
    expect(server.requests).toEqual([])
    expect(client.get().working.entries[id].draft).toBe('Changed')
  })
  it('keeps pending records on authentication, unavailable, malformed and request-ID errors', async () => {
    for (const response of [
      () => Response.json({}, { status: 401 }),
      () => Response.json({}, { status: 503 }),
      () =>
        Response.json(
          { ownerId: 'alice', kind: 'request_id_reused' },
          { status: 409 },
        ),
      () => Response.json({ ownerId: 'alice', unexpected: true }),
    ]) {
      const store = memory(),
        server = remote(),
        client = new LibraryAccountClient(
          'alice',
          store,
          (url, init) =>
            init?.method
              ? Promise.resolve(response())
              : server.fetch(url, init),
          () => 'alice',
        )
      await client.open()
      edit(client, 'Preserved')
      await expect(client.flush()).rejects.toBeInstanceOf(LibraryAccountError)
      expect(client.get().pending?.state.entries[id].draft).toBe('Preserved')
      expect(client.get().working.entries[id].draft).toBe('Preserved')
    }
  })
  it('bounds a stalled fetch and leaves its durable pending request available for retry', async () => {
    vi.useFakeTimers()
    try {
      const store = memory(),
        server = remote()
      const client = new LibraryAccountClient(
        'alice',
        store,
        (url, init) =>
          !init?.method
            ? server.fetch(url, init)
            : new Promise((_resolve, reject) =>
                init.signal!.addEventListener('abort', () =>
                  reject(Error('aborted')),
                ),
              ),
        () => 'alice',
      )
      await client.open()
      edit(client, 'Pending timeout')
      const result = expect(client.flush()).rejects.toMatchObject({
        code: 'offline',
      })
      await vi.advanceTimersByTimeAsync(15000)
      await result
      expect(client.get().pending).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })
})
