import { timingSafeEqual } from 'node:crypto'
import { publishDaily, type PublishOutcome } from '@/lib/daily/publish'
import { resolveCaller } from '@/lib/llm/resolve'
import type { DailyTree } from '@/lib/daily/today'

// 발행은 매번 새로 판단해야 한다. 정적 최적화 대상이 아니다.
export const dynamic = 'force-dynamic'
// 루트 생성은 LLM 한 번이라 수 초 걸린다. 기본 타임아웃으로는 모자란다.
export const maxDuration = 60

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

/** 길이가 다르면 timingSafeEqual이 던진다. 길이 비교를 먼저 한다 */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/**
 * GitHub Actions만 부를 수 있게 한다.
 *
 * CRON_SECRET이 없으면 잠근다. 설정이 빠졌을 때 열어두면 누구나 발행할 수 있고,
 * 그 사실을 아무도 모른 채로 지나간다.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  const header = request.headers.get('authorization') ?? ''
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (bearer && safeEqual(bearer, secret)) return true

  const alt = request.headers.get('x-cron-secret')?.trim() ?? ''
  return alt.length > 0 && safeEqual(alt, secret)
}

function treePayload(tree: DailyTree) {
  return {
    id: tree.id,
    slug: tree.slug,
    title: tree.title,
    category: tree.category,
    summary: tree.summary,
    publish_date: tree.publishDate,
    published_at: tree.publishedAt,
    node_id: tree.root.id,
    question: tree.root.question,
    suggestion_count: tree.root.suggestions.length,
  }
}

/**
 * 상태를 HTTP 코드로 옮긴다.
 *
 * 발행이 안 됐으면 2xx를 주지 않는다. 워크플로가 초록불이면 시드 소진도
 * 생성 장애도 아무도 모른 채 며칠이 지나간다.
 */
function respond(outcome: PublishOutcome): Response {
  switch (outcome.kind) {
    case 'published':
      return json(
        { status: 'published', tree: treePayload(outcome.tree), seed: outcome.seed },
        200,
      )

    case 'already_published':
      return json({ status: 'already_published', tree: treePayload(outcome.tree) }, 200)

    case 'seed_exhausted':
      return json(
        {
          status: 'seed_exhausted',
          error: 'seed_exhausted',
          detail: '미소비 주제어 시드가 없다. topic_seed를 보충해야 발행이 재개된다.',
        },
        409,
      )

    case 'generation_failed':
      return json(
        { status: 'generation_failed', error: 'generation_failed', detail: outcome.detail },
        502,
      )
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return json({ error: 'unauthorized' }, 401)
  }

  try {
    // 키가 있으면 undefined가 넘어가 publishDaily가 realCaller를 쓴다.
    return respond(await publishDaily({ call: resolveCaller() }))
  } catch (e) {
    return json(
      { error: 'internal_error', detail: e instanceof Error ? e.message : String(e) },
      500,
    )
  }
}
