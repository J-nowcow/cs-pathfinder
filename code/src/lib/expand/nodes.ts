import { getDb } from '@/lib/db/client'
import { EMBED_DIM, EMBED_TOP_K, EMBED_MIN_SIMILARITY } from '@/lib/embed/model'

export type NewNode = {
  identityScope: string
  normalizedQuestion: string
  body: string
  primaryCategory: string
  status?: 'pending' | 'ready' | 'failed'
  origin: 'batch' | 'on_demand'
}

export async function insertNode(node: NewNode): Promise<string> {
  const db = await getDb()
  const rows = await db.query<{ id: string }>(
    /*
     * `number`를 손으로 적는다. `0011`에서 컬럼 기본값을 뗐기 때문이다 --
     * 기본값은 `on conflict` 경로에서 번호를 태웠다. 여기는 충돌 절이 없어
     * 한 행에 한 번만 돈다.
     */
    `insert into qnode
       (identity_scope, normalized_question, body, primary_category, status, origin, number)
     values ($1, $2, $3, $4, $5, $6, nextval('qnode_number_seq'))
     returning id`,
    [
      node.identityScope,
      node.normalizedQuestion,
      node.body,
      node.primaryCategory,
      node.status ?? 'ready',
      node.origin,
    ],
  )
  return rows[0].id
}

export async function insertSuggestions(qnodeId: string, texts: string[]): Promise<void> {
  if (texts.length === 0) return
  const db = await getDb()
  for (const [position, text] of texts.entries()) {
    await db.query(
      `insert into qnode_suggestion (qnode_id, text, position, target_node_id)
       values ($1, $2, $3, null)
       on conflict (qnode_id, position) do nothing`,
      [qnodeId, text, position],
    )
  }
}

export async function bindAlias(
  normalizerVersion: string,
  hash: string,
  qnodeId: string,
): Promise<void> {
  const db = await getDb()
  await db.query(
    `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
     values ($1, $2, $3)
     on conflict (normalizer_version, normalized_hash) do nothing`,
    [normalizerVersion, hash, qnodeId],
  )
}

/**
 * 캐시 히트에도 간선은 추가한다.
 * 새 부모에서 기존 노드로 처음 닿았다면 그 관계가 저장되어야 한다.
 */
export async function ensureEdge(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) return
  const db = await getDb()
  await db.query(
    `insert into qedge (parent_id, child_id) values ($1, $2)
     on conflict (parent_id, child_id) do nothing`,
    [parentId, childId],
  )
}

export async function resolveSuggestion(
  suggestionId: string,
): Promise<{ text: string; targetNodeId: string | null } | null> {
  const db = await getDb()
  const rows = await db.query<{ text: string; target_node_id: string | null }>(
    'select text, target_node_id from qnode_suggestion where id = $1',
    [suggestionId],
  )
  if (rows.length === 0) return null
  return { text: rows[0].text, targetNodeId: rows[0].target_node_id }
}

/**
 * 꼬리질문과 그것이 실제로 닿은 노드를 잇는다.
 *
 * 이 링크가 있어야 두 번째 클릭이 공짜가 된다. 없으면 이미 판 꼬리를 다시 눌러도
 * 매칭 게이트를 또 태우고, 화면은 어디를 이미 팠는지 표시하지 못한다.
 * `suggestion_resolved` 경로가 통째로 죽어 있던 이유가 이 갱신이 없어서였다.
 *
 * 이미 이어져 있으면 덮지 않는다. 먼저 닿은 노드가 임자다. 덮으면 같은 꼬리가
 * 누를 때마다 다른 곳으로 가고, 미니맵에 그려진 과거 경로와도 어긋난다.
 */
export async function linkSuggestion(suggestionId: string, nodeId: string): Promise<void> {
  const db = await getDb()
  await db.query(
    `update qnode_suggestion set target_node_id = $2
     where id = $1 and target_node_id is null`,
    [suggestionId, nodeId],
  )
}

/**
 * 게이트에 보여줄 후보를 모은다.
 *
 * 부모의 자식이 1순위다. 여기에 조부모의 다른 자식(1-hop)을 더한다.
 * `qedge`가 인접 리스트라 조회 한 번이면 되고, 근처에서 이미 만들어진
 * 같은 개념을 잡을 확률이 올라간다.
 *
 * **구조만 보다가 96.3%가 빈손이었다.** 운영 노드 321개에서 후보 분포를
 * 재보니 309개가 후보 0개였다(`npm run measure:candidates`). `qedge`가
 * 12행이기 때문이다. 시딩이 간선을 안 만들고, 사람이 안 걸어간 자리에는
 * 길이 없다.
 *
 * 게이트 정확도는 튜닝 124/124 · 홀드아웃 60/60이다. **정확한데 일할
 * 기회가 없었다.** 그래서 고칠 곳은 판정기가 아니라 여기다.
 *
 * 그래서 의미 관계를 후보에 더한다. `semantic_relation`은 330행 살아
 * 있었는데 매칭 경로가 그것을 안 보고 있었다.
 *
 * **구조를 앞에 둔다.** 사람이 실제로 걸어간 길이라 더 믿을 만하고,
 * 상한에 걸려 잘릴 때 잘리는 쪽은 의미여야 한다.
 *
 * 상한을 두는 이유는 프롬프트 길이와 판정 정확도 때문이다. 후보 50개까지는
 * 정확도가 유지되는 것을 실측했다(스펙 부록 D). 다만 그 실측은 표본이
 * 7건이라 신뢰구간이 49~97%다. 후보 구성을 바꿨으니 `measure:match`로
 * 다시 본다.
 */
export const MAX_CANDIDATES = 50

/**
 * 표를 둘 이상 받은 관계만 쓴다.
 *
 * 화면이 같은 기준으로 선을 그린다(`db/graph.ts`). 매칭이 더 헐거운 기준을
 * 쓰면 **사용자에게 보이지 않는 관계를 근거로 질문이 합쳐진다.** 왜 합쳐졌는지
 * 화면에서 확인할 길이 없어진다.
 */
const MIN_RELATION_VOTES = 2

export async function collectCandidates(
  parentNodeId: string,
): Promise<Array<{ id: string; question: string }>> {
  const db = await getDb()

  const rows = await db.query<{ id: string; normalized_question: string }>(
    `with siblings as (
       select e.child_id as id, 0 as rank
       from qedge e
       where e.parent_id = $1
     ),
     uncles as (
       select e2.child_id as id, 1 as rank
       from qedge g
       join qedge e2 on e2.parent_id = g.parent_id
       where g.child_id = $1 and e2.child_id <> $1
     ),
     merged as (
       select id, min(rank) as rank from (
         select * from siblings union all select * from uncles
       ) u group by id
     )
     select n.id, n.normalized_question
     from merged m
     join qnode n on n.id = m.id
     where n.status = 'ready' and n.id <> $1
     order by m.rank asc, n.created_at asc
     limit $2`,
    [parentNodeId, MAX_CANDIDATES],
  )

  const out = rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  const seen = new Set(out.map((c) => c.id))

  const add = (more: Array<{ id: string; question: string }>) => {
    for (const c of more) {
      if (out.length >= MAX_CANDIDATES) return
      if (seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
  }

  if (out.length < MAX_CANDIDATES) {
    add(await semanticNeighbors(parentNodeId, MAX_CANDIDATES - out.length))
  }
  if (out.length < MAX_CANDIDATES) {
    add(await vectorNeighbors(parentNodeId, Math.min(EMBED_TOP_K, MAX_CANDIDATES - out.length)))
  }

  return out
}

/**
 * 의미로 이어진 이웃.
 *
 * **질의를 따로 낸다.** 위 CTE에 합치면 왕복이 한 번 줄지만, 표가 없을 때
 * 확장 전체가 죽는다. `semantic_relation`은 `0009`에서 생겼고 그 마이그레이션을
 * 프로덕션에 적용하지 않은 채 배포한 날 화면 전부가 500이 됐다. 지도는 선 없이
 * 그리면 되지만 확장은 이 서비스의 본체다 — **관계가 없으면 관계 없이 판다.**
 *
 * 방향은 양쪽 다 본다. 방향 없는 관계도 행은 하나만 두기 때문이다(`0009` 주석).
 */
async function semanticNeighbors(
  nodeId: string,
  limit: number,
): Promise<Array<{ id: string; question: string }>> {
  if (limit <= 0) return []
  const db = await getDb()

  try {
    const rows = await db.query<{ id: string; normalized_question: string }>(
      `select n.id, n.normalized_question
         from semantic_relation r
         join qnode n
           on n.id = case when r.from_id = $1 then r.to_id else r.from_id end
        where r.active
          and r.votes >= $3
          and (r.from_id = $1 or r.to_id = $1)
          and n.status = 'ready'
          and n.id <> $1
        group by n.id, n.normalized_question, n.created_at
        order by max(r.votes) desc, n.created_at asc
        limit $2`,
      [nodeId, limit, MIN_RELATION_VOTES],
    )
    return rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  } catch (e) {
    if (!isMissingRelationTable(e)) throw e
    console.warn('[expand] semantic_relation이 없다. 구조 후보만 쓴다 — npm run db:migrate')
    return []
  }
}

/**
 * 벡터로 가까운 이웃.
 *
 * **부모의 임베딩을 쓴다. 사용자가 친 문장을 임베딩하지 않는다.**
 * 그래서 이 경로에 모델 호출이 없다 -- 미리 담아 둔 값끼리 견주기만 한다.
 * 임베딩을 밤에 로컬에서 만들 수 있는 것도 이 때문이다.
 *
 * 대가는 정확도다. 사용자가 실제로 무엇을 물었는지가 아니라 "지금 보고 있는
 * 질문 근처"를 가져온다. 게이트가 어차피 후보 중에서 고르는 판정기라
 * 후보는 "이 근처일 법한 것"이면 되지만, 입력 자체로 찾는 것보다는 무디다.
 * 입력으로 찾고 싶어지면 런타임에 같은 모델을 불러야 하고, 그때는 로컬이
 * 성립하지 않는다(`lib/embed/model.ts`).
 *
 * `<=>`는 코사인 **거리**다. 유사도로 쓰려면 뒤집어야 한다.
 */
async function vectorNeighbors(
  nodeId: string,
  limit: number,
): Promise<Array<{ id: string; question: string }>> {
  if (limit <= 0) return []
  const db = await getDb()

  try {
    const rows = await db.query<{ id: string; normalized_question: string }>(
      /*
       * 차원을 문자열로 끼운다. 타입 캐스팅의 괄호 안은 파라미터를 못 받는다.
       * `EMBED_DIM`은 코드 상수(숫자)라 바깥 입력이 닿지 않는다.
       */
      `with me as (
         select embedding::vector(${EMBED_DIM}) as v
           from qnode
          where id = $1 and embedding is not null
       )
       select n.id, n.normalized_question
         from qnode n, me
        where n.status = 'ready'
          and n.id <> $1
          and n.embedding is not null
          and 1 - (n.embedding::vector(${EMBED_DIM}) <=> me.v) >= $3
        order by n.embedding::vector(${EMBED_DIM}) <=> me.v asc, n.created_at asc
        limit $2`,
      [nodeId, limit, EMBED_MIN_SIMILARITY],
    )
    return rows.map((r) => ({ id: r.id, question: r.normalized_question }))
  } catch (e) {
    /*
     * 확장이 없으면 벡터 없이 판다.
     *
     * `0012`를 프로덕션에 적용하지 않은 채 배포하면 여기가 터진다. `0009`를
     * 안 올린 날 화면 전부가 500이 됐던 것과 같은 모양이다. 확장은 덤이고
     * 확장이 본체다 -- 확장(기능)이 확장(extension) 때문에 죽으면 안 된다.
     */
    if (!isVectorUnavailable(e)) throw e
    console.warn('[expand] 벡터 후보를 못 쓴다. 구조·관계 후보만 쓴다 —', String(e).slice(0, 120))
    return []
  }
}

/**
 * 벡터 검색이 "지금 안 되는" 오류인가.
 *
 * 둘을 잡는다.
 * - 확장 없음 — `42704 undefined_object` / `42883 undefined_function`.
 *   `0012`를 프로덕션에 안 올린 채 배포한 경우다
 * - **차원 불일치** — "expected N dimensions, not M". 모델을 갈아탈 때
 *   코드(새 차원)와 DB(옛 벡터)가 잠깐 어긋난다. bge-m3(1024) →
 *   gemini(768) 전환에서 실제로 지나는 창이다. 이걸 안 잡으면 그 창
 *   동안 확장 전체가 500이다 — 벡터는 덤이고 확장이 본체다
 */
function isVectorUnavailable(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code
  if (code === '42704' || code === '42883') return true
  const msg = e instanceof Error ? e.message : String(e)
  return /type "vector" does not exist|operator does not exist.*<=>|dimensions/i.test(msg)
}

/** Postgres `42P01 undefined_table`. PGlite도 같은 코드를 준다 */
function isMissingRelationTable(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code
  if (code === '42P01') return true
  const msg = e instanceof Error ? e.message : String(e)
  return /relation .*semantic_relation.* does not exist/i.test(msg)
}

/**
 * 등가 관계를 기록한다.
 *
 * 노드를 물리적으로 합치지 않는다. 잘못 이었으면 active만 내리면 되고
 * occurrence는 원래 노드를 계속 붙들고 있어서 되돌릴 것이 없다.
 */
export async function linkEquivalent(
  a: string,
  b: string,
  decidedBy: 'gate' | 'human',
  decisionId?: string,
): Promise<void> {
  if (a === b) return
  const [lo, hi] = a < b ? [a, b] : [b, a]
  const db = await getDb()
  await db.query(
    `insert into qnode_equivalence (node_a, node_b, decided_by, decision_id)
     values ($1, $2, $3, $4)
     on conflict (node_a, node_b) do nothing`,
    [lo, hi, decidedBy, decisionId ?? null],
  )
}

export async function recordEvent(args: {
  parentNodeId: string | null
  rawInput: string
  verdict: 'accepted' | 'rejected' | 'error'
  rejectReason?: string
  resultingNodeId?: string
  candidateIds?: string[]
  matchedNodeId?: string
  gateVersion?: string
}): Promise<string> {
  const db = await getDb()
  const rows = await db.query<{ id: string }>(
    `insert into expansion_event
       (parent_qnode_id, raw_input, verdict, reject_reason, resulting_qnode_id,
        candidate_ids, matched_node_id, gate_version)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      args.parentNodeId,
      args.rawInput,
      args.verdict,
      args.rejectReason ?? null,
      args.resultingNodeId ?? null,
      args.candidateIds ?? null,
      args.matchedNodeId ?? null,
      args.gateVersion ?? null,
    ],
  )
  return rows[0].id
}
