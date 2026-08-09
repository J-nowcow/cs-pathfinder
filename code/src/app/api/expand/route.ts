import { z } from 'zod'
import { expand } from '@/lib/expand'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { resolveCaller } from '@/lib/llm/resolve'
import { quotaKeyFromHeaders, anonDailyLimit } from '@/lib/quota/key'
import { backfillEmbedding } from '@/lib/embed/backfill'
import { safeAfter } from '@/lib/next/safe-after'

const bodySchema = z.object({
  idempotency_key: z.string().min(1),
  parent_node_id: z.string().uuid(),
  ancestor_node_ids: z.array(z.string().uuid()).default([]),
  mode: z.enum(['suggestion', 'free']),
  suggestion_id: z.string().uuid().optional(),
  raw_input: z.string().optional(),
})

const BUSY_RETRY_SECONDS = 3

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
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
    quotaKey: quotaKeyFromHeaders(request.headers),
    dailyLimit: anonDailyLimit(),
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
      /*
       * 새로 만든 노드('miss')만 임베딩을 응답 뒤에 채운다. 'hit'은 이미
       * 있던 노드라 임베딩도 이미 있다. 실패하면 매일 스윕이 줍는다.
       */
      if (outcome.cache === 'miss') safeAfter(() => backfillEmbedding(outcome.node.id))
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
