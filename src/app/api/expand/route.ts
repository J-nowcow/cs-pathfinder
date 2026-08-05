import { z } from 'zod'
import { expand } from '@/lib/expand'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { resolveCaller } from '@/lib/llm/resolve'

const bodySchema = z.object({
  idempotency_key: z.string().min(1),
  parent_node_id: z.string().uuid(),
  ancestor_node_ids: z.array(z.string().uuid()).default([]),
  mode: z.enum(['suggestion', 'free']),
  suggestion_id: z.string().uuid().optional(),
  raw_input: z.string().optional(),
})

const ANON_DAILY_LIMIT = Number(process.env.QUOTA_ANON_DAILY ?? 5)
const BUSY_RETRY_SECONDS = 3

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

/**
 * 익명 사용자 식별 키.
 *
 * 계획 3에서 인증이 붙으면 검증된 세션 UID를 우선한다.
 * 요청 body의 사용자 식별자는 절대 신뢰하지 않는다.
 */
function quotaKeyFrom(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return `anon:${ip}`
}

export async function POST(request: Request): Promise<Response> {
  // PGlite가 인메모리라 프로세스가 뜰 때마다 DB가 비어 있다.
  await ensureSeeded()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'invalid_input', detail: 'JSON 본문을 읽을 수 없습니다.' }, 400)
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'invalid_input', detail: parsed.error.issues[0]?.message ?? '' }, 400)
  }

  const body = parsed.data

  const outcome = await expand({
    quotaKey: quotaKeyFrom(request),
    dailyLimit: ANON_DAILY_LIMIT,
    parentNodeId: body.parent_node_id,
    ancestorNodeIds: body.ancestor_node_ids,
    mode: body.mode,
    suggestionId: body.suggestion_id,
    rawInput: body.raw_input,
    // 키가 있으면 undefined가 넘어가 expand()가 realCaller를 쓴다.
    call: resolveCaller(),
  })

  switch (outcome.kind) {
    case 'ok':
      return json(
        {
          node: {
            id: outcome.node.id,
            question: outcome.node.question,
            body: outcome.node.body,
            identity_scope: outcome.node.identityScope,
            suggestions: outcome.node.suggestions.map((s) => ({
              id: s.id,
              text: s.text,
              resolved: s.targetNodeId !== null,
            })),
          },
          cache: outcome.cache,
          quota: outcome.quota,
          ancestor_jump: null,
        },
        200,
      )

    case 'ancestor_jump':
      return json(
        {
          node: null,
          cache: null,
          ancestor_jump: { index: outcome.ancestorIndex, node_id: outcome.nodeId },
        },
        200,
      )

    case 'invalid':
      return json({ error: 'invalid_input', detail: outcome.detail, code: outcome.code }, 400)

    case 'rejected':
      return json({ error: 'irrelevant', reason: outcome.reason }, 422)

    case 'quota_exceeded':
      return json({ error: 'quota_exceeded', retry_after: null }, 429)

    case 'busy':
      return json({ error: 'rate_limited', retry_after: BUSY_RETRY_SECONDS }, 429)

    case 'generation_failed':
      return json({ error: 'generation_timeout' }, 504)

    case 'not_found':
      return json({ error: 'not_found', what: outcome.what }, 404)
  }
}
