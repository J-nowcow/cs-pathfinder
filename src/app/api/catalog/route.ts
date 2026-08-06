import { authorizedCron } from '@/lib/api/cron-auth'
import { loadCatalog, renderCatalog } from '@/lib/db/catalog'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-dynamic'

/**
 * 질문 목록을 마크다운으로 돌려준다.
 *
 * 레포의 `docs/questions.md`를 발행 워크플로가 이걸로 다시 쓴다. DB에 직접
 * 붙지 않는 이유는 그러려면 DATABASE_URL을 GitHub 시크릿에도 넣어야 하기
 * 때문이다. DB 자격증명을 한 곳 더 늘리는 것보다 이미 있는 CRON_SECRET을
 * 쓰는 편이 낫다.
 *
 * 발행 라우트와 같은 열쇠를 쓴다. 읽기 전용이지만 열어둘 이유도 없다 —
 * 사용자가 판 질문은 빼고 담는다고 해도, 그 판단이 한 번 어긋나면 열린
 * 엔드포인트가 그것을 그대로 내보낸다.
 */
export async function GET(request: Request) {
  if (!authorizedCron(request)) {
    return new Response('unauthorized', { status: 401 })
  }

  const catalog = await loadCatalog()

  /*
   * 빈 목록은 내보내지 않는다.
   *
   * 부팅 때 예시 서른 개가 심기므로 0개는 정상 상태가 아니다. DB가 잠깐
   * 흔들렸거나 배포가 어긋난 것이다.
   *
   * 그대로 200으로 내보내면 워크플로가 그것을 받아 docs/questions.md를
   * 덮어쓰고 커밋한다. 새벽에 무인으로 도는 자리라 아무도 못 보는 사이에
   * 목록이 통째로 지워진다. 503으로 떨어뜨리면 워크플로가 --fail-with-body로
   * 멈추고 파일은 그대로 남는다.
   */
  if (catalog.entries.length === 0) {
    return new Response('catalog is empty — refusing to serve', { status: 503 })
  }

  const markdown = renderCatalog(catalog, SITE_URL)

  return new Response(markdown, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
