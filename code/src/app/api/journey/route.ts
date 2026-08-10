import { ensureSeeded } from '@/lib/db/bootstrap'
import { readUserId } from '@/lib/auth/session'
import { loadJourneyForUser } from '@/lib/db/journeys'

/**
 * 내 여정 전체 (C4).
 *
 * 로컬이 빈 새 기기가 서버 기록을 내려받는 자리다. 로컬이 있으면
 * 클라이언트는 이 대신 POST /api/journey/merge를 쓴다 — 병합 응답이
 * 전체 세트라 왕복이 하나 준다.
 *
 * 개인 기록이므로 절대 캐시하지 않는다.
 */
export const dynamic = 'force-dynamic'

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

export async function GET(request: Request): Promise<Response> {
  await ensureSeeded()

  const userId = await readUserId(request.headers)
  if (!userId) return json({ error: 'unauthorized' }, 401)

  const snap = await loadJourneyForUser(userId)
  return json(
    {
      occurrences: snap.occurrences.map((o) => ({
        id: o.id,
        node_id: o.nodeId,
        parent_id: o.parentId,
        question: o.question,
        category: o.category,
      })),
      current_id: snap.currentId,
    },
    200,
  )
}
