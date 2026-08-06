import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { expand } from '@/lib/expand'
import { insertNode, insertSuggestions } from '@/lib/expand/nodes'
import type { StructuredCaller } from '@/lib/llm/client'
import { MODEL_GATE, MODEL_GENERATE } from '@/lib/llm/client'

/**
 * 꼬리질문 ↔ 결과 노드 연결.
 *
 * `suggestion_resolved` 빠른 경로가 통째로 죽어 있었다. 코드는 target_node_id를
 * 읽어 LLM 없이 즉시 이동하고, 화면은 그 값으로 이미 판 꼬리에 점을 켠다.
 * 그런데 그 값을 채우는 곳이 어디에도 없었다.
 *
 * 세 가지가 걸린다. 이미 판 꼬리를 다시 눌러도 매칭 게이트를 또 태우고(비용),
 * 즉시 이동해야 할 것을 다시 기다리고(속도), 어디를 팠는지 화면에 안 보인다.
 */

const QUOTA = { quotaKey: 'test:link', dailyLimit: 100 }

/** 게이트는 매칭 없음, 생성은 고정 본문. 링크가 목적이라 내용은 중요하지 않다 */
const caller: StructuredCaller = async <T,>({ model }: { model: string }) => {
  if (model === MODEL_GATE) {
    return {
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: 'network',
      normalized_question: '핸드셰이크는 어떤 과정인가?',
    } as T
  }
  if (model === MODEL_GENERATE) {
    return {
      body: '세 단계로 이뤄진다.',
      suggestions: [{ text: '왜 세 번인가?' }],
    } as T
  }
  throw new Error(`unexpected model: ${model}`)
}

async function parentWithSuggestion(): Promise<{ parentId: string; suggestionId: string }> {
  const parentId = await insertNode({
    identityScope: 'network',
    normalizedQuestion: 'TCP 연결은 어떻게 맺는가?',
    body: '해설',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })
  await insertSuggestions(parentId, ['핸드셰이크는 어떤 과정인가?'])

  const rows = await (await getDb()).query<{ id: string }>(
    'select id from qnode_suggestion where qnode_id = $1',
    [parentId],
  )
  return { parentId, suggestionId: rows[0].id }
}

async function targetOf(suggestionId: string): Promise<string | null> {
  const rows = await (await getDb()).query<{ target_node_id: string | null }>(
    'select target_node_id from qnode_suggestion where id = $1',
    [suggestionId],
  )
  return rows[0]?.target_node_id ?? null
}

describe('suggestion → node link', () => {
  beforeEach(truncateAll)

  it('links after generating a new node', async () => {
    const { parentId, suggestionId } = await parentWithSuggestion()
    expect(await targetOf(suggestionId)).toBeNull()

    const out = await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'suggestion',
      suggestionId,
      call: caller,
    })

    expect(out.kind).toBe('ok')
    if (out.kind !== 'ok') return
    expect(await targetOf(suggestionId)).toBe(out.node.id)
  })

  /**
   * 두 번째 클릭이 공짜여야 한다. 여기가 이 수정의 목적이다.
   * LLM을 아예 안 부르는지 호출자를 갈아끼워 확인한다.
   */
  it('takes the free path on the second click', async () => {
    const { parentId, suggestionId } = await parentWithSuggestion()

    const first = await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'suggestion',
      suggestionId,
      call: caller,
    })
    expect(first.kind).toBe('ok')
    if (first.kind !== 'ok') return
    expect(first.cache).toBe('miss')

    // 두 번째에는 부르면 터지는 호출자를 준다
    const explode: StructuredCaller = async () => {
      throw new Error('두 번째 클릭은 LLM을 태우면 안 된다')
    }

    const second = await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'suggestion',
      suggestionId,
      call: explode,
    })

    expect(second.kind).toBe('ok')
    if (second.kind !== 'ok') return
    expect(second.cache).toBe('suggestion_resolved')
    expect(second.node.id).toBe(first.node.id)
  })

  /**
   * 먼저 닿은 노드가 임자다. 덮으면 같은 꼬리가 누를 때마다 다른 곳으로 가고
   * 미니맵에 그려진 과거 경로와 어긋난다.
   */
  it('does not overwrite an existing link', async () => {
    const { parentId, suggestionId } = await parentWithSuggestion()

    const other = await insertNode({
      identityScope: 'network',
      normalizedQuestion: '먼저 이어진 노드는?',
      body: '해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await (await getDb()).query(
      'update qnode_suggestion set target_node_id = $2 where id = $1',
      [suggestionId, other],
    )

    await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'suggestion',
      suggestionId,
      call: caller,
    })

    expect(await targetOf(suggestionId)).toBe(other)
  })

  /** 자유 입력에는 이을 꼬리질문이 없다. 조용히 넘어가야 한다 */
  it('does nothing for free-text input', async () => {
    const { parentId, suggestionId } = await parentWithSuggestion()

    const out = await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'free',
      rawInput: '핸드셰이크는 어떤 과정인가?',
      call: caller,
    })

    expect(out.kind).toBe('ok')
    expect(await targetOf(suggestionId)).toBeNull()
  })

  /** 거절이나 실패로 끝났으면 이을 노드가 없다 */
  it('does not link when the gate rejects', async () => {
    const { parentId, suggestionId } = await parentWithSuggestion()

    const reject: StructuredCaller = async <T,>() =>
      ({
        relevant: false,
        reason: 'CS 학습 질문으로 보기 어려워요.',
        matched_id: '',
        identity_scope: '',
        normalized_question: '',
      }) as T

    const out = await expand({
      ...QUOTA,
      parentNodeId: parentId,
      ancestorNodeIds: [parentId],
      mode: 'suggestion',
      suggestionId,
      call: reject,
    })

    expect(out.kind).toBe('rejected')
    expect(await targetOf(suggestionId)).toBeNull()
  })
})
