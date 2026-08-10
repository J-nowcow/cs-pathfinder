import { getDb } from '@/lib/db/client'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import { relatedForDisplay, type RelatedNode } from '@/lib/expand/nodes'

export type CachedSuggestion = {
  id: string
  text: string
  targetNodeId: string | null
}

export type CachedNode = {
  id: string
  /** 사람이 읽는 짧은 번호. 주소와 레포에 이것을 쓴다 */
  number: number
  question: string
  body: string
  identityScope: string
  primaryCategory: string
  /** data/tags.ts 통제 어휘 안. 무태그면 빈 배열 */
  tags: string[]
  /** data/levels.ts 3단. 미판정이면 null */
  level: string | null
  suggestions: CachedSuggestion[]
  /**
   * "이거 봤으면 이것도". **부른 쪽이 달라고 해야 담긴다**(`withRelated`).
   * 안 달라고 했으면 `undefined`다 — 빈 배열과 다르다. 빈 배열은 "찾아봤는데
   * 없다"이고 `undefined`는 "안 찾아봤다"이며, 화면이 그 둘을 구별해야
   * 뒤늦게 채울지 말지를 정할 수 있다.
   */
  related?: RelatedNode[]
}

type NodeRow = {
  id: string
  number: number
  normalized_question: string
  body: string
  identity_scope: string
  primary_category: string
  tags: string[] | null
  level: string | null
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
/**
 * 주소에 온 것이 UUID인가 번호인가.
 *
 * `/q/42`와 `/q/5d9cb401-…` 둘 다 받는다. 번호는 짧아서 레포와 이슈에 적기
 * 좋고, UUID는 **이미 공유된 링크가 쓰고 있어 깨면 안 된다.**
 *
 * 숫자만으로 이루어졌으면 번호다. UUID에는 하이픈과 글자가 섞여 있어 겹치지
 * 않는다.
 */
function isNumber(key: string): boolean {
  return /^[1-9][0-9]{0,8}$/.test(key)
}

/**
 * UUID 모양인가.
 *
 * **모양을 안 보고 질의에 넣으면 500이 난다.** `/q/없는것`으로 들어오면
 * Postgres가 `invalid input syntax for type uuid`를 던지고, 그건 없는 주소가
 * 아니라 **서버가 고장 난 것**으로 보인다. 크롤러와 오래된 링크가 온갖 것을
 * 들고 오는 자리라 반드시 걸러야 한다.
 */
function isUuid(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)
}

/**
 * @param opts.withRelated 관련 질문까지 담을지. **기본은 담지 않는다.**
 *
 * 이 함수는 확장 경로에서만 여러 번 돈다(`expand/index.ts`가 다섯 자리에서
 * 부른다). 관련 질문은 화면 아래 목록에만 쓰이는데 기본으로 담으면 그 다섯
 * 자리와 카카오 스킬이 전부 쓰지도 않을 질의를 하나씩 더 낸다. 필요한 쪽이
 * 달라고 하게 둔다.
 */
export async function loadNode(
  nodeId: string,
  opts: { withRelated?: boolean } = {},
): Promise<CachedNode | null> {
  /* 번호도 UUID도 아니면 찾을 것이 없다. 질의에 넣으면 500이 난다 */
  if (!isNumber(nodeId) && !isUuid(nodeId)) return null

  const db = await getDb()

  const nodes = isNumber(nodeId)
    ? await db.query<NodeRow>(
        `select id, number, normalized_question, body, identity_scope, primary_category, tags, level
         from qnode where number = $1 and status = 'ready'`,
        [Number(nodeId)],
      )
    : await db.query<NodeRow>(
        `select id, number, normalized_question, body, identity_scope, primary_category, tags, level
         from qnode where id = $1 and status = 'ready'`,
        [nodeId],
      )
  if (nodes.length === 0) return null

  const n = nodes[0]

  /* 꼬리질문은 UUID로 걸려 있다. 주소가 번호였어도 여기서는 찾은 노드의 id를 쓴다 */
  const suggestions = await db.query<SuggestionRow>(
    `select id, text, target_node_id from qnode_suggestion
     where qnode_id = $1 order by position asc`,
    [n.id],
  )

  /* 관련 질문도 찾은 노드의 id로 찾는다. 관계 표는 번호를 모른다 */
  const related = opts.withRelated ? await relatedForDisplay(n.id) : undefined

  return {
    id: n.id,
    number: n.number,
    question: n.normalized_question,
    body: n.body,
    identityScope: n.identity_scope,
    primaryCategory: n.primary_category,
    tags: n.tags ?? [],
    level: n.level,
    suggestions: suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      targetNodeId: s.target_node_id,
    })),
    related,
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
