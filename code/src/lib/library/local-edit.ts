import { libraryAccountStateSchema } from './account-schema'
import {
  emptyLibrary,
  mergeLibrary,
  LIBRARY_KEY,
  type LibraryState,
  type StudyEntry,
} from './storage'
import { kstToday } from '@/lib/daily/date'
import { shiftDay } from '@/lib/streak/storage'
export class LibraryEditError extends Error {
  constructor(public code: 'read' | 'format' | 'conflict' | 'write' | 'limit') {
    super(code)
  }
}
type Store = Pick<Storage, 'getItem' | 'setItem'>
function readSnapshot(storage: Pick<Storage, 'getItem'>) {
  let raw: string | null
  try {
    raw = storage.getItem(LIBRARY_KEY)
  } catch {
    throw new LibraryEditError('read')
  }
  if (raw === null) return { raw, state: emptyLibrary() }
  try {
    return { raw, state: libraryAccountStateSchema.parse(JSON.parse(raw)) }
  } catch {
    throw new LibraryEditError('format')
  }
}
export function readLibraryStrict(
  storage: Pick<Storage, 'getItem'>,
): LibraryState {
  return readSnapshot(storage).state
}
function commit(
  storage: Store,
  raw: string | null,
  next: LibraryState,
): LibraryState {
  if (!libraryAccountStateSchema.safeParse(next).success)
    throw new LibraryEditError('format')
  // Best-effort local detection, not an atomic cross-tab compare-and-swap.
  let latest: string | null
  try {
    latest = storage.getItem(LIBRARY_KEY)
  } catch {
    throw new LibraryEditError('read')
  }
  if (latest !== raw) throw new LibraryEditError('conflict')
  try {
    storage.setItem(LIBRARY_KEY, JSON.stringify(next))
  } catch {
    throw new LibraryEditError('write')
  }
  return next
}
export function restoreLibraryStrict(
  storage: Store,
  incoming: LibraryState,
): LibraryState {
  const clean = libraryAccountStateSchema.parse(incoming)
  const { raw, state } = readSnapshot(storage)
  const next = mergeLibrary(state, clean)
  if (!next) throw new LibraryEditError('conflict')
  return commit(storage, raw, next)
}
export type LibraryEdit =
  | { kind: 'visit' }
  | { kind: 'draft'; text: string; expected: string }
  | { kind: 'check'; value: string; checked: boolean }
  | { kind: 'review'; status: StudyEntry['status'] }

export function editLibrary(
  storage: Store,
  id: string,
  meta: Pick<StudyEntry, 'title' | 'href' | 'track'>,
  action: LibraryEdit,
  now: string,
): LibraryState {
  const { raw, state } = readSnapshot(storage)
  const previous = state.entries[id]
  if (!previous && Object.keys(state.entries).length >= 200)
    throw new LibraryEditError('limit')
  if (action.kind === 'draft' && (previous?.draft ?? '') !== action.expected)
    throw new LibraryEditError('conflict')
  const entry: StudyEntry = previous
    ? { ...previous, ...meta }
    : {
        ...meta,
        draft: '',
        checks: [],
        status: 'learning',
        visitedAt: now,
        updatedAt: now,
      }
  switch (action.kind) {
    case 'visit':
      entry.visitedAt = now
      break
    case 'draft':
      entry.draft = action.text
      entry.updatedAt = now
      break
    case 'check':
      entry.checks = action.checked
        ? [...new Set([...entry.checks, action.value])]
        : entry.checks.filter((v) => v !== action.value)
      entry.updatedAt = now
      break
    case 'review':
      entry.status = action.status
      entry.updatedAt = now
      if (action.status === 'learning') delete entry.due
      else
        entry.due = shiftDay(
          kstToday(new Date(now)),
          action.status === 'review' ? 1 : 3,
        )
  }
  const next = {
    version: 1 as const,
    entries: { ...state.entries, [id]: entry },
  }
  return commit(storage, raw, next)
}
