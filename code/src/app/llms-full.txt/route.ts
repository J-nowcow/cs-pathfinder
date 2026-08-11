import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadCatalog } from '@/lib/db/catalog'
import { renderLlmsFull } from '@/lib/seo/llms'
import { siteUrl } from '@/lib/site'

/** 해설 전문판. 반 MB쯤 되지만 읽는 쪽이 LLM이라 한 파일이 오히려 맞다 */
export const dynamic = 'force-dynamic'

export async function GET() {
  await ensureSeeded()
  const catalog = await loadCatalog(undefined, { withBody: true })
  return new Response(renderLlmsFull(catalog, siteUrl().origin), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
