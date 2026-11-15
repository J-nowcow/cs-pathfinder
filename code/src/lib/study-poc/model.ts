import {
  isActivityId, validExperiment, validId, validStamp, MAX_ANSWER_LENGTH, MAX_ATTEMPTS,
  MAX_GOAL_LENGTH, PACK_VERSION, ACTIVITIES, type ActivityId, type ExperimentParams, type Session, type Workspace,
} from './contract'

export function emptyWorkspace(): Workspace {
  return { version: 1, revision: 0, currentSessionId: null, sessionsById: {} }
}
export function activityIdentity(sessionId: string, activity: ActivityId) {
  if (!validId(sessionId) || !isActivityId(activity)) throw new Error('invalid_identity')
  return { activityInstanceId: `${sessionId}:${activity}`, editorId: `${sessionId}:${activity}:draft` }
}
export function createSession(goal: string, id: string, now: string): Session {
  if (!validId(id) || !validStamp(now) || !goal.trim() || goal.length > MAX_GOAL_LENGTH) throw new Error('invalid_session')
  return {
    id, packVersion: PACK_VERSION, goal: goal.trim(), currentActivity: 'explain', activityOrder: [...ACTIVITIES], revision: 0,
    answers: {}, attempts: [], experiment: { pool: 3, requests: 12, dbCapacity: 2 },
    createdAt: now, updatedAt: now,
  }
}
export type SessionPatch = { activity?: ActivityId; order?: ActivityId[]; answer?: { activity: ActivityId; text: string }; experiment?: ExperimentParams }
export function updateSession(session: Session, patch: SessionPatch, now: string): Session {
  if (!validStamp(now) || (patch.activity !== undefined && !isActivityId(patch.activity))
    || (patch.answer && (!isActivityId(patch.answer.activity) || patch.answer.text.length > MAX_ANSWER_LENGTH))
    || (patch.order && (patch.order.length !== ACTIVITIES.length || new Set(patch.order).size !== ACTIVITIES.length || !patch.order.every(isActivityId)))
    || (patch.experiment && !validExperiment(patch.experiment))) throw new Error('invalid_change')
  return {
    ...session, revision: session.revision + 1, updatedAt: now,
    ...(patch.activity ? { currentActivity: patch.activity } : {}),
    ...(patch.order ? { activityOrder: [...patch.order] } : {}),
    ...(patch.experiment ? { experiment: { ...patch.experiment } } : {}),
    ...(patch.answer ? { answers: { ...session.answers, [patch.answer.activity]: { text: patch.answer.text, updatedAt: now } } } : {}),
  }
}
export function submitAttempt(session: Session, activity: ActivityId, attemptId: string, now: string): Session {
  const text = session.answers[activity]?.text
  if (!isActivityId(activity) || !validId(attemptId) || !validStamp(now) || !text?.trim()
    || session.attempts.some((attempt) => attempt.id === attemptId) || session.attempts.length >= MAX_ATTEMPTS) throw new Error('invalid_attempt')
  return {
    ...session, revision: session.revision + 1, updatedAt: now,
    attempts: [...session.attempts, { id: attemptId, activity, text, at: now }],
  }
}

export type QueueRow = { tick: number; active: number; waitingPool: number; waitingDb: number; completed: number }
/** All requests arrive at tick zero; each identical job takes three arbitrary
 * ticks, holding one pool slot. No network, query, CPU, creation or reuse cost.
 * Database capacity is an independent assumption, never a pool-sizing formula. */
export function simulateQueue(params: ExperimentParams) {
  if (!validExperiment(params)) throw new Error('invalid_experiment')
  let queued = params.requests
  let waitingDb = 0
  let completed = 0
  let active: number[] = []
  const fill = () => {
    const admitted = Math.min(queued, params.pool - active.length - waitingDb)
    queued -= admitted
    waitingDb += admitted
    const started = Math.min(waitingDb, params.dbCapacity - active.length)
    waitingDb -= started
    active.push(...Array<number>(started).fill(3))
  }
  fill()
  const rows: QueueRow[] = [{ tick: 0, active: active.length, waitingPool: queued, waitingDb, completed }]
  let tick = 0
  while (completed < params.requests) {
    tick += 1
    active = active.map((remaining) => remaining - 1)
    completed += active.filter((remaining) => remaining === 0).length
    active = active.filter((remaining) => remaining > 0)
    fill()
    rows.push({ tick, active: active.length, waitingPool: queued, waitingDb, completed })
  }
  return { rows, ticks: tick, totalRequests: params.requests,
    maxWaitingPool: Math.max(...rows.map((row) => row.waitingPool)),
    maxWaitingDb: Math.max(...rows.map((row) => row.waitingDb)) }
}
