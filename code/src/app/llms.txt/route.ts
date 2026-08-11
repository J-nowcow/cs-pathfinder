import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadCatalog } from '@/lib/db/catalog'
import { renderLlms } from '@/lib/seo/llms'
import { siteUrl } from '@/lib/site'

/**
 * LLM용 사이트 안내판. 무엇을 왜 내보내는지는 `lib/seo/llms.ts`에 있다.
 *
 * rss와 같은 이유로 `force-dynamic`이다 — 매일 발행되는데 빌드 시점에
 * 굳으면 다음 배포까지 옛 목록이 나간다.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSeeded()
  const catalog = await loadCatalog()
  return new Response(renderLlms(catalog, siteUrl().origin), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
