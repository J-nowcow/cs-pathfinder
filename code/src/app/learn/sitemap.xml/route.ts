import { renderLearningSitemap } from '@/lib/seo/learning'
import { siteUrl } from '@/lib/site'

// This public, source-only map remains available without waking the database.
export const dynamic = 'force-static'
export function GET() {
  return new Response(renderLearningSitemap(siteUrl().origin), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  })
}
