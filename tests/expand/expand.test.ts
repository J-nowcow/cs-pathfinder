import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { expand } from '@/lib/expand'
import { insertNode, insertSuggestions } from '@/lib/expand/nodes'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { MODEL_GATE, MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

const PARENT_Q = 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?'
const CANON = 'connection pool size를 코어 수 기준으로 정하는 이유는?'

async function makeParent(): Promise<string> {
  return insertNode({
    identityScope: 'postgres',
    normalizedQuestion: PARENT_Q,
    body: '본문',
    primaryCategory: '데이터베이스',
    status: 'ready',
    origin: 'batch',
  })
}

/** 게이트와 생성을 모델별로 분기하는 스텁 */
function makeCall(over?: { scope?: string; question?: string }): StructuredCaller {
  return vi.fn(async (args: { model: string }) => {
    if (args.model === MODEL_GATE) {
      return {
        relevant: true,
        reason: '',
        identity_scope: over?.scope ?? 'postgres',
        normalized_question: over?.question ?? CANON,
      }
    }
    return {
      body: '코어 수가 동시 실행 상한을 정하기 때문이다.',
      suggestions: [
        { text: '컨텍스트 스위칭이란?' },
        { text: 'HikariCP 기본값은?' },
        { text: '디스크 수는 왜 더하나?' },
        { text: 'pool이 작으면 무슨 일이 생기나?' },
        { text: 'connection leak은 어떻게 감지하나?' },
      ],
    }
  }) as unknown as StructuredCaller
}

type CallSpy = { mock: { calls: Array<[{ model: string }]> } }
const modelsCalled = (c: StructuredCaller) =>
  (c as unknown as CallSpy).mock.calls.map((x) => x[0].model)

const base = (parent: string, over: Partial<Parameters<typeof expand>[0]> = {}) => ({
  quotaKey: 'anon:test',
  dailyLimit: 5,
  parentNodeId: parent,
  ancestorNodeIds: [parent],
  mode: 'free' as const,
  rawInput: '왜 코어 수 기반?',
  call: makeCall(),
  ...over,
})

describe('expand', () => {
  beforeEach(truncateAll)

  it('generates a node on cache miss and marks it ready', async () => {
    const parent = await makeParent()
    const r = await expand(base(parent))

    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('miss')
    expect(r.node.body).toContain('코어 수')
    expect(r.node.suggestions).toHaveLength(5)
    expect(r.quota.used).toBe(1)
  })

  it('creates the edge from parent to the new node', async () => {
    const parent = await makeParent()
    const r = await expand(base(parent))
    if (r.kind !== 'ok') throw new Error('expected ok')

    const db = await getDb()
    const rows = await db.query('select 1 from qedge where parent_id = $1 and child_id = $2', [
      parent,
      r.node.id,
    ])
    expect(rows).toHaveLength(1)
  })

  it('binds the alias so the next identical request hits', async () => {
    const parent = await makeParent()
    const r = await expand(base(parent))
    if (r.kind !== 'ok') throw new Error('expected ok')

    const db = await getDb()
    const rows = await db.query<{ qnode_id: string }>(
      'select qnode_id from qnode_alias where normalizer_version = $1 and normalized_hash = $2',
      [NORMALIZER_VERSION, questionHash('postgres', CANON)],
    )
    expect(rows[0].qnode_id).toBe(r.node.id)
  })

  it('returns a hit without calling the generation model', async () => {
    const parent = await makeParent()
    await expand(base(parent))

    const second = makeCall()
    const r = await expand(
      base(parent, { rawInput: '코어 수로 정하는 이유가 뭔가요?', call: second, quotaKey: 'anon:b' }),
    )

    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('hit')
    expect(modelsCalled(second)).toEqual([MODEL_GATE])
    expect(modelsCalled(second)).not.toContain(MODEL_GENERATE)
  })

  it('does not consume quota on cache hit', async () => {
    const parent = await makeParent()
    await expand(base(parent))
    const r = await expand(base(parent, { ancestorNodeIds: [parent] }))
    if (r.kind !== 'ok') throw new Error('expected ok')

    expect(r.cache).toBe('hit')
    expect(r.quota.used).toBe(1)
  })

  it('resolves a suggestion without any LLM call', async () => {
    const parent = await makeParent()
    const created = await expand(base(parent))
    if (created.kind !== 'ok') throw new Error('expected ok')

    const db = await getDb()
    const rows = await db.query<{ id: string }>(
      `insert into qnode_suggestion (qnode_id, text, position, target_node_id)
       values ($1, '이미 해소된 추천', 9, $2) returning id`,
      [parent, created.node.id],
    )

    const call = makeCall()
    const r = await expand(
      base(parent, { mode: 'suggestion', suggestionId: rows[0].id, rawInput: undefined, call }),
    )

    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('suggestion_resolved')
    expect(modelsCalled(call)).toHaveLength(0)
  })

  it('rejects an irrelevant free input', async () => {
    const parent = await makeParent()
    const call = vi.fn(async () => ({
      relevant: false,
      reason: 'CS 학습과 무관합니다.',
      identity_scope: 'generic',
      normalized_question: '',
    })) as unknown as StructuredCaller

    const r = await expand(base(parent, { rawInput: '이거 영어로 번역해줘', call }))
    expect(r.kind).toBe('rejected')
  })

  it('rejects PII before any LLM call', async () => {
    const parent = await makeParent()
    const call = makeCall()
    const r = await expand(base(parent, { rawInput: 'hong@example.com 로 답 주세요', call }))

    expect(r.kind).toBe('invalid')
    if (r.kind === 'invalid') expect(r.code).toBe('pii_suspected')
    expect(modelsCalled(call)).toHaveLength(0)
  })

  it('reports an ancestor jump instead of creating a loop', async () => {
    const parent = await makeParent()
    const created = await expand(base(parent))
    if (created.kind !== 'ok') throw new Error('expected ok')

    const r = await expand(
      base(parent, {
        parentNodeId: created.node.id,
        ancestorNodeIds: [parent, created.node.id],
        quotaKey: 'anon:c',
      }),
    )

    expect(r.kind).toBe('ancestor_jump')
    if (r.kind !== 'ancestor_jump') return
    expect(r.ancestorIndex).toBe(1)
  })

  it('refuses when the daily limit is exhausted', async () => {
    const parent = await makeParent()
    const r1 = await expand(base(parent, { dailyLimit: 1 }))
    expect(r1.kind).toBe('ok')

    const r2 = await expand(
      base(parent, {
        dailyLimit: 1,
        rawInput: '인덱스는 왜 안 타나?',
        call: makeCall({ question: '인덱스가 사용되지 않는 이유는?' }),
      }),
    )
    expect(r2.kind).toBe('quota_exceeded')
  })

  it('releases the reservation when generation throws', async () => {
    const parent = await makeParent()
    const call = vi.fn(async (args: { model: string }) => {
      if (args.model === MODEL_GATE) {
        return {
          relevant: true,
          reason: '',
          identity_scope: 'postgres',
          normalized_question: '생성이 실패하는 질문은?',
        }
      }
      throw new Error('generation blew up')
    }) as unknown as StructuredCaller

    const r = await expand(base(parent, { call, quotaKey: 'anon:fail' }))
    expect(r.kind).toBe('generation_failed')

    const db = await getDb()
    const rows = await db.query<{ used: number; reserved: number }>(
      'select * from quota_get($1)',
      ['anon:fail'],
    )
    expect(Number(rows[0].used)).toBe(0)
    expect(Number(rows[0].reserved)).toBe(0)
  })

  it('lets a later request retry after a generation failure', async () => {
    const parent = await makeParent()
    const failing = vi.fn(async (args: { model: string }) => {
      if (args.model === MODEL_GATE) {
        return { relevant: true, reason: '', identity_scope: 'postgres', normalized_question: CANON }
      }
      throw new Error('boom')
    }) as unknown as StructuredCaller

    await expand(base(parent, { call: failing }))
    const r = await expand(base(parent, { quotaKey: 'anon:retry' }))

    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.cache).toBe('miss')
  })

  it('records the raw input in expansion_event only', async () => {
    const parent = await makeParent()
    const raw = '내 원문은 여기에만 남아야 한다'
    await expand(
      base(parent, { rawInput: raw, call: makeCall({ question: '원문 격리 확인용 질문은?' }) }),
    )

    const db = await getDb()
    expect(await db.query('select 1 from expansion_event where raw_input = $1', [raw])).toHaveLength(1)
    expect(await db.query('select 1 from qnode where normalized_question = $1', [raw])).toHaveLength(0)
  })

  it('returns not_found for a missing parent', async () => {
    const r = await expand(base('00000000-0000-0000-0000-000000000000'))
    expect(r.kind).toBe('not_found')
  })

  it('reuses one node across two different parents', async () => {
    const parentA = await makeParent()
    const parentB = await insertNode({
      identityScope: 'network',
      normalizedQuestion: 'TCP 연결은 어떻게 수립되는가?',
      body: '본문',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'batch',
    })

    const a = await expand(base(parentA))
    const b = await expand(base(parentB, { parentNodeId: parentB, ancestorNodeIds: [parentB], quotaKey: 'anon:d' }))

    if (a.kind !== 'ok' || b.kind !== 'ok') throw new Error('expected ok')
    expect(b.node.id).toBe(a.node.id)
    expect(b.cache).toBe('hit')

    const db = await getDb()
    const edges = await db.query('select 1 from qedge where child_id = $1', [a.node.id])
    expect(edges).toHaveLength(2)
  })

  it('keeps suggestions ordered as generated', async () => {
    const parent = await makeParent()
    const r = await expand(base(parent))
    if (r.kind !== 'ok') throw new Error('expected ok')

    expect(r.node.suggestions[0].text).toBe('컨텍스트 스위칭이란?')
    expect(r.node.suggestions[4].text).toBe('connection leak은 어떻게 감지하나?')
    expect(r.node.suggestions.every((s) => s.targetNodeId === null)).toBe(true)
  })
})
