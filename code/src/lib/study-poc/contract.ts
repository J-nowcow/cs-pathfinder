export const ACTIVITIES = ['explain', 'compare', 'experiment', 'check', 'reflect'] as const
export type ActivityId = typeof ACTIVITIES[number]
export const PACK_VERSION = 'pool-poc-1' as const
export const WORKSPACE_KEY = 'csqt.study-poc.v1'
export const MAX_SESSIONS = 20
export const MAX_WORKSPACE_BYTES = 1_048_576
export const MAX_GOAL_LENGTH = 200
export const MAX_ANSWER_LENGTH = 6000
export const MAX_ATTEMPTS = 100

export type ExperimentParams = { pool: number; requests: number; dbCapacity: number }
export type ActivityAnswer = { text: string; updatedAt: string }
export type Attempt = { id: string; activity: ActivityId; text?: string; at: string }
export type Session = {
  id: string
  packVersion: typeof PACK_VERSION
  goal: string
  currentActivity: ActivityId
  activityOrder: ActivityId[]
  revision: number
  answers: Partial<Record<ActivityId, ActivityAnswer>>
  attempts: Attempt[]
  experiment: ExperimentParams
  createdAt: string
  updatedAt: string
}
export type Workspace = {
  version: 1
  revision: number
  currentSessionId: string | null
  sessionsById: Record<string, Session>
}
export const isActivityId = (value: unknown): value is ActivityId =>
  typeof value === 'string' && (ACTIVITIES as readonly string[]).includes(value)
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value)
    && !['__proto__', 'constructor', 'prototype'].includes(value)
export const validStamp = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
export const validRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0
export function validExperiment(value: unknown): value is ExperimentParams {
  return isRecord(value) && Object.keys(value).length === 3
    && Number.isInteger(value.pool) && (value.pool as number) >= 1 && (value.pool as number) <= 12
    && Number.isInteger(value.requests) && (value.requests as number) >= 1 && (value.requests as number) <= 36
    && Number.isInteger(value.dbCapacity) && (value.dbCapacity as number) >= 1 && (value.dbCapacity as number) <= 12
}

export type Proposal = {
  requestId: string
  sessionId: string
  revision: number
  mode: 'ai' | 'rules'
  activityIds: ActivityId[]
  reason: string
  sourceIds: string[]
  fallbackReason?: string
}
export function validateProposal(value: unknown, expected: {
  requestId: string; sessionId: string; revision: number; cancelled?: boolean
  allowedActivityIds?: readonly ActivityId[]; allowedSourceIds?: readonly string[]
}): Proposal | null {
  if (expected.cancelled || !isRecord(value) || value.requestId !== expected.requestId
    || value.sessionId !== expected.sessionId || value.revision !== expected.revision
    || !validId(value.requestId) || !validId(value.sessionId) || !validRevision(value.revision)
    || (value.mode !== 'ai' && value.mode !== 'rules')
    || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 400
    || !Array.isArray(value.activityIds) || value.activityIds.length < 1 || value.activityIds.length > 5
    || !value.activityIds.every((id) => isActivityId(id) && (!expected.allowedActivityIds || expected.allowedActivityIds.includes(id)))
    || new Set(value.activityIds).size !== value.activityIds.length
    || !Array.isArray(value.sourceIds) || value.sourceIds.length > 8
    || !value.sourceIds.every((id) => validId(id) && (!expected.allowedSourceIds || expected.allowedSourceIds.includes(id)))
    || (value.fallbackReason !== undefined && (typeof value.fallbackReason !== 'string' || value.fallbackReason.length > 200))) return null
  return {
    requestId: value.requestId, sessionId: value.sessionId, revision: value.revision,
    mode: value.mode, activityIds: value.activityIds as ActivityId[], reason: value.reason,
    sourceIds: value.sourceIds as string[],
    ...(value.fallbackReason !== undefined ? { fallbackReason: value.fallbackReason as string } : {}),
  }
}
