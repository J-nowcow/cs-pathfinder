export type PublicSuggestion = {
  id: string
  text: string
  /** 이미 노드가 있는 추천. 누르면 LLM 없이 즉시 이동한다 */
  resolved: boolean
}

/** "이거 봤으면 이것도" 한 줄. `/api/node/[id]`만 실어 준다 */
export type PublicRelated = {
  id: string
  /** 주소가 되는 번호. `/q/{number}`로 간다 */
  number: number
  question: string
  category: string
  /** 왜 이어졌는지. 벡터로 데려온 것은 null */
  reason: string | null
}

export type PublicNode = {
  id: string
  /** 사람이 읽는 짧은 번호. 주소와 레포에 이것을 쓴다 */
  number: number
  question: string
  body: string
  identityScope: string
  /** 통제 어휘 태그. 서버가 안 실어 주면 빈 배열 */
  tags: string[]
  /** 난이도 3단. 미판정·미수신이면 null */
  level: string | null
  suggestions: PublicSuggestion[]
  /**
   * 관련 질문. **`undefined`와 `[]`가 다르다.**
   *
   * 확장 응답(`/api/expand`)은 이것을 안 싣는다 — 방금 만든 노드라 관계도
   * 임베딩도 아직 없고, 35초짜리 응답을 목록 때문에 더 늦출 이유도 없다.
   * 그래서 `undefined`는 "아직 안 물어봤다"는 뜻이고, 화면이 그때 따로
   * 물어본다. `[]`는 "물어봤는데 없다"라 더 할 일이 없다.
   */
  related?: PublicRelated[]
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

/**
 * 관련 질문 목록을 받아 화면이 쓸 모양으로 옮긴다.
 *
 * 배열이 아니면 `undefined`다 — "안 실려 왔다"와 "비어 있다"를 구별해야
 * 화면이 뒤늦게 채울지 말지를 정할 수 있다.
 *
 * **번호가 없는 줄은 버린다.** 목록의 링크가 `/q/{번호}`라 번호 없이는
 * 그릴 수 없다. 서버도 같은 조건으로 거르지만(`expand/nodes.ts`) 화면이
 * 그것을 믿고 `/q/undefined`를 만들 이유는 없다.
 */
export function parseRelated(raw: unknown): PublicRelated[] | undefined {
  if (!Array.isArray(raw)) return undefined

  return raw.flatMap((r: Record<string, unknown>) => {
    if (typeof r?.id !== 'string' || typeof r.question !== 'string') return []
    if (typeof r.number !== 'number' || r.number <= 0) return []
    return [
      {
        id: r.id,
        number: r.number,
        question: r.question,
        category: typeof r.category === 'string' ? r.category : '',
        reason: typeof r.reason === 'string' && r.reason.length > 0 ? r.reason : null,
      },
    ]
  })
}

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
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]).filter((t) => typeof t === 'string') : [],
    level: typeof raw.level === 'string' ? raw.level : null,
    suggestions: suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      resolved: s.resolved === true,
    })),
    /* 확장 응답에는 없다. 그러면 undefined로 남고 화면이 따로 물어본다 */
    related: parseRelated(raw.related),
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
    return { kind: 'error', message: '연결이 끊겼습니다. 다시 시도해 주세요.' }
  }

  let payload: Record<string, unknown>
  try {
    payload = (await res.json()) as Record<string, unknown>
  } catch {
    return { kind: 'error', message: '서버 응답을 읽지 못했습니다.' }
  }

  if (res.ok) {
    const jump = payload.ancestor_jump as { node_id?: string } | null
    if (jump && typeof jump.node_id === 'string') {
      return { kind: 'ancestor_jump', nodeId: jump.node_id }
    }

    const node = toNode((payload.node ?? {}) as Record<string, unknown>)
    if (!node) return { kind: 'error', message: '받은 응답이 비어 있습니다.' }

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
      return { kind: 'error', message: '생성이 오래 걸리고 있습니다. 조금 뒤에 다시 시도해 주세요.' }

    default:
      return { kind: 'error', message: '요청을 처리하지 못했습니다.' }
  }
}
