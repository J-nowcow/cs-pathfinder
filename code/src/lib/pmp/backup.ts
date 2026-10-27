import { isPmpLesson, pmpQuestions } from './questions'
import { PMP_KEY, type PmpData } from './storage'
type Bag = Record<string, unknown>
const bag = (v: unknown): v is Bag =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const own = (v: Bag, key: string) => Object.hasOwn(v, key)
const stamp = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 80 && Number.isFinite(Date.parse(v))
export const PMP_BACKUP_BYTES = 8_000_000
const fields = [
  'version',
  'seen',
  'journey',
  'answers',
  'notes',
  'thoughts',
  'bookmarks',
  'review',
  'recall',
  'prefs',
  'exportedAt',
]
const fail = () => {
  throw Error(
    'PMP 백업에 지원하지 않는 항목이나 값이 있어 가져오지 않았어요. 원본 파일과 현재 기록은 그대로예요.',
  )
}
function keys(v: Bag, allowed: string[]) {
  if (Object.keys(v).some((k) => !allowed.includes(k))) fail()
}
/** Strict import only. Export separately preserves the exact browser bytes, even if malformed. */
export function parsePmpBackup(raw: string | null): PmpData {
  if (raw === null) return { version: 1 }
  if (new TextEncoder().encode(raw).length > PMP_BACKUP_BYTES)
    throw Error('8MB 이하의 PMP 백업 파일을 골라 주세요.')
  let v: unknown
  try {
    v = JSON.parse(raw)
  } catch {
    return fail()
  }
  if (!bag(v) || v.version !== 1) return fail()
  keys(v, fields)
  for (const field of [
    'seen',
    'answers',
    'notes',
    'thoughts',
    'review',
    'recall',
    'prefs',
  ]) {
    if (!own(v, field)) continue
    if (!bag(v[field])) return fail()
    for (const [id, x] of Object.entries(v[field])) {
      if (field === 'prefs') {
        if (
          id === 'font' &&
          typeof x === 'string' &&
          ['suit', 'suite', 'batang', 'system'].includes(String(x))
        )
          continue
        if (
          id === 'theme' &&
          typeof x === 'string' &&
          ['dark', 'light'].includes(String(x))
        )
          continue
        if (
          id === 'size' &&
          typeof x === 'number' &&
          Number.isFinite(x) &&
          x >= 16 &&
          x <= 24
        )
          continue
        return fail()
      }
      if (field === 'answers') {
        const q = pmpQuestions.get(id)
        if (!q || !bag(x)) return fail()
        keys(x, ['index', 'correct', 'at'])
        if (
          !Number.isInteger(x.index) ||
          !q.options[x.index as number] ||
          x.correct !== q.options[x.index as number].correct ||
          !stamp(x.at)
        )
          return fail()
        continue
      }
      if (!isPmpLesson(id)) return fail()
      if (field === 'notes' || field === 'thoughts') {
        if (typeof x !== 'string' || x.length > 12000) return fail()
      } else if (field === 'seen') {
        if (!stamp(x)) return fail()
      } else if (field === 'recall') {
        if (typeof x !== 'string' || !['again', 'hard', 'good'].includes(x))
          return fail()
      } else if (field === 'review') {
        if (!bag(x)) return fail()
        keys(x, ['due', 'interval', 'rating'])
        if (
          !stamp(x.due) ||
          typeof x.interval !== 'number' ||
          !Number.isFinite(x.interval) ||
          x.interval < 0 ||
          x.interval > 365 ||
          typeof x.rating !== 'string' ||
          x.rating.length > 40
        )
          return fail()
      }
    }
  }
  if (own(v, 'exportedAt') && !stamp(v.exportedAt)) return fail()
  if (
    own(v, 'bookmarks') &&
    (!Array.isArray(v.bookmarks) ||
      v.bookmarks.length >
        [...pmpQuestions.keys()].filter(isPmpLesson).length ||
      !v.bookmarks.every((x) => typeof x === 'string' && isPmpLesson(x)))
  )
    return fail()
  if (own(v, 'journey')) {
    if (!Array.isArray(v.journey) || v.journey.length > 5000) return fail()
    for (const j of v.journey) {
      if (!bag(j)) return fail()
      keys(j, ['id', 'from', 'at'])
      if (
        typeof j.id !== 'string' ||
        !isPmpLesson(j.id) ||
        !stamp(j.at) ||
        (j.from !== null &&
          (typeof j.from !== 'string' || !isPmpLesson(j.from)))
      )
        return fail()
    }
  }
  return v as PmpData
}
const stable = (v: unknown): string =>
  bag(v)
    ? JSON.stringify(
        Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        ),
      )
    : JSON.stringify(v)
const same = (a: unknown, b: unknown) => stable(a) === stable(b)
export type PmpBackupConflict = {
  key: string
  field: string
  id: string
  current: unknown
  incoming: unknown
}
export type PmpBackupChoices = Record<string, 'current' | 'incoming'>
export function planPmpBackup(
  currentRaw: string | null,
  incomingRaw: string,
  choices: PmpBackupChoices = {},
) {
  const current = parsePmpBackup(currentRaw),
    incoming = parsePmpBackup(incomingRaw)
  const state: PmpData = { ...current },
    conflicts: PmpBackupConflict[] = []
  function select(field: string, id: string, old: unknown, value: unknown) {
    if (old === undefined || same(old, value)) return value
    const key = field + '/' + id
    conflicts.push({ key, field, id, current: old, incoming: value })
    return choices[key] === 'incoming' ? value : old
  }
  for (const field of [
    'seen',
    'answers',
    'notes',
    'thoughts',
    'review',
    'recall',
    'prefs',
  ]) {
    if (!own(incoming, field)) continue
    const before = (current[field] as Bag | undefined) ?? {},
      next: Bag = { ...before }
    for (const [id, value] of Object.entries(incoming[field] as Bag)) {
      const old = before[id]
      if (field === 'seen')
        next[id] =
          old === undefined ||
          Date.parse(value as string) > Date.parse(old as string)
            ? value
            : old
      else if ((field === 'notes' || field === 'thoughts') && old === '')
        next[id] = value
      else if (
        field === 'answers' &&
        bag(old) &&
        bag(value) &&
        old.index === value.index
      )
        next[id] =
          Date.parse(value.at as string) > Date.parse(old.at as string)
            ? value
            : old
      else next[id] = select(field, id, old, value)
    }
    state[field] = next
  }
  if (own(incoming, 'bookmarks'))
    state.bookmarks = [
      ...new Set([
        ...((current.bookmarks as string[]) ?? []),
        ...(incoming.bookmarks as string[]),
      ]),
    ]
  if (own(incoming, 'journey')) {
    const before = (current.journey as Bag[]) ?? [],
      added = incoming.journey as Bag[]
    const joined = [
      ...new Map(
        [...before, ...added].map((x) => [
          JSON.stringify([x.id, x.from, x.at]),
          x,
        ]),
      ).values(),
    ].sort((a, b) => Date.parse(a.at as string) - Date.parse(b.at as string))
    state.journey =
      joined.length <= 5000 ? joined : select('journey', 'all', before, added)
  }
  const unresolved = conflicts.filter(
    (x) => !['current', 'incoming'].includes(choices[x.key]),
  )
  if (Object.keys(choices).some((k) => !conflicts.some((x) => x.key === k)))
    throw Error('비교할 기록이 바뀌었어요. 파일을 다시 확인해 주세요.')
  return { state, conflicts, unresolved }
}
export class PmpBackupChanged extends Error {}
export function applyPmpBackup(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  expectedRaw: string | null,
  incomingRaw: string,
  choices: PmpBackupChoices = {},
) {
  const plan = planPmpBackup(expectedRaw, incomingRaw, choices)
  if (plan.unresolved.length)
    throw Error('서로 다른 기록을 먼저 비교하고 선택해 주세요.')
  // Best-effort comparison; localStorage has no atomic multi-tab compare-and-set.
  if (storage.getItem(PMP_KEY) !== expectedRaw)
    throw new PmpBackupChanged(
      '비교하는 동안 PMP 기록이 바뀌었어요. 최신 기록으로 다시 비교해 주세요.',
    )
  const serialized = JSON.stringify(plan.state)
  storage.setItem(PMP_KEY, serialized)
  return plan.state
}
