import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { expand } from '@/lib/expand'
import { insertNode, insertSuggestions, linkSuggestion, ensureEdge } from '@/lib/expand/nodes'
import { MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'

/**
 * **매칭이 "어떻게" 됐는지가 로그에 남는가.**
 *
 * 전에는 게이트 매칭과 해시 히트가 둘 다 `matched_node_id`만 채워서
 * 구분이 안 됐고, "전체 확장의 대부분"이라는 `suggestion_resolved` 경로는
 * 이벤트를 아예 안 남겼다. 운영 실측(2026-08-09): accepted 33건 중
 * matched 5건 — 그 5건이 무엇인지 알 수 없었다. **매칭률을 재는 순간
 * 틀린 값이 나오는 상태**였다.
 *
 * 여기 시험은 각 경로의 `recordEvent`를 지우면 깨진다.
 */
beforeEach(truncateAll)

const mk = (q: string) =>
  insertNode({
    identityScope: 'generic',
    normalizedQuestion: q,
    body: '본문',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

function matchingCall(matchId: string): StructuredCaller {
  return vi.fn(async (args: { model: string }) => {
    if (args.model === MODEL_GATE) {
      return { relevant: true, reason: '', matched_id: matchId, identity_scope: '', normalized_question: '' }
    }
    return { body: '생성되면 안 된다', suggestions: [{ text: 'x' }] }
  }) as unknown as StructuredCaller
}

function creatingCall(question: string): StructuredCaller {
  return vi.fn(async (args: { model: string }) => {
    if (args.model === MODEL_GATE) {
      return { relevant: true, reason: '', matched_id: '', identity_scope: 'generic', normalized_question: question }
    }
    return { body: '새 해설', suggestions: [{ text: '꼬리1' }] }
  }) as unknown as StructuredCaller
}

async function viaOf(): Promise<Array<string | null>> {
  const db = await getDb()
  const rows = await db.query<{ matched_via: string | null }>(
    `select matched_via from expansion_event where verdict = 'accepted' order by created_at asc`,
  )
  return rows.map((r) => r.matched_via)
}

const base = (parent: string, call: StructuredCaller) => ({
  quotaKey: 'anon:via',
  dailyLimit: 5,
  parentNodeId: parent,
  ancestorNodeIds: [parent],
  mode: 'free' as const,
  rawInput: '왜 코어 수 기반?',
  call,
})

describe('matched_via 계측', () => {
  it('게이트 매칭은 gate로 남는다', async () => {
    const parent = await mk('부모?')
    const existing = await mk('이미 있는 질문?')
    await ensureEdge(parent, existing)

    const r = await expand(base(parent, matchingCall(existing)))
    expect(r.kind).toBe('ok')
    expect(await viaOf()).toEqual(['gate'])
  })

  it('새 생성은 via가 비어 있다', async () => {
    const parent = await mk('부모?')
    const r = await expand(base(parent, creatingCall('새 질문은 무엇인가?')))
    expect(r.kind).toBe('ok')
    expect(await viaOf()).toEqual([null])
  })

  /**
   * 같은 문장이 다시 오면 해시 별칭이 잡는다. 게이트가 고른 것과
   * **다른 종류의 적중**이라는 것이 로그에 남아야 한다.
   */
  it('해시 히트는 hash로 남는다', async () => {
    const parent = await mk('부모?')
    await expand(base(parent, creatingCall('같은 질문은 무엇인가?')))

    /* 게이트가 또 같은 문장을 만들지만 이번엔 별칭이 먼저 잡는다 */
    const r = await expand(base(parent, creatingCall('같은 질문은 무엇인가?')))
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('hit')

    const vias = await viaOf()
    expect(vias).toHaveLength(2)
    expect(vias[1]).toBe('hash')
  })

  /**
   * "전체 확장의 대부분"이 이 경로다. 안 남기면 expansion_event로
   * 확장량을 세는 모든 측정이 대부분을 빠뜨린다.
   */
  it('해소된 추천은 suggestion으로 남는다', async () => {
    const parent = await mk('부모?')
    const target = await mk('과녁?')
    await insertSuggestions(parent, ['꼬리?'])

    const db = await getDb()
    const [sug] = await db.query<{ id: string }>(
      `select id from qnode_suggestion where qnode_id = $1`,
      [parent],
    )
    await linkSuggestion(sug.id, target)

    const r = await expand({
      ...base(parent, matchingCall(target)),
      mode: 'suggestion' as const,
      suggestionId: sug.id,
      rawInput: undefined,
    })
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') return
    expect(r.cache).toBe('suggestion_resolved')
    expect(await viaOf()).toEqual(['suggestion'])
  })

  it('조상 점프는 ancestor로 남는다', async () => {
    /*
     * 게이트는 후보에 있는 id만 받는다. 그래서 조상이 **후보이기도 한**
     * 모양이 필요하다 — 순환이 그 모양이다. 이미 지나온 질문(grand)이
     * 현재 노드의 자식으로도 이어져 있으면(TCP → handshake → TCP 같은
     * 되돌이) 후보에 뜨고, 매칭되면 새 간선 대신 점프한다.
     */
    const parent = await mk('부모?')
    const grand = await mk('조상?')
    await ensureEdge(parent, grand)

    const r = await expand({
      ...base(parent, matchingCall(grand)),
      ancestorNodeIds: [grand, parent],
    })
    expect(r.kind).toBe('ancestor_jump')
    expect(await viaOf()).toEqual(['ancestor'])
  })
})
