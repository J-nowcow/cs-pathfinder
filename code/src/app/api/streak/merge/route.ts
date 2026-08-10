import { z } from 'zod'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { readUserId } from '@/lib/auth/session'
import { mergeStreakForUser } from '@/lib/db/streaks'
import { MAX_DAYS, MAX_PER_DAY } from '@/lib/streak/storage'

/**
 * 잔디 병합 (C4). 여정과 별도 라우트다 — /api/journey에 실으면
 * auth-design이 고정한 계약("journey는 발자국 구조")이 흐려진다.
 *
 * 더하기만 한다. 지우는 경로가 없다 — 잔디는 이력이지 상태가 아니다.
 */
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  // 날짜 모양·uuid 모양 검증은 db/streaks가 한 번 더 한다(조용히 드롭).
  // 여기서는 크기만 막는다 — 통제 없는 record는 body 폭탄 통로다.
  days: z.record(z.string().max(10), z.array(z.string().max(64)).max(MAX_PER_DAY)),
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
  if (Object.keys(parsed.data.days).length > MAX_DAYS) {
    return json({ error: 'invalid_input', detail: '날짜가 너무 많다' }, 400)
  }

  const merged = await mergeStreakForUser(userId, parsed.data.days)
  return json({ days: merged.days }, 200)
}
