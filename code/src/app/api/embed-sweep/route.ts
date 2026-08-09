import { cronAuth } from '@/lib/api/cron-auth'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { sweepEmbeddings } from '@/lib/embed/backfill'
import { hasApiKey } from '@/lib/llm/keys'

/**
 * 임베딩이 빈 노드를 줍는다. GitHub Actions가 매일 부른다.
 *
 * 응답 뒤 백필(`after()`)이 fail-open이라 이 그물이 반드시 있어야 한다.
 * 백필 실패·일일 발행 노드·전량 재작업의 잔여가 전부 여기로 모인다.
 */
export const dynamic = 'force-dynamic'
// 밀린 날은 덩이 여러 개를 돈다. 기본 타임아웃으로는 모자란다.
export const maxDuration = 60

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const auth = cronAuth(request)
  if (auth !== 'ok') {
    return json({ error: 'unauthorized', reason: auth }, 401)
  }

  /*
   * 키가 없으면 여기서 멈춘다. 키 없이 돌면 sweepEmbeddings의 덩이가 전부
   * 실패로 떨어지는데, 그건 "실패 0·채움 0"과 구분되는 신호여야 한다 --
   * 워크플로가 빨간불을 들어야 사람이 안다.
   */
  if (!hasApiKey()) {
    return json({ error: 'no_api_key', detail: 'GOOGLE_GENERATIVE_AI_API_KEY가 없다' }, 503)
  }

  await ensureSeeded()

  try {
    const result = await sweepEmbeddings()
    /*
     * 실패가 있으면 2xx를 주지 않는다. 워크플로가 초록불이면 아무도 안 본다.
     * publish-daily가 같은 이유로 실패를 5xx로 옮긴다.
     */
    const status = result.failed > 0 ? 502 : 200
    return json({ status: result.failed > 0 ? 'partial' : 'ok', ...result }, status)
  } catch (e) {
    return json(
      { error: 'internal_error', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
}
