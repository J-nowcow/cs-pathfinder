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

export async function recordEvent(args: {
  parentNodeId: string | null
  rawInput: string
  verdict: 'accepted' | 'rejected' | 'error'
  rejectReason?: string
  resultingNodeId?: string
}): Promise<void> {
  const db = await getDb()
  await db.query(
    `insert into expansion_event
       (parent_qnode_id, raw_input, verdict, reject_reason, resulting_qnode_id)
     values ($1, $2, $3, $4, $5)`,
    [
      args.parentNodeId,
      args.rawInput,
      args.verdict,
      args.rejectReason ?? null,
      args.resultingNodeId ?? null,
    ],
  )
}
