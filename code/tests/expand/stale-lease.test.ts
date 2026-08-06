import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { expand } from '@/lib/expand'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { completeLease, acquireLease } from '@/lib/expand/singleflight'
import { MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'

/**
 * 노드가 사라진 캐시.
 *
 * 생성 리스는 "이 해시는 이미 만들었다(done)"를 들고 있는데 그 노드가 지워질 수
 * 있다. 재발행이 `delete from qnode`를 하고 `purge-stubs`·`dedupe-roots`도 지운다.
 *
 * 원래는 그때 예약을 반납한 채 생성 구간으로 흘러들었다. 예약 없이 LLM을 태우고,
 * 리스를 잡은 적 없는데 `completeLease`가 남의 job을 덮고, 생성이 실패하면
 * `failLease`가 정상으로 캐시된 done job을 failed로 바꿔 그 해시를 기다리던
 * 사람 전원이 캐시를 잃었다.
 */
const QUOTA_KEY = 'anon:stale-lease'
const SCOPE = 'generic'
const QUESTION = '커널 바이패스는 무엇을 건너뛰는가?'

/** 게이트는 새 질문으로 판정하고, 생성기는 짧은 본문을 준다. 모델로 가른다 */
const call: StructuredCaller = (async (args: { model: string }) => {
  if (args.model === MODEL_GATE) {
    return {
      relevant: true,
      reason: '',
      matched_id: '',
      identity_scope: SCOPE,
      normalized_question: QUESTION,
    }
  }
  return { body: '커널을 건너뛰고 NIC에서 바로 읽는다.', suggestions: ['a?', 'b?', 'c?', 'd?', 'e?'].map((text) => ({ text })) }
}) as unknown as StructuredCaller

async function parent() {
  return insertNode({
    identityScope: SCOPE,
    normalizedQuestion: '네트워크 지연은 어디서 생기는가?',
    body: '해설',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'batch',
  })
}

async function quotaLeft(): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ reserved: number; used: number }>(
    `select reserved, used from usage_quota where key = $1`,
    [QUOTA_KEY],
  )
  return (rows[0]?.reserved ?? 0) + (rows[0]?.used ?? 0)
}

describe('죽은 리스', () => {
  beforeEach(truncateAll)

  /*
   * done인데 노드가 없으면 새로 만들어 준다. 사용자에게는 그냥 되는 것이어야 한다.
   */
  it('recovers when the cached node is gone', async () => {
    const parentId = await parent()
    const hash = questionHash(SCOPE, QUESTION)

    // 리스는 done인데 가리키는 노드는 없는 상태를 만든다
    const ghost = await insertNode({
      identityScope: SCOPE,
      normalizedQuestion: QUESTION,
      body: '지워질 해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await acquireLease(hash)
    await completeLease(hash, ghost)
    const db = await getDb()
    await db.query('delete from qnode where id = $1', [ghost])

    const out = await expand({
      parentNodeId: parentId,
      ancestorNodeIds: [],
      mode: 'free',
      rawInput: QUESTION,
      quotaKey: QUOTA_KEY,
      dailyLimit: 5,
      call,
    })

    expect(out.kind).toBe('ok')
  })

  /*
   * 예약 회계는 시험으로 못 묶었다.
   *
   * 감사는 "자기 예약을 먼저 반납하면 commitQuota의 감산이 남의 예약을 깎는다"고
   * 지적했고 코드를 읽으면 그럴듯하다. 그런데 옆 예약을 미리 깔고 버그 판을
   * 되돌려 돌려봐도 예약 수가 갈리지 않았다 — 두 번 시도했고 둘 다 통과했다.
   *
   * 통과하는 시험을 근거로 삼을 수는 없다. 커버리지가 있다고 주장하는 시험은
   * 없는 것보다 나쁘다. 그래서 뺐다. 아래 둘은 실제로 동작을 확인한다.
   */

  /* 만들었으면 한도를 한 건 썼어야 한다. 0이면 공짜로 태운 것이다 */
  it('charges the quota for the node it generated', async () => {
    const parentId = await parent()
    const hash = questionHash(SCOPE, QUESTION)

    const ghost = await insertNode({
      identityScope: SCOPE,
      normalizedQuestion: QUESTION,
      body: '지워질 해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await acquireLease(hash)
    await completeLease(hash, ghost)
    const db = await getDb()
    await db.query('delete from qnode where id = $1', [ghost])

    await expand({
      parentNodeId: parentId,
      ancestorNodeIds: [],
      mode: 'free',
      rawInput: QUESTION,
      quotaKey: QUOTA_KEY,
      dailyLimit: 5,
      call,
    })

    // 만들었으면 한 건을 썼어야 한다. 0이면 공짜로 태운 것이다
    expect(await quotaLeft()).toBe(1)
  })

  /* 별칭도 새 노드를 가리켜야 한다. 안 그러면 다음 사람이 또 만든다 */
  it('rebinds the alias to the new node', async () => {
    const parentId = await parent()
    const hash = questionHash(SCOPE, QUESTION)

    const ghost = await insertNode({
      identityScope: SCOPE,
      normalizedQuestion: QUESTION,
      body: '지워질 해설',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await acquireLease(hash)
    await completeLease(hash, ghost)
    const db = await getDb()
    await db.query('delete from qnode where id = $1', [ghost])

    const out = await expand({
      parentNodeId: parentId,
      ancestorNodeIds: [],
      mode: 'free',
      rawInput: QUESTION,
      quotaKey: QUOTA_KEY,
      dailyLimit: 5,
      call,
    })
    if (out.kind !== 'ok') throw new Error(`ok가 아니다: ${out.kind}`)

    const rows = await db.query<{ qnode_id: string }>(
      `select qnode_id from qnode_alias where normalizer_version = $1 and normalized_hash = $2`,
      [NORMALIZER_VERSION, hash],
    )
    expect(rows[0]?.qnode_id).toBe(out.node.id)
  })
})
