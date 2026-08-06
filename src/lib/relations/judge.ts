import { z } from 'zod'
import { realCaller, MODEL_GATE, type StructuredCaller } from '@/lib/llm/client'
import type { RelationKind } from '@/lib/db/relations'

/**
 * 두 질문이 관련 있는지 판정한다.
 *
 * 게이트(`lib/llm/gate.ts`)와 다른 물건이다. 게이트는 "같은 질문인가"를 묻고,
 * 틀리면 두 질문이 하나로 합쳐져 되돌리기 어렵다. 이쪽은 "관련 있는가"를 묻고,
 * 틀려도 선 하나가 잘못 그려질 뿐이라 내리면 끝난다. 그래서 기준이 다르다.
 *
 * 이 판정기가 필요한 이유는 실측이다. 꼬리질문이 기존 질문과 **같은** 경우는
 * 5%였다. 같음만 이어서는 249개가 흩어진 점으로 남는다. 관련은 훨씬 흔하다.
 */

/**
 * 판정 버전.
 *
 * v1은 다수결을 전제로 짰다. 같은 조건에서 세 번 재보니 30개 중 5·2·4가 나왔고,
 * 한 번 뽑아 그대로 쓰면 지도가 새로고침마다 달라진다는 뜻이었다. 흔들림을
 * 나중에 고치지 않고 처음부터 회차를 나눠 뽑는다.
 */
export const RELATION_JUDGE_VERSION = 'relation-v1-vote'

const KINDS: RelationKind[] = ['shares_concept', 'prerequisite', 'alternative', 'instance_of']

export type JudgeNode = { id: string; question: string; category: string }

export type JudgedRelation = {
  toId: string
  kind: RelationKind
  reason: string
  /** 몇 회차가 이 관계를 봤는가 */
  votes: number
}

/**
 * 판정자의 자리.
 *
 * "골라라"만 시키면 모델이 관대해진다. 고를 것이 앞에 있으면 무언가는 고르려 든다.
 * 빈 답이 정상이라는 것을 여기서 한 번, 프롬프트에서 또 한 번 말한다.
 */
const SYSTEM = `CS 지식 사이의 관계를 판정한다.

관대하게 잇지 않는다. 이 판정으로 지식 지도의 선이 그려지고, 아무 데나 이어진
지도는 안 이어진 지도보다 나쁘다. 근거를 한 문장으로 못 적으면 관계가 아니다.
빈 답은 정상이다.`

const judgeSchema = z.object({
  relations: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      reason: z.string(),
    }),
  ),
})

/**
 * 판정 프롬프트.
 *
 * 후보를 나열하고 그중 관련 있는 것을 **고르게** 한다. 새로 지어내게 두면
 * 목록에 없는 id가 돌아오고, 그 선은 허공으로 뻗는다.
 *
 * 근거를 반드시 적게 하는 이유는 둘이다. 사람이 검수할 때 읽을 것이 그것뿐이고,
 * 근거를 못 적는 관계는 애초에 관계가 아니다. 근거 칸을 비우면 모델이 "둘 다
 * 컴퓨터 이야기"류로 아무 데나 잇는다.
 */
export function buildJudgePrompt(focus: JudgeNode, candidates: JudgeNode[]): string {
  const list = candidates.map((c) => `- ${c.id} [${c.category}] ${c.question}`).join('\n')

  return `아래 기준 질문과 관련 있는 것을 후보에서 고른다.

기준 질문: [${focus.category}] ${focus.question}

후보:
${list}

관계 종류는 넷 중 하나다.
- shares_concept: 같은 밑바탕 개념을 다룬다. "GC 멈춤"과 "STW는 왜 필요한가"
- prerequisite: 기준 질문을 알아야 후보가 읽힌다. "TCP"와 "3-way handshake"
- alternative: 같은 문제의 다른 선택지. "낙관적 락"과 "비관적 락"
- instance_of: 후보가 기준 질문의 구체적인 사례. "캐시 전략"과 "Redis TTL 설정"

규칙
- 후보 목록에 있는 id만 쓴다. 없는 id를 지어내지 않는다.
- 관계마다 근거를 한 문장으로 적는다. 무엇을 공유하는지 구체적으로 쓴다.
- 근거가 "둘 다 컴퓨터 이야기다" 수준이면 관계가 아니다. 고르지 않는다.
- 카테고리가 달라도 관련 있으면 고른다. 네트워크와 모바일은 자주 이어진다.
- 관련 있는 것이 없으면 빈 목록을 준다. 억지로 채우지 않는다.
- 많아야 다섯 개까지 고른다.

형식: {"relations":[{"id":"...","kind":"...","reason":"..."}]}`
}

export type JudgeDeps = {
  call?: StructuredCaller
  /** 몇 번 뽑을 것인가. 홀수가 낫다 — 짝수면 표가 갈릴 때 정할 수 없다 */
  rounds?: number
}

/**
 * 여러 번 뽑아 다수결을 낸다.
 *
 * 과반이 본 관계만 남긴다. 한 회차만 본 것은 버린다. 흔들림(5/2/4)을 봤기 때문에
 * 한 번 뽑아 그대로 쓰지 않는다.
 *
 * 회차가 터져도 남은 것으로 판정한다. 무료 한도가 마르면 실제로 터진다. 다만
 * **성립한 회차만 분모**로 센다. 세 번 중 한 번이 터졌는데 3을 분모로 두면
 * 통과 기준이 조용히 빡빡해진다.
 */
export async function judgeRelations(
  focus: JudgeNode,
  candidates: JudgeNode[],
  deps: JudgeDeps = {},
): Promise<JudgedRelation[]> {
  const pool = candidates.filter((c) => c.id !== focus.id)
  if (pool.length === 0) return []

  const call = deps.call ?? realCaller
  const rounds = deps.rounds ?? 3
  const prompt = buildJudgePrompt(focus, pool)
  const allowed = new Set(pool.map((c) => c.id))

  // 키는 "어느 후보를 어떤 종류로 이었나". 종류가 갈리면 각자 표를 센다
  const tally = new Map<string, { toId: string; kind: RelationKind; reason: string; n: number }>()
  let done = 0
  let lastError = ''

  /*
   * 회차를 동시에 뽑는다.
   *
   * 회차끼리 서로를 안 본다 — 그게 다수결의 전제다. 차례로 돌리면 판정 하나에
   * 세 번을 기다리고, 249개면 여덟 시간이다. 같은 프롬프트라 캐시가 듣지도 않는다.
   */
  const settled = await Promise.allSettled(
    Array.from({ length: rounds }, () =>
      call({ model: MODEL_GATE, system: SYSTEM, schema: judgeSchema, prompt }),
    ),
  )

  for (const s of settled) {
    if (s.status === 'rejected') {
      // 이 회차는 없던 것으로 친다. 분모에서도 빠진다
      lastError = (s.reason as Error)?.message ?? String(s.reason)
      continue
    }
    const out = s.value
    done += 1

    // 한 회차 안에서 같은 후보를 두 번 말해도 한 표다
    const seen = new Set<string>()
    for (const r of out.relations) {
      if (!allowed.has(r.id)) continue
      if (!KINDS.includes(r.kind as RelationKind)) continue
      const key = `${r.id}::${r.kind}`
      if (seen.has(key)) continue
      seen.add(key)

      const cur = tally.get(key)
      if (cur) cur.n += 1
      else tally.set(key, { toId: r.id, kind: r.kind as RelationKind, reason: r.reason, n: 1 })
    }
  }

  /*
   * 전부 터졌으면 알린다. 빈 목록으로 돌려주면 "관계가 없다"와 구별되지 않는다.
   *
   * 실제로 겪었다. 스크립트가 환경변수를 안 읽어 세 회차가 다 터졌는데 화면에는
   * "관계 0개"로 찍혔다. 조용한 실패를 성공처럼 세는 것이 제일 나쁘다.
   */
  if (done === 0) throw new Error(`판정 ${rounds}회가 모두 실패했다 (${focus.question}): ${lastError}`)
  const need = Math.floor(done / 2) + 1

  const kept = [...tally.values()].filter((t) => t.n >= need)

  /*
   * 같은 후보에 종류가 둘 이상 살아남으면 표가 많은 쪽만 남긴다.
   *
   * 두 종류가 다 과반일 수는 없지만 회차가 짝수일 때 동률이 나올 수 있다.
   * 그때는 KINDS 순서로 정한다 — 아무 쪽이나 고르면 회차마다 달라진다.
   */
  const best = new Map<string, (typeof kept)[number]>()
  for (const t of kept) {
    const cur = best.get(t.toId)
    if (!cur || t.n > cur.n || (t.n === cur.n && KINDS.indexOf(t.kind) < KINDS.indexOf(cur.kind))) {
      best.set(t.toId, t)
    }
  }

  return [...best.values()]
    .sort((a, b) => b.n - a.n || a.toId.localeCompare(b.toId))
    .map((t) => ({ toId: t.toId, kind: t.kind, reason: t.reason, votes: t.n }))
}
