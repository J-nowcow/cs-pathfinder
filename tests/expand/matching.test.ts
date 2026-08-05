import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { expand } from '@/lib/expand'
import {
  insertNode,
  ensureEdge,
  collectCandidates,
  linkEquivalent,
  MAX_CANDIDATES,
} from '@/lib/expand/nodes'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { MODEL_GATE, MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

const mk = (q: string, status: 'ready' | 'pending' = 'ready') =>
  insertNode({
    identityScope: 'postgres',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '데이터베이스',
    status,
    origin: 'on_demand',
  })

type CallSpy = { mock: { calls: Array<[{ model: string; prompt: string }]> } }
const modelsCalled = (c: StructuredCaller) =>
  (c as unknown as CallSpy).mock.calls.map((x) => x[0].model)

/** 게이트가 지정한 후보를 고르는 스텁 */
function matchingCall(matchId: string): StructuredCaller {
  return vi.fn(async (args: { model: string }) => {
    if (args.model === MODEL_GATE) {
      return { relevant: true, reason: '', matched_id: matchId, identity_scope: '', normalized_question: '' }
    }
    return { body: '생성되면 안 된다', suggestions: [{ text: 'x' }] }
  }) as unknown as StructuredCaller
}

/** 아무것도 매칭하지 않는 스텁 */
function creatingCall(question: string): StructuredCaller {
  return vi.fn(async (args: { model: string }) => {
    if (args.model === MODEL_GATE) {
      return {
        relevant: true,
        reason: '',
        matched_id: '',
        identity_scope: 'postgres',
        normalized_question: question,
      }
    }
    return { body: '새 해설', suggestions: [{ text: '꼬리1' }, { text: '꼬리2' }] }
  }) as unknown as StructuredCaller
}

describe('collectCandidates', () => {
  beforeEach(truncateAll)

  it('returns the parent children', async () => {
    const parent = await mk('부모?')
    const a = await mk('자식 A?')
    const b = await mk('자식 B?')
    await ensureEdge(parent, a)
    await ensureEdge(parent, b)

    const got = await collectCandidates(parent)
    expect(got.map((c) => c.question).sort()).toEqual(['자식 A?', '자식 B?'])
  })

  it('adds the grandparent other children (1-hop)', async () => {
    // 조부모 ─┬─ 부모 ─── 자식
    //         └─ 삼촌
    const grand = await mk('조부모?')
    const parent = await mk('부모?')
    const uncle = await mk('삼촌?')
    const child = await mk('자식?')
    await ensureEdge(grand, parent)
    await ensureEdge(grand, uncle)
    await ensureEdge(parent, child)

    const got = await collectCandidates(parent)
    const questions = got.map((c) => c.question)
    expect(questions).toContain('자식?')
    expect(questions).toContain('삼촌?')
  })

  it('puts siblings before uncles', async () => {
    const grand = await mk('조부모?')
    const parent = await mk('부모?')
    const uncle = await mk('삼촌?')
    const child = await mk('자식?')
    await ensureEdge(grand, parent)
    await ensureEdge(grand, uncle)
    await ensureEdge(parent, child)

    const got = await collectCandidates(parent)
    expect(got[0].question).toBe('자식?')
  })

  it('never includes the parent itself', async () => {
    const grand = await mk('조부모?')
    const parent = await mk('부모?')
    await ensureEdge(grand, parent)

    const got = await collectCandidates(parent)
    expect(got.map((c) => c.id)).not.toContain(parent)
  })

  it('excludes nodes that are not ready', async () => {
    const parent = await mk('부모?')
    const pending = await mk('생성 중?', 'pending')
    await ensureEdge(parent, pending)

    expect(await collectCandidates(parent)).toHaveLength(0)
  })

  it('deduplicates a node reachable as both sibling and uncle', async () => {
    const grand = await mk('조부모?')
    const parent = await mk('부모?')
    const shared = await mk('양쪽에서 닿는 노드?')
    await ensureEdge(grand, parent)
    await ensureEdge(grand, shared)
    await ensureEdge(parent, shared)

    const got = await collectCandidates(parent)
    expect(got.filter((c) => c.id === shared)).toHaveLength(1)
  })

  it('caps the list so the prompt does not grow without bound', async () => {
    const parent = await mk('부모?')
    for (let i = 0; i < MAX_CANDIDATES + 5; i += 1) {
      await ensureEdge(parent, await mk(`자식 ${i}?`))
    }

    expect(await collectCandidates(parent)).toHaveLength(MAX_CANDIDATES)
  })

  it('returns nothing for an isolated node', async () => {
    expect(await collectCandidates(await mk('외톨이?'))).toHaveLength(0)
  })
})

describe('expand — 매칭 경로', () => {
  beforeEach(truncateAll)

  const base = (parent: string, call: StructuredCaller) => ({
    quotaKey: 'anon:match',
    dailyLimit: 5,
    parentNodeId: parent,
    ancestorNodeIds: [parent],
    mode: 'free' as const,
    rawInput: '왜 코어 수 기반?',
    call,
  })

  it('reuses the matched node without calling the generation model', async () => {
    const parent = await mk('부모?')
    const existing = await mk('이미 있는 질문?')
    await ensureEdge(parent, existing)

    const call = matchingCall(existing)
    const r = await expand(base(parent, call))

    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.node.id).toBe(existing)
    expect(r.cache).toBe('hit')
    expect(modelsCalled(call)).toEqual([MODEL_GATE])
    expect(modelsCalled(call)).not.toContain(MODEL_GENERATE)
  })

  it('does not consume quota when the gate matches', async () => {
    const parent = await mk('부모?')
    const existing = await mk('이미 있는 질문?')
    await ensureEdge(parent, existing)

    const r = await expand(base(parent, matchingCall(existing)))
    if (r.kind !== 'ok') throw new Error('expected ok')
    expect(r.quota.used).toBe(0)
  })

  it('creates a node when nothing matches', async () => {
    const parent = await mk('부모?')
    const r = await expand(base(parent, creatingCall('완전히 새로운 질문은?')))

    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('miss')
    expect(r.node.question).toBe('완전히 새로운 질문은?')
    expect(r.quota.used).toBe(1)
  })

  it('jumps instead of looping when the matched node is already an ancestor', async () => {
    const parent = await mk('부모?')
    const existing = await mk('이미 지나온 질문?')
    await ensureEdge(parent, existing)

    const r = await expand({
      ...base(parent, matchingCall(existing)),
      ancestorNodeIds: [existing, parent],
    })

    expect(r.kind).toBe('ancestor_jump')
    if (r.kind === 'ancestor_jump') expect(r.ancestorIndex).toBe(0)
  })

  it('records the candidates and the match so the decision can be revisited', async () => {
    const parent = await mk('부모?')
    const existing = await mk('이미 있는 질문?')
    await ensureEdge(parent, existing)

    await expand(base(parent, matchingCall(existing)))

    const db = await getDb()
    const rows = await db.query<{
      candidate_ids: string[]
      matched_node_id: string
      gate_version: string
    }>('select candidate_ids, matched_node_id, gate_version from expansion_event')

    expect(rows).toHaveLength(1)
    expect(rows[0].matched_node_id).toBe(existing)
    expect(rows[0].candidate_ids).toContain(existing)
    expect(rows[0].gate_version).toBe(NORMALIZER_VERSION)
  })

  it('passes the collected candidates to the gate prompt', async () => {
    const parent = await mk('부모?')
    const existing = await mk('후보로 들어가야 하는 질문?')
    await ensureEdge(parent, existing)

    const call = matchingCall(existing)
    await expand(base(parent, call))

    const prompt = (call as unknown as CallSpy).mock.calls[0][0].prompt
    expect(prompt).toContain('후보로 들어가야 하는 질문?')
  })
})

describe('qnode_equivalence — 가역 병합', () => {
  beforeEach(truncateAll)

  it('stores the pair in a stable order', async () => {
    const a = await mk('노드 A?')
    const b = await mk('노드 B?')

    await linkEquivalent(a, b, 'gate')
    await linkEquivalent(b, a, 'gate')

    const db = await getDb()
    expect(await db.query('select 1 from qnode_equivalence')).toHaveLength(1)
  })

  it('refuses to link a node to itself', async () => {
    const a = await mk('노드 A?')
    await linkEquivalent(a, a, 'gate')

    const db = await getDb()
    expect(await db.query('select 1 from qnode_equivalence')).toHaveLength(0)
  })

  it('leaves both nodes intact so the link can be withdrawn', async () => {
    const a = await mk('노드 A?')
    const b = await mk('노드 B?')
    await linkEquivalent(a, b, 'gate')

    const db = await getDb()
    await db.query('update qnode_equivalence set active = false')

    // 관계만 내렸을 뿐 노드는 그대로다. 되돌릴 것이 없다는 게 이 구조의 요점이다.
    const nodes = await db.query('select id from qnode where id in ($1, $2)', [a, b])
    expect(nodes).toHaveLength(2)
  })
})
