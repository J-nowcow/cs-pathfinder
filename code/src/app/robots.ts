import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/**
 * 크롤러에게 하는 말.
 *
 * 전에는 `/robots.txt`가 **404**였다. 색인을 막지는 않았지만
 * `sitemap.xml`이 어디 있는지 알려줄 자리도 없었다. 구글 `site:` 검색이
 * 0건이었다.
 *
 * 홍보를 한 적이 없으니 지금 사람이 들어올 길은 검색뿐인데 그 길의
 * 표지판이 안 서 있었다.
 *
 * `/api/`는 막는다. 사람이 읽을 화면이 아니고, 같은 내용이 `/q/…`에
 * 제대로 된 모양으로 이미 있다. 색인이 갈리면 어느 쪽이 원본인지
 * 흐려진다.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl().origin

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
