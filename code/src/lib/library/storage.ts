import { kstToday } from '@/lib/daily/date'
import { shiftDay } from '@/lib/streak/storage'
export const LIBRARY_KEY = 'pathfinder.library.v1'
export const LIBRARY_EVENT = 'pathfinder-library-updated'
export type StudyEntry = {
  title: string
  href: string
  track: 'engineer' | 'jira'
  visitedAt: string
  updatedAt: string
  draft: string
  checks: string[]
  status: 'learning' | 'review' | 'comfortable'
  due?: string
}
export type LibraryState = { version: 1; entries: Record<string, StudyEntry> }
export const emptyLibrary = (): LibraryState => ({ version: 1, entries: {} })
const stamp = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v))
const day = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + 'T00:00:00Z')) &&
  new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
export function parseLibrary(raw: string | null): LibraryState {
  if (!raw) return emptyLibrary()
  try {
    const p = JSON.parse(raw)
    if (
      !p ||
      p.version !== 1 ||
      !p.entries ||
      typeof p.entries !== 'object' ||
      Array.isArray(p.entries)
    )
      throw Error('format')
    const entries: Record<string, StudyEntry> = {}
    for (const [id, value] of Object.entries(p.entries).slice(0, 200)) {
      const v = value as Partial<StudyEntry>
      if (
        !/^(topic|mission|exam):[a-z0-9-]{1,80}$/.test(id) ||
        !v ||
        !['engineer', 'jira'].includes(String(v.track)) ||
        typeof v.title !== 'string' ||
        v.title.length > 180 ||
        typeof v.href !== 'string' ||
        !/^\/learn\/(?:engineer|jira)(?:[\/#?][a-zA-Z0-9_/?=#%-]*)?$/.test(
          v.href,
        ) ||
        !stamp(v.visitedAt) ||
        !stamp(v.updatedAt) ||
        typeof v.draft !== 'string' ||
        v.draft.length > 6000 ||
        !Array.isArray(v.checks) ||
        v.checks.length > 30 ||
        !v.checks.every((x) => typeof x === 'string' && x.length <= 180) ||
        !['learning', 'review', 'comfortable'].includes(String(v.status)) ||
        (v.due !== undefined && !day(v.due))
      )
        continue
      entries[id] = {
        title: v.title,
        href: v.href,
        track: v.track!,
        visitedAt: v.visitedAt,
        updatedAt: v.updatedAt,
        draft: v.draft,
        checks: [...new Set(v.checks)],
        status: v.status!,
        ...(v.due ? { due: v.due } : {}),
      }
    }
    return { version: 1, entries }
  } catch {
    return emptyLibrary()
  }
}
export function loadLibrary(): LibraryState {
  try {
    return parseLibrary(localStorage.getItem(LIBRARY_KEY))
  } catch {
    return emptyLibrary()
  }
}
export function saveLibrary(state: LibraryState): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(state))
    window.dispatchEvent(new Event(LIBRARY_EVENT))
    return true
  } catch {
    return false
  }
}
export function updateStudy(
  state: LibraryState,
  id: string,
  meta: Pick<StudyEntry, 'title' | 'href' | 'track'>,
  change: Partial<Pick<StudyEntry, 'draft' | 'checks' | 'status'>>,
  now: string,
): LibraryState | null {
  if (!stamp(now)) return null
  if (!state.entries[id] && Object.keys(state.entries).length >= 200)
    return null
  const previous = state.entries[id]
  const entry: StudyEntry = previous
    ? { ...previous, ...meta, ...change, updatedAt: now }
    : {
        ...meta,
        visitedAt: now,
        updatedAt: now,
        draft: '',
        checks: [],
        status: 'learning',
        ...change,
      }
  if (change.status) {
    if (change.status === 'learning') delete entry.due
    else
      entry.due = shiftDay(
        kstToday(new Date(now)),
        change.status === 'review' ? 1 : 3,
      )
  }
  const next = {
    version: 1 as const,
    entries: { ...state.entries, [id]: entry },
  }
  const clean = parseLibrary(JSON.stringify(next))
  return clean.entries[id] ? clean : null
}
export function mergeLibrary(
  current: LibraryState,
  incoming: LibraryState,
): LibraryState | null {
  const entries = { ...current.entries }
  for (const [id, entry] of Object.entries(incoming.entries))
    if (!entries[id] || entry.updatedAt > entries[id].updatedAt)
      entries[id] = entry
  return Object.keys(entries).length <= 200 ? { version: 1, entries } : null
}
