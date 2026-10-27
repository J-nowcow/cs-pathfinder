import { certificateLessons } from './course'
import { kstToday } from '@/lib/daily/date'
import { shiftDay } from '@/lib/streak/storage'
export const CERTIFICATE_KEY = 'pathfinder.certificate.v1'
export const CERTIFICATE_EVENT = 'pathfinder-certificate-updated'
export type CertificateEntry = {
  draft: string
  checks: string[]
  visitedAt: string
  updatedAt: string
  due?: string
}
export type CertificateState = {
  version: 1
  entries: Record<string, CertificateEntry>
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x)
const stamp = (x: unknown): x is string =>
  typeof x === 'string' &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString() === x
const day = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x)) &&
  new Date(x).toISOString().slice(0, 10) === x
export function readCertificate(raw: string | null): CertificateState {
  if (raw === null) return { version: 1, entries: {} }
  const x: unknown = JSON.parse(raw)
  if (
    !object(x) ||
    x.version !== 1 ||
    !object(x.entries) ||
    Object.keys(x.entries).length > certificateLessons.size
  )
    throw Error('정처기 기록 형식을 확인할 수 없어 덮어쓰지 않았어요.')
  for (const [id, v] of Object.entries(x.entries)) {
    const lesson = certificateLessons.get(id)
    if (
      !lesson ||
      !object(v) ||
      typeof v.draft !== 'string' ||
      v.draft.length > 6000 ||
      !stamp(v.visitedAt) ||
      !stamp(v.updatedAt) ||
      !Array.isArray(v.checks) ||
      v.checks.length > lesson.checklist.length ||
      !v.checks.every(
        (c) => typeof c === 'string' && lesson.checklist.includes(c),
      ) ||
      (v.due !== undefined && !day(v.due))
    )
      throw Error('정처기 기록에 알 수 없는 값이 있어 원본을 보존했어요.')
  }
  return x as CertificateState
}
export type CertificateChange =
  | { kind: 'visit' }
  | { kind: 'draft'; text: string; expected: string }
  | { kind: 'check'; value: string; checked: boolean }
  | { kind: 'review'; interval: 0 | 1 | 3 }
export function changeCertificate(
  state: CertificateState,
  id: string,
  action: CertificateChange,
  now = new Date(),
): CertificateState {
  const lesson = certificateLessons.get(id)
  if (!lesson) throw Error('알 수 없는 정처기 수업이에요.')
  const at = now.toISOString(),
    before = state.entries[id]
  const entry: CertificateEntry = before
    ? { ...before, checks: [...before.checks] }
    : { draft: '', checks: [], visitedAt: at, updatedAt: at }
  if (action.kind === 'visit') entry.visitedAt = at
  else {
    entry.updatedAt = at
    if (action.kind === 'draft') {
      if (action.text.length > 6000)
        throw Error('메모는 6,000자까지 쓸 수 있어요.')
      if (entry.draft !== action.expected && entry.draft !== action.text)
        throw Error(
          '다른 탭에서 같은 메모가 바뀌었어요. 입력한 글을 복사해 보관하고 새로고침해 비교해 주세요.',
        )
      entry.draft = action.text
    } else if (action.kind === 'check') {
      if (!lesson.checklist.includes(action.value))
        throw Error('점검 항목을 확인해 주세요.')
      entry.checks = action.checked
        ? [...new Set([...entry.checks, action.value])]
        : entry.checks.filter((c) => c !== action.value)
    } else if (action.interval === 0) delete entry.due
    else entry.due = shiftDay(kstToday(now), action.interval)
  }
  return { version: 1, entries: { ...state.entries, [id]: entry } }
}
export function saveCertificate(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  id: string,
  action: CertificateChange,
): CertificateState {
  const next = changeCertificate(
    readCertificate(storage.getItem(CERTIFICATE_KEY)),
    id,
    action,
  )
  storage.setItem(CERTIFICATE_KEY, JSON.stringify(next))
  return next
}
export function mergeCertificate(
  current: CertificateState,
  incoming: CertificateState,
) {
  const conflicts = Object.keys(incoming.entries).filter(
    (id) =>
      current.entries[id]?.draft.trim() &&
      current.entries[id].draft !== incoming.entries[id].draft,
  )
  if (conflicts.length) return { state: current, conflicts }
  const entries = { ...current.entries }
  for (const [id, value] of Object.entries(incoming.entries)) {
    const old = entries[id]
    if (
      !old ||
      (!old.draft.trim() && value.draft.trim()) ||
      Date.parse(value.updatedAt) > Date.parse(old.updatedAt)
    )
      entries[id] = value
  }
  return { state: { version: 1 as const, entries }, conflicts: [] }
}
