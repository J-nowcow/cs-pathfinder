import { describe, expect, it, vi } from 'vitest'
import { WORKSPACE_KEY, MAX_SESSIONS, MAX_WORKSPACE_BYTES } from '@/lib/study-poc/contract'
import { createSession, emptyWorkspace, submitAttempt, updateSession } from '@/lib/study-poc/model'
import { commitWorkspace, exportWorkspace, mergeWorkspaceImport, parseWorkspaceImport, readWorkspace, type LockManagerLike } from '@/lib/study-poc/storage'

const NOW = '2026-11-12T04:00:00.000Z'
function workspace(id = 'session-a') {
  return { ...emptyWorkspace(), currentSessionId: id, sessionsById: { [id]: createSession('Pool and waiting', id, NOW) } }
}
function storage(initial: string | null = null) {
  let raw = initial
  return { getItem: vi.fn((key: string) => key === WORKSPACE_KEY ? raw : null), setItem: vi.fn((key: string, value: string) => { if (key !== WORKSPACE_KEY) throw Error('other namespace'); raw = value }), raw: () => raw }
}
function serializedLocks(): LockManagerLike {
  let tail = Promise.resolve<unknown>(undefined)
  return { request: <T>(_name: string, callback: () => T | Promise<T>) => {
    const task = tail.then(callback)
    tail = task.catch(() => undefined)
    return task
  } }
}
describe('isolated PoC workspace preservation', () => {
  it('round-trips multiple sessions, activity composition and drafts without touching old application keys', async () => {
    const store = storage()
    const a = updateSession(workspace().sessionsById['session-a'], { activity: 'check', answer: { activity: 'check', text: 'private synthetic text' } }, NOW)
    const next = { ...workspace(), revision: 1, sessionsById: { 'session-a': a, 'session-b': createSession('Another goal', 'session-b', NOW) } }
    expect((await commitWorkspace(store, serializedLocks(), null, next)).ok).toBe(true)
    expect(readWorkspace(store).state).toEqual(next)
    expect(store.getItem.mock.calls.every(([key]) => key === WORKSPACE_KEY)).toBe(true)
    expect(store.setItem.mock.calls.every(([key]) => key === WORKSPACE_KEY)).toBe(true)
  })
  it('refuses malformed, future-version or unsupported-pack raw values without rewriting bytes', async () => {
    for (const raw of ['{broken', JSON.stringify({ ...emptyWorkspace(), version: 8 }), JSON.stringify({ ...workspace(), sessionsById: { 'session-a': { ...workspace().sessionsById['session-a'], packVersion: 'future' } } })]) {
      const store = storage(raw)
      expect(readWorkspace(store)).toMatchObject({ status: 'readonly', raw, state: null })
      expect(await commitWorkspace(store, serializedLocks(), raw, { ...workspace(), revision: 1 })).toMatchObject({ ok: false, code: 'readonly' })
      expect(store.raw()).toBe(raw)
      expect(store.setItem).not.toHaveBeenCalled()
    }
  })
  it('never persists without Web Locks and lets exactly one racing stale writer commit', async () => {
    const store = storage()
    const next = { ...workspace(), revision: 1 }
    expect(await commitWorkspace(store, null, null, next)).toMatchObject({ ok: false, code: 'unsupported' })
    expect(store.setItem).not.toHaveBeenCalled()
    const locks = serializedLocks()
    const results = await Promise.all([commitWorkspace(store, locks, null, next), commitWorkspace(store, locks, null, { ...next, currentSessionId: null })])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.find((result) => !result.ok)).toMatchObject({ code: 'conflict' })
    expect(store.setItem).toHaveBeenCalledTimes(1)
  })
  it('preserves old bytes on a failed write and rejects wrong revision before any write', async () => {
    const raw = JSON.stringify(workspace())
    const store = storage(raw)
    expect(await commitWorkspace(store, serializedLocks(), raw, { ...workspace(), revision: 9 })).toMatchObject({ code: 'conflict' })
    store.setItem.mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
    expect(await commitWorkspace(store, serializedLocks(), raw, { ...workspace(), revision: 1 })).toMatchObject({ code: 'write' })
    expect(store.raw()).toBe(raw)
  })
  it('defaults to excluding draft and submitted bodies while declaring the exact namespace scope', () => {
    let session = updateSession(workspace().sessionsById['session-a'], { answer: { activity: 'check', text: 'PRIVATE_DRAFT_MARKER' } }, NOW)
    session = submitAttempt(session, 'check', 'attempt-a', NOW)
    const state = { ...workspace(), sessionsById: { 'session-a': session } }
    const exported = exportWorkspace(state)
    expect(exported).not.toContain('PRIVATE_DRAFT_MARKER')
    expect(JSON.parse(exported).manifest).toEqual({ namespace: WORKSPACE_KEY, includeAnswers: false, excludedExistingKeys: true })
    const restored = parseWorkspaceImport(exported)
    expect(restored.sessionsById['session-a'].answers).toEqual({})
    expect(restored.sessionsById['session-a'].attempts[0].text).toBeUndefined()
    expect(JSON.stringify(restored)).not.toMatch(/score|mastered|passed/)
    expect(parseWorkspaceImport(exportWorkspace(state, true))).toEqual(state)
    const lying = JSON.parse(exportWorkspace(state, true)); lying.manifest.includeAnswers = false
    expect(() => parseWorkspaceImport(JSON.stringify(lying))).toThrow('backup_scope_mismatch')
    expect(() => mergeWorkspaceImport(state, restored)).toThrow('import_session_conflict')
  })
  it('merges new sessions only, preserves existing answers, and refuses overflow without silent pruning', () => {
    const first = workspace()
    const second = workspace('session-b')
    expect(Object.keys(mergeWorkspaceImport(first, second).sessionsById)).toEqual(['session-a', 'session-b'])
    const full = { ...first, sessionsById: Object.fromEntries(Array.from({ length: MAX_SESSIONS }, (_, i) => [`s${i}`, createSession('Goal', `s${i}`, NOW)])), currentSessionId: 's0' }
    expect(() => mergeWorkspaceImport(full, second)).toThrow('invalid_workspace')
    expect(Object.keys(full.sessionsById)).toHaveLength(MAX_SESSIONS)
  })
  it('preserves oversized bytes read-only and keeps near-limit exports self-importable', () => {
    const raw = ' '.repeat(MAX_WORKSPACE_BYTES + 1)
    const store = storage(raw)
    expect(readWorkspace(store)).toMatchObject({ status: 'readonly', raw })
    expect(store.setItem).not.toHaveBeenCalled()
    const state = workspace()
    for (let i = 0; i < 19; i += 1) {
      let session = createSession('Goal', `s${i}`, NOW)
      for (let j = 0; j < 90; j += 1) {
        session = updateSession(session, { answer: { activity: 'check', text: 'x'.repeat(400) } }, NOW)
        session = submitAttempt(session, 'check', `a${j}`, NOW)
      }
      state.sessionsById[session.id] = session
    }
    expect(parseWorkspaceImport(exportWorkspace(state, true))).toEqual(state)
  })
  it('rejects reserved object-key identities and unavailable storage without touching any existing bytes', () => {
    const value = JSON.parse(exportWorkspace(workspace(), true))
    const entry = value.workspace.sessionsById['session-a']
    for (const id of ['__proto__', 'constructor', 'prototype']) {
      value.workspace.currentSessionId = id
      value.workspace.sessionsById = JSON.parse(JSON.stringify({ [id]: { ...entry, id } }))
      expect(() => parseWorkspaceImport(JSON.stringify(value))).toThrow()
    }
    expect(readWorkspace({ getItem: () => { throw Error('blocked') } })).toMatchObject({ status: 'unavailable', state: null })
  })
  it('accepts a full self-export after edits, attempt history, two sessions and reload despite object key order', async () => {
    let first = createSession('Pool and waiting', 'session-a', NOW)
    first = updateSession(first, { activity: 'compare', answer: { activity: 'explain', text: 'Retain this explanation.' } }, NOW)
    first = updateSession(first, { activity: 'check', answer: { activity: 'check', text: 'first transfer prediction' }, experiment: { pool: 4, requests: 18, dbCapacity: 2 } }, NOW)
    first = submitAttempt(first, 'check', 'attempt-a', NOW)
    first = updateSession(first, { answer: { activity: 'check', text: 'revised transfer prediction' } }, NOW)
    first = submitAttempt(first, 'check', 'attempt-b', NOW)
    const original = { ...workspace(), revision: 1, sessionsById: { 'session-a': first, 'session-b': createSession('Second goal', 'session-b', NOW) } }
    const store = storage(JSON.stringify(original))
    const hydrated = readWorkspace(store).state!
    const imported = parseWorkspaceImport(exportWorkspace(hydrated, true))
    expect(JSON.stringify(hydrated.sessionsById['session-a'].attempts)).not.toBe(JSON.stringify(imported.sessionsById['session-a'].attempts))
    const merged = mergeWorkspaceImport(hydrated, imported)
    expect(merged.sessionsById).toEqual(hydrated.sessionsById)
    expect(merged.revision).toBe(2)
    expect((await commitWorkspace(store, serializedLocks(), store.raw(), merged)).ok).toBe(true)
    expect(readWorkspace(store).state?.sessionsById['session-a'].attempts.map((item) => item.text)).toEqual(['first transfer prediction', 'revised transfer prediction'])
    const changed = structuredClone(imported)
    changed.sessionsById['session-a'].answers.check!.text = 'a real conflict'
    expect(() => mergeWorkspaceImport(hydrated, changed)).toThrow('import_session_conflict')
    const reordered = structuredClone(imported)
    reordered.sessionsById['session-a'].attempts.reverse()
    expect(() => mergeWorkspaceImport(hydrated, reordered)).toThrow('import_session_conflict')
  })
})
