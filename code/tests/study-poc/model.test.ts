import { describe, expect, it } from 'vitest'
import { ACTIVITIES, validateProposal } from '@/lib/study-poc/contract'
import { activityIdentity, createSession, simulateQueue, submitAttempt, updateSession } from '@/lib/study-poc/model'

const NOW = '2026-11-12T04:00:00.000Z'
describe('PoC activity records and attribution', () => {
  it('keeps editor identity and separate activity drafts when composition order changes', () => {
    const first = createSession('Connect pooling and waiting', 'session-a', NOW)
    const draft = updateSession(first, { answer: { activity: 'check', text: 'A bounded pool can still wait.' } }, NOW)
    const changed = updateSession(draft, { order: [...ACTIVITIES].reverse(), activity: 'reflect', answer: { activity: 'reflect', text: 'I still need to inspect total instances.' } }, NOW)
    expect(changed.answers.check?.text).toBe('A bounded pool can still wait.')
    expect(changed.answers.reflect?.text).toContain('instances')
    expect(activityIdentity(first.id, 'check')).toEqual(activityIdentity(changed.id, 'check'))
    expect(activityIdentity(first.id, 'check').editorId).not.toBe(activityIdentity(first.id, 'reflect').editorId)
    expect(first.answers).toEqual({})
    expect(() => updateSession(changed, { order: ['check'] }, NOW)).toThrow('invalid_change')
  })
  it('snapshots each explicit attempt, preserving old answers across later edits and retries', () => {
    let session = createSession('Pool', 'session-a', NOW)
    session = updateSession(session, { answer: { activity: 'check', text: 'first prediction' } }, NOW)
    session = submitAttempt(session, 'check', 'attempt-1', NOW)
    session = updateSession(session, { answer: { activity: 'check', text: 'revised prediction' } }, NOW)
    session = submitAttempt(session, 'check', 'attempt-2', NOW)
    expect(session.attempts.map((attempt) => attempt.text)).toEqual(['first prediction', 'revised prediction'])
    expect(() => submitAttempt(session, 'check', 'attempt-2', NOW)).toThrow('invalid_attempt')
    expect(() => submitAttempt(session, 'reflect', 'attempt-3', NOW)).toThrow('invalid_attempt')
    expect(JSON.stringify(session)).not.toMatch(/mastery|score|passed/)
  })
  it('accepts only registered attributed proposals and rejects cancelled or stale outputs', () => {
    const value = { requestId: 'req-1', sessionId: 'session-a', revision: 2, mode: 'rules', activityIds: ['compare', 'experiment'], reason: 'Inspect shared limits', sourceIds: ['postgres-connections'] }
    const expected = { requestId: 'req-1', sessionId: 'session-a', revision: 2, allowedSourceIds: ['postgres-connections'] }
    expect(validateProposal(value, expected)?.activityIds).toEqual(['compare', 'experiment'])
    for (const patch of [{ revision: 3 }, { sessionId: 'other' }, { requestId: 'req-2' }, { activityIds: ['execute-sql'] }, { activityIds: ['check', 'check'] }, { sourceIds: ['javascript:bad'] }]) {
      expect(validateProposal({ ...value, ...patch }, expected)).toBeNull()
    }
    expect(validateProposal(value, { ...expected, cancelled: true })).toBeNull()
    expect(validateProposal(value, { ...expected, allowedActivityIds: ['check'] })).toBeNull()
  })
})

describe('declared discrete queue model', () => {
  it('matches an independent closed-form duration and conserves every request over the full parameter grid', () => {
    for (let pool = 1; pool <= 12; pool += 1) for (let dbCapacity = 1; dbCapacity <= 12; dbCapacity += 1) for (let requests = 1; requests <= 36; requests += 1) {
      const result = simulateQueue({ pool, dbCapacity, requests })
      expect(result.ticks).toBe(3 * Math.ceil(requests / Math.min(pool, dbCapacity)))
      expect(result.rows[0]).toEqual({ tick: 0, active: Math.min(requests, pool, dbCapacity), waitingPool: Math.max(0, requests - pool), waitingDb: Math.max(0, Math.min(requests, pool) - dbCapacity), completed: 0 })
      for (const row of result.rows) {
        expect(row.active + row.waitingPool + row.waitingDb + row.completed).toBe(requests)
        expect(row.active).toBeLessThanOrEqual(dbCapacity)
        expect(row.active + row.waitingDb).toBeLessThanOrEqual(pool)
      }
      expect(result.rows.at(-1)?.completed).toBe(requests)
    }
  })
  it('plateaus above independent DB capacity rather than claiming an optimal pool formula', () => {
    const small = simulateQueue({ pool: 2, requests: 12, dbCapacity: 2 })
    const large = simulateQueue({ pool: 8, requests: 12, dbCapacity: 2 })
    expect(large.ticks).toBe(small.ticks)
    expect(large.maxWaitingDb).toBe(6)
    expect(() => simulateQueue({ pool: 0, requests: 12, dbCapacity: 2 })).toThrow('invalid_experiment')
  })
})
