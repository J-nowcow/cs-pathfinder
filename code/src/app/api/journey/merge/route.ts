import { z } from 'zod'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { readUserId } from '@/lib/auth/session'
import { mergeJourneyForUser } from '@/lib/db/journeys'
import { MAX_OCCURRENCES } from '@/lib/journey/storage'

/**
 * 여정 병합 (C4). **더하기만 한다** — 치환 엔드포인트(PUT)는 만들지
 * 않는다. 엔드포인트 이름으로 실수를 막는다 (auth-design §2 규칙 1).
 *
 * 문장(question·category)은 받아도 버린다. 스키마에 아예 없어서 zod가
 * 통과시키지 않는 것이 아니라 — strip이 기본이라 조용히 사라진다.
 * 저장은 구조만, 문장은 서버가 qnode에서 다시 읽는다 (share와 같은 결정).
 */
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  occurrences: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        node_id: z.string().uuid(),
        parent_id: z.string().min(1).max(64).nullable(),
      }),
    )
    .max(MAX_OCCURRENCES),
  current_id: z.string().min(1).max(64).nullable(),
})

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  await ensureSeeded()

  const userId = await readUserId(request.headers)
  if (!userId) return json({ error: 'unauthorized' }, 401)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'invalid_input', detail: 'JSON이 아니다' }, 400)
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'invalid_input', detail: parsed.error.issues[0]?.message }, 400)
  }

  const outcome = await mergeJourneyForUser(
    userId,
    parsed.data.occurrences.map((o) => ({ id: o.id, nodeId: o.node_id, parentId: o.parent_id })),
    parsed.data.current_id,
  )

  switch (outcome.kind) {
    case 'invalid_forest':
      return json({ error: 'invalid_forest', detail: outcome.reason }, 400)
    case 'unknown_node':
      return json({ error: 'unknown_node' }, 400)
    case 'ok':
      return json(
        {
          occurrences: outcome.journey.occurrences.map((o) => ({
            id: o.id,
            node_id: o.nodeId,
            parent_id: o.parentId,
            question: o.question,
            category: o.category,
          })),
          current_id: outcome.journey.currentId,
        },
        200,
      )
  }
}
