import {
  ACTIVITIES, isActivityId, isRecord, validExperiment, validId, validRevision, validStamp,
  MAX_ANSWER_LENGTH, MAX_ATTEMPTS, MAX_GOAL_LENGTH, MAX_SESSIONS, MAX_WORKSPACE_BYTES,
  PACK_VERSION, WORKSPACE_KEY, type Session, type Workspace,
} from './contract'
import { emptyWorkspace } from './model'

type Store = Pick<Storage, 'getItem' | 'setItem'>
export type LockManagerLike = { request<T>(name: string, callback: () => Promise<T> | T): Promise<T> }
export type WorkspaceRead = {
  status: 'ready' | 'readonly' | 'unavailable'
  state: Workspace | null
  raw: string | null
  reason?: string
}
const fail = (code: string): never => { throw new Error(code) }
const only = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every((key) => keys.includes(key))
const bytes = (raw: string) => new TextEncoder().encode(raw).length

/** Strict namespace parser: unsupported or malformed raw values are never repaired
 * and written back. Existing application keys are never read by this adapter. */
export function parseWorkspace(raw: string): Workspace {
  if (bytes(raw) > MAX_WORKSPACE_BYTES) return fail('workspace_too_large')
  const value: unknown = JSON.parse(raw)
  if (!isRecord(value) || !only(value, ['version', 'revision', 'currentSessionId', 'sessionsById'])
    || value.version !== 1 || !validRevision(value.revision) || !isRecord(value.sessionsById)
    || Object.keys(value.sessionsById).length > MAX_SESSIONS) return fail('invalid_workspace')
  if (value.currentSessionId !== null && (!validId(value.currentSessionId) || !Object.hasOwn(value.sessionsById, value.currentSessionId))) return fail('invalid_current_session')
  for (const [id, candidate] of Object.entries(value.sessionsById)) {
    if (!validId(id) || !isRecord(candidate) || !only(candidate, [
      'id', 'packVersion', 'goal', 'currentActivity', 'activityOrder', 'revision', 'answers', 'attempts', 'experiment', 'createdAt', 'updatedAt',
    ]) || candidate.id !== id || candidate.packVersion !== PACK_VERSION
      || typeof candidate.goal !== 'string' || !candidate.goal.trim() || candidate.goal.length > MAX_GOAL_LENGTH
      || !isActivityId(candidate.currentActivity) || !validRevision(candidate.revision)
      || !validStamp(candidate.createdAt) || !validStamp(candidate.updatedAt) || !validExperiment(candidate.experiment)
      || !Array.isArray(candidate.activityOrder) || candidate.activityOrder.length !== ACTIVITIES.length
      || new Set(candidate.activityOrder).size !== ACTIVITIES.length || !candidate.activityOrder.every(isActivityId)
      || !isRecord(candidate.answers) || !Array.isArray(candidate.attempts) || candidate.attempts.length > MAX_ATTEMPTS) return fail('invalid_session')
    for (const [activity, answer] of Object.entries(candidate.answers)) {
      if (!isActivityId(activity) || !isRecord(answer) || !only(answer, ['text', 'updatedAt'])
        || typeof answer.text !== 'string' || answer.text.length > MAX_ANSWER_LENGTH || !validStamp(answer.updatedAt)) return fail('invalid_answer')
    }
    const attemptIds = new Set<string>()
    for (const attempt of candidate.attempts) {
      if (!isRecord(attempt) || !only(attempt, ['id', 'activity', 'text', 'at']) || !validId(attempt.id)
        || attemptIds.has(attempt.id) || !isActivityId(attempt.activity) || !validStamp(attempt.at)
        || (attempt.text !== undefined && (typeof attempt.text !== 'string' || !attempt.text.trim() || attempt.text.length > MAX_ANSWER_LENGTH))) return fail('invalid_attempt')
      attemptIds.add(attempt.id)
    }
  }
  return value as Workspace
}
export function readWorkspace(storage: Pick<Storage, 'getItem'>): WorkspaceRead {
  let raw: string | null
  try { raw = storage.getItem(WORKSPACE_KEY) } catch { return { status: 'unavailable', state: null, raw: null, reason: 'storage_unavailable' } }
  if (raw === null) return { status: 'ready', state: emptyWorkspace(), raw }
  try { return { status: 'ready', state: parseWorkspace(raw), raw } }
  catch { return { status: 'readonly', state: null, raw, reason: 'unsupported_or_malformed' } }
}
export type CommitResult = { ok: true; raw: string; state: Workspace } | {
  ok: false; code: 'unsupported' | 'conflict' | 'readonly' | 'invalid' | 'write'; message: string
}
/** All cooperating writers use one origin-scoped Web Lock. Exact raw/revision
 * checks also reject stale UI. No lock support means no persistent write. */
export async function commitWorkspace(
  storage: Store, locks: LockManagerLike | null | undefined, expectedRaw: string | null, next: Workspace,
): Promise<CommitResult> {
  if (!locks?.request) return { ok: false, code: 'unsupported', message: 'locks_unavailable' }
  let serialized: string
  try { serialized = JSON.stringify(next); parseWorkspace(serialized) }
  catch { return { ok: false, code: 'invalid', message: 'invalid_workspace' } }
  try {
    return await locks.request(WORKSPACE_KEY, () => {
      const current = readWorkspace(storage)
      if (current.status !== 'ready' || !current.state) return { ok: false, code: 'readonly', message: 'unreadable_workspace' } as CommitResult
      if (current.raw !== expectedRaw || next.revision !== current.state.revision + 1) return { ok: false, code: 'conflict', message: 'workspace_changed' } as CommitResult
      try { storage.setItem(WORKSPACE_KEY, serialized) }
      catch { return { ok: false, code: 'write', message: 'storage_write_failed' } as CommitResult }
      return { ok: true, raw: serialized, state: next } as CommitResult
    })
  } catch { return { ok: false, code: 'write', message: 'lock_or_storage_failed' } }
}

/** Exports only this PoC namespace. Goal text is still personal; UI must disclose it. */
export function exportWorkspace(state: Workspace, includeAnswers = false): string {
  const checked = parseWorkspace(JSON.stringify(state))
  const sessionsById = Object.fromEntries(Object.entries(checked.sessionsById).map(([id, session]) => [id, {
    ...session,
    answers: includeAnswers ? session.answers : {},
    attempts: session.attempts.map(({ text, ...attempt }) => includeAnswers && text !== undefined ? { ...attempt, text } : attempt),
  }]))
  return JSON.stringify({
    format: 'csqt.study-poc.backup', version: 1,
    manifest: { namespace: WORKSPACE_KEY, includeAnswers, excludedExistingKeys: true },
    workspace: { ...checked, sessionsById },
  })
}
export function parseWorkspaceImport(raw: string): Workspace {
  if (bytes(raw) > MAX_WORKSPACE_BYTES + 100_000) return fail('backup_too_large')
  const envelope: unknown = JSON.parse(raw)
  if (!isRecord(envelope) || !only(envelope, ['format', 'version', 'manifest', 'workspace'])
    || envelope.format !== 'csqt.study-poc.backup' || envelope.version !== 1 || !isRecord(envelope.manifest)
    || !only(envelope.manifest, ['namespace', 'includeAnswers', 'excludedExistingKeys'])
    || envelope.manifest.namespace !== WORKSPACE_KEY || typeof envelope.manifest.includeAnswers !== 'boolean'
    || envelope.manifest.excludedExistingKeys !== true) return fail('invalid_backup')
  const state = parseWorkspace(JSON.stringify(envelope.workspace))
  if (!envelope.manifest.includeAnswers && Object.values(state.sessionsById).some((session) =>
    Object.keys(session.answers).length > 0 || session.attempts.some((attempt) => attempt.text !== undefined))) return fail('backup_scope_mismatch')
  return state
}
/** Conflict requires an explicit new import decision; never silently replace
 * a same-ID session, including omitted-answer backups over retained answers. */
export function mergeWorkspaceImport(existing: Workspace, incoming: Workspace): Workspace {
  const current = parseWorkspace(JSON.stringify(existing))
  const imported = parseWorkspace(JSON.stringify(incoming))
  // JSON object member order is not data. In particular, text-optional export
  // can put attempt.text after at; arrays retain their meaningful history order.
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    return JSON.stringify(value)
  }
  const sessionsById: Record<string, Session> = { ...current.sessionsById }
  for (const [id, session] of Object.entries(imported.sessionsById)) {
    if (Object.hasOwn(sessionsById, id) && canonical(sessionsById[id]) !== canonical(session)) return fail('import_session_conflict')
    sessionsById[id] = session
  }
  const result: Workspace = {
    ...current, revision: current.revision + 1, sessionsById,
    currentSessionId: current.currentSessionId ?? imported.currentSessionId,
  }
  return parseWorkspace(JSON.stringify(result))
}

export { WORKSPACE_KEY } from './contract'
