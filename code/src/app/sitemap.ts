import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadCatalog } from '@/lib/db/catalog'
import { isMissingTable } from '@/lib/db/missing-table'

/**
 * 어떤 주소가 있는지 알린다.
 *
 * 질문 251개가 **각각 검색에 잡힐 수 있는 상태로 이미 만들어져 있었다.**
 * `/q/…`는 완전 서버 렌더라 JS 없이도 본문이 다 오고, 질문마다 제목과
 * 설명이 다르다. 그런데 `sitemap.xml`이 404라 크롤러에게 그것이 있다고
 * 알려줄 방법이 없었다. 구글 색인 0건.
 *
 * `/questions` 한 장에 251개 링크가 다 걸려 있어 완전히 고립은 아니었지만,
 * 그 한 장을 크롤러가 먼저 찾아야 한다는 전제가 붙는다. sitemap은 그
 * 전제를 없앤다.
 *
 * 공유 트리(`/t/…`)는 넣지 않는다. 사용자가 판 경로라 내용이 우리 것이
 * 아니고, 지금 하나뿐이다.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl().origin

  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/questions`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/map`, changeFrequency: 'weekly', priority: 0.5 },
  ]

  /*
   * 질문을 못 읽어도 sitemap 자체는 나가야 한다.
   *
   * 여기서 던지면 `/sitemap.xml`이 통째로 500이 되고, 그러면 위의 세 주소도
   * 못 알린다. 부팅 직후나 마이그레이션 전이면 표가 없을 수 있다.
   */
  let entries: MetadataRoute.Sitemap = []
  try {
    await ensureSeeded()
    const catalog = await loadCatalog()
    entries = catalog.entries.map((e) => ({
      url: `${base}/q/${e.id}`,
      /*
       * 한 번 쓰인 해설은 거의 안 바뀐다. 크롤러에게 매일 오라고 하면
       * 251개를 매일 훑고 아무것도 안 달라진 것을 확인하고 간다.
       */
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))
  } catch (e) {
    if (!isMissingTable(e)) throw e
  }

  return [...fixed, ...entries]
}
