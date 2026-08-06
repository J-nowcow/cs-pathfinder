import { listRoots } from '@/lib/db/roots'
import { ensureSeeded } from '@/lib/db/bootstrap'

/**
 * 루트 질문 목록. 홈이 쓴다.
 *
 * 계획 3에서 매일 발행이 붙으면 오늘의 질문이 여기 함께 잡힌다.
 */
export async function GET(): Promise<Response> {
  await ensureSeeded()

  return Response.json(
    { roots: await listRoots() },
    { headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=600' } },
  )
}
