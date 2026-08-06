import { getDb } from '@/lib/db/client'

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
    `insert into qnode
       (identity_scope, normalized_question, body, primary_category, status, origin)
     values ($1, $2, $3, $4, $5, $6)
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
 * 전역 재사용까지는 못 간다. 그건 임베딩 검색을 켤 때의 일이다(스펙 §5).
 *
 * 상한을 두는 이유는 프롬프트 길이와 판정 정확도 때문이다. 후보 50개까지는
 * 정확도가 유지되는 것을 실측했다(스펙 부록 D).
 */
export const MAX_CANDIDATES = 50

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

  return rows.map((r) => ({ id: r.id, question: r.normalized_question }))
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
