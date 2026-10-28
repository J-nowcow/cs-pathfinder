// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { syncForUser, startSyncForUser, __resetSyncForTests, SYNC_MARKER_KEY, JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT } from '@/lib/journey/sync'
import { JOURNEY_STORAGE_KEY, loadJourney, saveJourney } from '@/lib/journey/storage'
import { STREAK_STORAGE_KEY } from '@/lib/streak/storage'

const response = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'content-type': 'application/json' },
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
const wire = (owner: string) => ({
  occurrences: [{ id: owner, node_id: `node-${owner}`, parent_id: null, question: owner, category: 'synthetic' }],
  current_id: owner,
})
beforeEach(() => {
  __resetSyncForTests()
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  __resetSyncForTests()
  vi.restoreAllMocks()
})

it('starts a new owner run and ignores the old owner response even when transport ignores cancellation', async () => {
  const lateA = deferred<Response>()
  let journeys = 0
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).includes('/api/journey')) return ++journeys === 1 ? lateA.promise : response(wire('B'))
    return response({ days: {} })
  })
  const events = vi.spyOn(window, 'dispatchEvent')
  const first = syncForUser('A')
  const second = syncForUser('B')
  lateA.resolve(response(wire('A')))
  const results = await Promise.all([first, second])
  expect(results).toEqual([false, true])
  expect(first).not.toBe(second)
  expect(loadJourney()?.occurrences.map((o) => o.id)).toEqual(['B'])
  expect(sessionStorage.getItem(SYNC_MARKER_KEY)).toBe('B')
  expect(events.mock.calls.filter(([event]) => event.type === JOURNEY_SYNCED_EVENT)).toHaveLength(1)
  expect(fetcher).toHaveBeenCalledTimes(3)
})

it('preserves a journey edited while the server response is pending', async () => {
  const late = deferred<Response>()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? late.promise : response({ days: {} }))
  const pending = syncForUser('A')
  saveJourney({ occurrences: [{ id: 'new-local', nodeId: 'node-local', parentId: null, question: 'local', category: 'synthetic' }], currentId: 'new-local' })
  late.resolve(response(wire('server')))
  expect(await pending).toBe(true)
  expect(loadJourney()?.occurrences.map((o) => o.id)).toEqual(['server', 'new-local'])
  expect(loadJourney()?.currentId).toBe('new-local')
})

it('preserves streak reads recorded while the streak response is pending', async () => {
  const late = deferred<Response>()
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? response(wire('server')) : late.promise)
  const pending = syncForUser('A')
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify({ version: 1, days: { '2026-10-28': ['new-local'] } }))
  late.resolve(response({ days: { '2026-10-28': ['remote'] } }))
  expect(await pending).toBe(true)
  expect(JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY)!).days['2026-10-28']).toEqual(['remote', 'new-local'])
  expect(localStorage.getItem(JOURNEY_STORAGE_KEY)).not.toBeNull()
})

it('coalesces overlapping calls for the same owner without duplicate requests', async () => {
  const late = deferred<Response>()
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? late.promise : response({ days: {} }))
  const a = syncForUser('A'), b = syncForUser('A')
  expect(a).toBe(b)
  late.resolve(response(wire('A')))
  expect(await a).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('checks the run again after delayed JSON decoding on logout/unmount', async () => {
  const decoded = deferred<ReturnType<typeof wire>>()
  const res = response(null)
  vi.spyOn(res, 'json').mockReturnValue(decoded.promise)
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(res)
  const events = vi.spyOn(window, 'dispatchEvent')
  const job = startSyncForUser('A')
  await vi.waitFor(() => expect(res.json).toHaveBeenCalledOnce())
  job.cancel()
  decoded.resolve(wire('A'))
  expect(await job.done).toBe(false)
  expect(fetcher).toHaveBeenCalledOnce()
  expect(loadJourney()).toBeNull()
  expect(localStorage.getItem(STREAK_STORAGE_KEY)).toBeNull()
  expect(sessionStorage.getItem(SYNC_MARKER_KEY)).toBeNull()
  expect(events.mock.calls.filter(([event]) => [JOURNEY_SYNCED_EVENT, STREAK_SYNCED_EVENT].includes(event.type))).toHaveLength(0)
  expect((fetcher.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true)
})

it('cannot publish a delayed streak or marker after cancellation; completed journey remains', async () => {
  const late = deferred<Response>()
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? response(wire('A')) : late.promise)
  const events = vi.spyOn(window, 'dispatchEvent')
  const job = startSyncForUser('A')
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  const before = localStorage.getItem(JOURNEY_STORAGE_KEY)
  job.cancel()
  late.resolve(response({ days: { '2026-10-28': ['late-A'] } }))
  expect(await job.done).toBe(false)
  expect(localStorage.getItem(JOURNEY_STORAGE_KEY)).toBe(before)
  expect(localStorage.getItem(STREAK_STORAGE_KEY)).toBeNull()
  expect(sessionStorage.getItem(SYNC_MARKER_KEY)).toBeNull()
  expect(events.mock.calls.filter(([event]) => event.type === STREAK_SYNCED_EVENT)).toHaveLength(0)
})

it('an old disposer and finally cannot cancel or clear the new owner run', async () => {
  const a = deferred<Response>(), b = deferred<Response>()
  let count = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? (++count === 1 ? a.promise : b.promise) : response({ days: {} }))
  const old = startSyncForUser('A'), current = startSyncForUser('B')
  old.cancel()
  a.resolve(response(wire('A')))
  expect(await old.done).toBe(false)
  expect(syncForUser('B')).toBe(current.done)
  b.resolve(response(wire('B')))
  expect(await current.done).toBe(true)
  expect(loadJourney()?.occurrences.map((o) => o.id)).toEqual(['B'])
  expect(sessionStorage.getItem(SYNC_MARKER_KEY)).toBe('B')
})

it('distinguishes A to B to A generations even though the owner string repeats', async () => {
  const waits = [deferred<Response>(), deferred<Response>(), deferred<Response>()]
  let count = 0
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/api/journey') ? waits[count++].promise : response({ days: {} }))
  const oldA = startSyncForUser('A'), oldB = startSyncForUser('B'), newA = startSyncForUser('A')
  oldA.cancel()
  waits[0].resolve(response(wire('old-A')))
  waits[1].resolve(response(wire('old-B')))
  expect(await oldA.done).toBe(false)
  expect(await oldB.done).toBe(false)
  expect(syncForUser('A')).toBe(newA.done)
  waits[2].resolve(response(wire('new-A')))
  expect(await newA.done).toBe(true)
  expect(loadJourney()?.occurrences.map((o) => o.id)).toEqual(['new-A'])
})

it('retries after transport failure without changing unrelated legacy records', async () => {
  const keys = ['pathfinder.library.v1', 'pmp-pathfinder-v1', 'pathfinder.certificate.v1', 'jira-garden-v1']
  for (const key of keys) localStorage.setItem(key, 'synthetic-preserve')
  const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'))
    .mockImplementation(async (url) => String(url).includes('/api/journey') ? response(wire('A')) : response({ days: {} }))
  expect(await syncForUser('A')).toBe(false)
  expect(sessionStorage.getItem(SYNC_MARKER_KEY)).toBeNull()
  expect(await syncForUser('A')).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(3)
  for (const key of keys) expect(localStorage.getItem(key)).toBe('synthetic-preserve')
})
