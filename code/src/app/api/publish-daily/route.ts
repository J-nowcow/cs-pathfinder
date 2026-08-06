import { publishDaily, type PublishOutcome } from '@/lib/daily/publish'
import { resolveCaller } from '@/lib/llm/resolve'
import type { DailyTree } from '@/lib/daily/today'
import { authorizedCron } from '@/lib/api/cron-auth'

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
  if (!authorizedCron(request)) {
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
