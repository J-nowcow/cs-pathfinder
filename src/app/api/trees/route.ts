import { ensureSeeded } from '@/lib/db/bootstrap'
import { listTrees, BOARD_PAGE_SIZE } from '@/lib/db/trees'
import { asCategory } from '@/lib/tree/categories'
import type { SortMode } from '@/lib/tree/cursor'

/**
 * 게시판 목록. 설계 §9의 `GET /api/trees?sort=&category=&cursor=`.
 *
 * published tree는 개인 데이터가 없어 공개 캐시 대상이다(§10 캐시 경계).
 * 다만 새 트리가 바로 안 보이면 공유한 사람이 자기 것을 못 찾으니 짧게만 잡는다.
 *
 * 개인 상태를 여기 섞으면 안 된다. 섞는 순간 이 캐시가 사용자 사이로 샌다.
 */
export async function GET(request: Request): Promise<Response> {
  await ensureSeeded()

  const params = new URL(request.url).searchParams

  // 모르는 정렬값은 최신으로 떨어뜨린다. 400을 주면 주소를 손댄 사람에게
  // 빈 화면이 남는데, 게시판에서 그건 고장으로 읽힌다
  const sort: SortMode = params.get('sort') === 'popular' ? 'popular' : 'recent'

  const page = await listTrees({
    sort,
    category: asCategory(params.get('category')),
    cursor: params.get('cursor'),
    limit: BOARD_PAGE_SIZE,
  })

  return Response.json(page, {
    headers: { 'cache-control': 'public, max-age=15, stale-while-revalidate=120' },
  })
}
