import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { expand } from '@/lib/expand'
import { questionHash } from '@/lib/expand/hash'
import { acquireLease } from '@/lib/expand/singleflight'
import { MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'

/**
 * 예약은 출구마다 정확히 한 번 정산돼야 한다.
 *
 * `expand`는 예약을 하나 잡고 나서 여덟 갈래로 나간다. 어느 갈래로 나가든
 * 그 예약은 **반납되거나 사용으로 확정되거나** 둘 중 하나여야 한다. 한 번도
 * 안 하면 그 자리가 영영 잠겨 그날 한도가 줄고, 두 번 하면 옆 요청의 예약을
 * 대신 깎아 한도가 샌다.
 *
 * 이 시험이 필요한 이유는 `quota-release-commit.test.ts`가 알려준다. 그쪽은
 * SQL이 샌다는 사실만 고정할 뿐 누가 `release → commit` 조합을 다시 넣는 것은
 * 못 막는다. **진짜 방어선은 여기다.**
 *
 * 재는 것은 `reserved`다. 정산이 끝났으면 0이어야 한다 — 반납했으면 0으로
 * 내려가고, 확정했으면 `used`로 옮겨간다. 0이 아니면 자리가 잠긴 것이다.
 *
 * **경고: 이 시험이 회귀를 잡는지 확인하지 못했다.**
 *
 * 생성 실패 경로의 `releaseQuota`를 지우고 돌려봤는데 `reserved`가 그대로 0이
 * 나왔다. 예약은 분명 잡혔고(`ok` 경로에서 used 1로 확인), 반납하는 줄은
 * 지웠는데도 그렇다. 어디서 대신 반납되는지 못 찾았다.
 *
 * 그래서 지금 이 파일의 지위는 **특성화**다 — 여섯 출구의 현재 동작을 고정할
 * 뿐, 반납을 빠뜨렸을 때 빨간불이 켜진다고 보장하지 못한다. 오늘 같은 착각을
 * 세 번 했고 세 번 다 남이 잡았다. 확인 못 한 것을 확인한 척하지 않는다.
 *
 * 남은 숙제: 반납이 어디서 한 번 더 일어나는지 찾을 것. 찾으면 그 자리가
 * 이중 반납이라 `quota-release-commit.test.ts`가 기록한 누수의 실제 발생
 * 지점일 수도 있다.
 */
const KEY = 'anon:settle'
const LIMIT = 5
const SCOPE = 'generic'
const NEW_Q = '커널 바이패스는 무엇을 건너뛰는가?'

function caller(over: { reject?: string; fail?: boolean } = {}): StructuredCaller {
  return (async (args: { model: string; prompt: string }) => {
    if (args.model === MODEL_GATE) {
      if (over.reject) return { relevant: false, reason: over.reject, matched_id: '', identity_scope: '', normalized_question: '' }

      /*
       * 입력을 그대로 정규화 질문으로 되돌린다.
       *
       * 고정값을 주면 다른 입력이 같은 해시가 되어 별칭 캐시에 걸린다. 캐시
       * 적중은 예약을 잡기 전에 나가므로 한도 시험이 성립하지 않는다 —
       * 실제로 `quota_exceeded`를 기대한 자리에서 `ok`가 나왔다.
       */
      const asked = args.prompt.split('\n').find((l) => l.startsWith('사용자 입력: '))
      return {
        relevant: true,
        reason: '',
        matched_id: '',
        identity_scope: SCOPE,
        normalized_question: asked ? asked.slice('사용자 입력: '.length).trim() : NEW_Q,
      }
    }
    if (over.fail) throw new Error('생성 실패')
    return { body: '커널을 건너뛴다.', suggestions: ['a?', 'b?', 'c?', 'd?', 'e?'].map((text) => ({ text })) }
  }) as unknown as StructuredCaller
}

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

async function settled(): Promise<{ reserved: number; used: number }> {
  const db = await getDb()
  const [row] = await db.query<{ reserved: number; used: number }>(
    `select reserved, used from usage_quota where key = $1`,
    [KEY],
  )
  return row ?? { reserved: 0, used: 0 }
}

const run = (parentNodeId: string, call: StructuredCaller) =>
  expand({ parentNodeId, ancestorNodeIds: [], mode: 'free', rawInput: NEW_Q, quotaKey: KEY, dailyLimit: LIMIT, call })

describe('출구별 예약 정산', () => {
  beforeEach(truncateAll)

  /* 만들었으면 사용으로 확정된다. 예약 자리는 비어야 한다 */
  it('settles into used on ok', async () => {
    const out = await run(await parent(), caller())
    expect(out.kind).toBe('ok')
    expect(await settled()).toEqual({ reserved: 0, used: 1 })
  })

  /*
   * 거절은 예약 전이다. 아무것도 안 남아야 한다.
   *
   * 여기서 예약이 잡혔다가 안 풀리면, 멀쩡한 질문을 거절당한 사람이 한도까지
   * 잃는다. 사용자가 겪는 실패 중 가장 나쁜 조합이다.
   */
  it('leaves nothing behind on rejected', async () => {
    const out = await run(await parent(), caller({ reject: 'CS 학습 질문으로 보기 어려워요.' }))
    expect(out.kind).toBe('rejected')
    expect(await settled()).toEqual({ reserved: 0, used: 0 })
  })

  /* 생성이 터져도 예약은 반납된다. 안 그러면 실패할수록 한도가 줄어든다 */
  it('gives the reservation back when generation throws', async () => {
    const out = await run(await parent(), caller({ fail: true }))
    expect(out.kind).toBe('generation_failed')
    expect(await settled()).toMatchObject({ reserved: 0 })
  })

  /* 남이 만드는 중이면 기다리라고만 하고 예약은 돌려준다 */
  it('gives the reservation back on busy', async () => {
    const parentId = await parent()
    // 다른 요청이 리스를 잡고 있는 상태로 만든다
    await acquireLease(questionHash(SCOPE, NEW_Q))

    const out = await run(parentId, caller())
    expect(out.kind).toBe('busy')
    expect(await settled()).toEqual({ reserved: 0, used: 0 })
  })

  /*
   * 한도를 넘으면 예약을 못 잡는다. 거부 자체가 자리를 먹으면 안 된다.
   *
   * 한도 1로 한 번 쓰고 다시 부른다. 두 번째는 quota_exceeded이고 그때
   * used는 1 그대로여야 한다 — 거부가 사용으로 세어지면 한도가 반으로 준다.
   */
  it('does not consume anything when the limit is already reached', async () => {
    const parentId = await parent()
    await expand({
      parentNodeId: parentId, ancestorNodeIds: [], mode: 'free',
      rawInput: NEW_Q, quotaKey: KEY, dailyLimit: 1, call: caller(),
    })

    const out = await expand({
      parentNodeId: parentId, ancestorNodeIds: [], mode: 'free',
      rawInput: '스레드 풀은 무엇을 아끼는가?', quotaKey: KEY, dailyLimit: 1, call: caller(),
    })

    expect(out.kind).toBe('quota_exceeded')
    expect(await settled()).toEqual({ reserved: 0, used: 1 })
  })

  /* 부모가 없으면 예약 자체를 안 잡는다. 행이 생기지도 않아야 한다 */
  it('never reserves when the parent is missing', async () => {
    const out = await expand({
      parentNodeId: '00000000-0000-0000-0000-000000000000',
      ancestorNodeIds: [], mode: 'free', rawInput: NEW_Q,
      quotaKey: KEY, dailyLimit: LIMIT, call: caller(),
    })
    expect(out.kind).toBe('not_found')
    expect(await settled()).toEqual({ reserved: 0, used: 0 })
  })
})
