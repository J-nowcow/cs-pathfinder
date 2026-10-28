import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  nodes: [
    { identityScope: 'generic', category: 'synthetic', question: 'Synthetic source', body: 'Synthetic body', suggestions: ['Synthetic next'] },
    { identityScope: 'generic', category: 'synthetic', question: 'Synthetic target', body: 'Synthetic body', suggestions: [] },
  ],
  relations: [{ fromScope: 'generic', fromQuestion: 'Synthetic source', toScope: 'generic', toQuestion: 'Synthetic target', kind: 'prerequisite' as const, reason: 'Synthetic relation', votes: 2 }],
  queries: [] as string[],
  failureStage: null as string | null,
  failure: null as Error | null,
}))
vi.mock('../../data/example-nodes', () => ({ EXAMPLE_NODES: fixture.nodes }))
vi.mock('../../data/generated-nodes', () => ({ GENERATED_NODES: [] }))
vi.mock('../../data/authored-nodes', () => ({ AUTHORED_NODES: [] }))
vi.mock('../../data/on-demand-nodes', () => ({ ON_DEMAND_NODES: [] }))
vi.mock('../../data/renames', () => ({ QUESTION_RENAMES: [] }))
vi.mock('../../data/node-tags', () => ({ NODE_TAGS: [] }))
vi.mock('../../data/node-levels', () => ({ NODE_LEVELS: [] }))
vi.mock('../../data/relations', () => ({ SEED_RELATIONS: fixture.relations }))

function stageOf(sql: string): string {
  if (sql.startsWith('select id, normalized_question q from qnode')) return 'required-node-read'
  if (sql.startsWith('select qnode_id, position, text from qnode_suggestion')) return 'required-suggestion-read'
  if (sql.startsWith('insert into qnode ')) return 'required-node-write'
  if (sql.startsWith('insert into qnode_suggestion')) return 'required-suggestion-write'
  if (sql.startsWith('insert into qnode_alias')) return 'required-alias-write'
  if (sql.startsWith('select id, identity_scope as scope')) return 'relation-node-read'
  if (sql.startsWith('insert into semantic_relation')) return 'optional-relation-write'
  return 'required-node-or-suggestion-write'
}
vi.mock('@/lib/db/client', () => ({
  getDb: async () => ({
    query: async (text: string) => {
      const sql = text.replace(/\s+/g, ' ').trim()
      const stage = stageOf(sql)
      fixture.queries.push(stage)
      if (fixture.failureStage === stage) throw fixture.failure
      if (stage === 'relation-node-read') return [
        { id: '00000000-0000-4000-8000-000000000001', scope: 'generic', question: 'Synthetic source' },
        { id: '00000000-0000-4000-8000-000000000002', scope: 'generic', question: 'Synthetic target' },
      ]
      return []
    },
  }),
}))
import { ensureSeeded, resetSeedCache, seedRelations } from '@/lib/db/bootstrap'

const mandatoryStages = ['required-node-read', 'required-suggestion-read', 'required-node-write', 'required-suggestion-write', 'required-alias-write', 'relation-node-read']
const stages = [...mandatoryStages, 'optional-relation-write']
const attemptsAfterRetry = (stage: string) => stage === 'required-node-write' ? 1 + fixture.nodes.length : 2
beforeEach(() => {
  resetSeedCache()
  fixture.queries = []
  fixture.failureStage = null
  fixture.failure = null
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  resetSeedCache()
  vi.restoreAllMocks()
})

describe('seed error boundaries with one synthetic relation and no database', () => {
  it.each(mandatoryStages)('%s: rejects both waiters and retries a required missing table', async (stage) => {
    fixture.failureStage = stage
    const error = Object.assign(new Error('Synthetic required table unavailable'), { code: '42P01' })
    fixture.failure = error
    const first = ensureSeeded(), second = ensureSeeded()
    expect(second).toBe(first)
    const outcomes = await Promise.allSettled([first, second])
    const attempts = fixture.queries.filter((query) => query === stage).length
    fixture.failureStage = null
    const retry = ensureSeeded()
    const retryOutcome = await Promise.allSettled([retry])
    expect({ outcomes, attempts, retryIsFresh: retry !== first, retryOutcome, totalAttempts: fixture.queries.filter((query) => query === stage).length }).toEqual({
      outcomes: [{ status: 'rejected', reason: error }, { status: 'rejected', reason: error }],
      attempts: 1,
      retryIsFresh: true,
      retryOutcome: [{ status: 'fulfilled', value: undefined }],
      totalAttempts: attemptsAfterRetry(stage),
    })
  })

  it('keeps optional semantic-relation absence successful and cached for both waiters', async () => {
    fixture.failureStage = 'optional-relation-write'
    fixture.failure = Object.assign(new Error('Synthetic optional relation absent'), { code: '42P01' })
    const first = ensureSeeded(), second = ensureSeeded()
    expect(second).toBe(first)
    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
    expect(ensureSeeded()).toBe(first)
    expect(fixture.queries.filter((query) => query === 'optional-relation-write')).toHaveLength(1)
  })

  it.each(stages)('%s: propagates other errors to both waiters and permits retry', async (stage) => {
    fixture.failureStage = stage
    const error = Object.assign(new Error('Synthetic transport unavailable'), { code: '08006' })
    fixture.failure = error
    const first = ensureSeeded(), second = ensureSeeded()
    expect(second).toBe(first)
    expect(await Promise.allSettled([first, second])).toEqual([
      { status: 'rejected', reason: error }, { status: 'rejected', reason: error },
    ])
    fixture.failureStage = null
    const retry = ensureSeeded()
    expect(retry).not.toBe(first)
    await expect(retry).resolves.toBeUndefined()
    expect(fixture.queries.filter((query) => query === stage)).toHaveLength(attemptsAfterRetry(stage))
  })

  it.each(['42P01', '08006'])('keeps direct relation seed errors unchanged for code %s', async (code) => {
    fixture.failureStage = 'optional-relation-write'
    const error = Object.assign(new Error('Synthetic direct relation failure'), { code })
    fixture.failure = error
    await expect(seedRelations(fixture.relations)).rejects.toBe(error)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('shares successful work and reuses its completed promise without additional queries', async () => {
    const first = ensureSeeded(), second = ensureSeeded()
    expect(second).toBe(first)
    await expect(first).resolves.toBeUndefined()
    const completedQueries = fixture.queries.slice()
    expect(ensureSeeded()).toBe(first)
    expect(fixture.queries).toEqual(completedQueries)
    expect(fixture.queries.filter((query) => query === 'optional-relation-write')).toHaveLength(1)
    expect(console.warn).not.toHaveBeenCalled()
  })
})
