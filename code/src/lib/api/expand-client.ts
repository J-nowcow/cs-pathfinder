export type PublicSuggestion = {
  id: string
  text: string
  /** 이미 노드가 있는 추천. 누르면 LLM 없이 즉시 이동한다 */
  resolved: boolean
}

export type PublicNode = {
  id: string
  /** 사람이 읽는 짧은 번호. 주소와 레포에 이것을 쓴다 */
  number: number
  question: string
  body: string
  identityScope: string
  suggestions: PublicSuggestion[]
}

/**
 * 설계 §7 상태 표를 여기서 결정한다.
 *
 * 컴포넌트가 HTTP 코드를 직접 읽으면 상태 분기가 화면마다 흩어지고
 * 새 에러가 생겼을 때 어디를 고쳐야 하는지 알 수 없게 된다.
 */
export type ExpandResult =
  | { kind: 'ok'; node: PublicNode; cache: string; quota: { used: number; limit: number } }
  | { kind: 'ancestor_jump'; nodeId: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'quota_exceeded' }
  | { kind: 'rate_limited'; retryAfter: number }
  | { kind: 'gate_unavailable'; fallback: PublicSuggestion[] }
  | { kind: 'error'; message: string }

export type ExpandRequest = {
  parentNodeId: string
  ancestorNodeIds: string[]
  mode: 'suggestion' | 'free'
  suggestionId?: string
  rawInput?: string
}

const DEFAULT_RETRY_SECONDS = 3

function newKey(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

type RawSuggestion = { id: string; text: string; resolved: boolean }

function toNode(raw: Record<string, unknown>): PublicNode | null {
  if (typeof raw.id !== 'string' || typeof raw.question !== 'string') return null

  const suggestions = Array.isArray(raw.suggestions) ? (raw.suggestions as RawSuggestion[]) : []

  return {
    id: raw.id,
    /* 서버가 안 실어 주면 0. 화면은 0을 안 보여준다 */
    number: typeof raw.number === 'number' ? raw.number : 0,
    question: raw.question,
    body: typeof raw.body === 'string' ? raw.body : '',
    identityScope: typeof raw.identity_scope === 'string' ? raw.identity_scope : 'generic',
    suggestions: suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      resolved: s.resolved === true,
    })),
  }
}

/**
 * 확장을 요청하고 응답을 화면 상태로 옮긴다.
 *
 * 절대 던지지 않는다. 네트워크 예외까지 error로 삼킨다.
 * 던지면 읽기 뷰가 통째로 죽고 파던 경로가 날아간다.
 */
export async function requestExpand(
  req: ExpandRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ExpandResult> {
  let res: Response
  try {
    res = await fetchImpl('/api/expand', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: newKey(),
        parent_node_id: req.parentNodeId,
        ancestor_node_ids: req.ancestorNodeIds,
        mode: req.mode,
        suggestion_id: req.mode === 'suggestion' ? req.suggestionId : undefined,
        raw_input: req.mode === 'free' ? req.rawInput : undefined,
      }),
    })
  } catch {
    return { kind: 'error', message: '연결이 끊겼어요. 다시 시도해 주세요.' }
  }

  let payload: Record<string, unknown>
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    return { kind: 'error', message: '서버 응답을 읽지 못했어요.' }
  }

  if (res.ok) {
    const jump = payload.ancestor_jump as { node_id?: string } | null
    if (jump && typeof jump.node_id === 'string') {
      return { kind: 'ancestor_jump', nodeId: jump.node_id }
    }

    const node = toNode((payload.node ?? {}) as Record<string, unknown>)
    if (!node) return { kind: 'error', message: '받은 응답이 비어 있어요.' }

    const quota = (payload.quota ?? {}) as { used?: number; limit?: number }
    return {
      kind: 'ok',
      node,
      cache: typeof payload.cache === 'string' ? payload.cache : 'unknown',
      quota: { used: quota.used ?? 0, limit: quota.limit ?? 0 },
    }
  }

  const error = typeof payload.error === 'string' ? payload.error : ''

  switch (res.status) {
    case 400:
      return {
        kind: 'rejected',
        reason: typeof payload.detail === 'string' ? payload.detail : '입력을 다시 확인해 주세요.',
      }

    case 422:
      return {
        kind: 'rejected',
        reason:
          typeof payload.reason === 'string'
            ? payload.reason
            : 'CS 학습 질문으로 보기 어려워요.',
      }

    case 429:
      if (error === 'quota_exceeded') return { kind: 'quota_exceeded' }
      return {
        kind: 'rate_limited',
        retryAfter:
          typeof payload.retry_after === 'number' ? payload.retry_after : DEFAULT_RETRY_SECONDS,
      }

    case 503: {
      const raw = Array.isArray(payload.fallback_suggestions)
        ? (payload.fallback_suggestions as RawSuggestion[])
        : []
      return {
        kind: 'gate_unavailable',
        fallback: raw.map((s) => ({ id: s.id, text: s.text, resolved: s.resolved === true })),
      }
    }

    case 504:
      return { kind: 'error', message: '생성이 오래 걸리네요. 조금 뒤에 다시 해보세요.' }

    default:
      return { kind: 'error', message: '요청을 처리하지 못했어요.' }
  }
}
