import { getDb } from '@/lib/db/client'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'

export type CachedSuggestion = {
  id: string
  text: string
  targetNodeId: string | null
}

export type CachedNode = {
  id: string
  question: string
  body: string
  identityScope: string
  primaryCategory: string
  suggestions: CachedSuggestion[]
}

type NodeRow = {
  id: string
  normalized_question: string
  body: string
  identity_scope: string
  primary_category: string
}

type SuggestionRow = {
  id: string
  text: string
  target_node_id: string | null
}

/**
 * status='ready'만 반환한다.
 * 생성 중이거나 실패한 노드가 캐시 히트로 노출되면 빈 해설이 사용자에게 간다.
 */
export async function loadNode(nodeId: string): Promise<CachedNode | null> {
  const db = await getDb()

  const nodes = await db.query<NodeRow>(
    `select id, normalized_question, body, identity_scope, primary_category
     from qnode where id = $1 and status = 'ready'`,
    [nodeId],
  )
  if (nodes.length === 0) return null

  const suggestions = await db.query<SuggestionRow>(
    `select id, text, target_node_id from qnode_suggestion
     where qnode_id = $1 order by position asc`,
    [nodeId],
  )

  const n = nodes[0]
  return {
    id: n.id,
    question: n.normalized_question,
    body: n.body,
    identityScope: n.identity_scope,
    primaryCategory: n.primary_category,
    suggestions: suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      targetNodeId: s.target_node_id,
    })),
  }
}

export async function lookupByHash(hash: string): Promise<CachedNode | null> {
  const db = await getDb()

  const rows = await db.query<{ qnode_id: string }>(
    `select qnode_id from qnode_alias
     where normalizer_version = $1 and normalized_hash = $2`,
    [NORMALIZER_VERSION, hash],
  )
  if (rows.length === 0) return null

  return loadNode(rows[0].qnode_id)
}
