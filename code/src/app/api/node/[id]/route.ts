import { loadNode } from '@/lib/expand/cache'
import { ensureSeeded } from '@/lib/db/bootstrap'

/**
 * 공개 노드 조회.
 *
 * 개인 필드가 없으므로 공개 캐시 대상이다. 경로·할당량 같은 개인 상태는
 * 이 응답에 절대 싣지 않는다. 섞으면 캐시가 사용자 간에 샌다.
 *
 * **관련 질문은 실어도 된다.** 노드에 딸린 값이라 누가 물어도 같다. 무엇을
 * 이미 봤는지는 개인 상태지만 그 표시는 화면이 자기 여정으로 붙인다 —
 * 서버는 목록만 준다.
 *
 * loadNode는 status='ready'만 반환한다. 생성 중이거나 실패한 노드가 새지 않는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  await ensureSeeded()

  const { id } = await params
  const node = await loadNode(id, { withRelated: true })

  if (!node) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  return Response.json(
    {
      id: node.id,
      number: node.number,
      question: node.question,
      body: node.body,
      identity_scope: node.identityScope,
      category: node.primaryCategory,
      tags: node.tags,
      level: node.level,
      suggestions: node.suggestions.map((s) => ({
        id: s.id,
        text: s.text,
        resolved: s.targetNodeId !== null,
      })),
      related: (node.related ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        question: r.question,
        category: r.category,
        reason: r.reason,
      })),
    },
    { headers: { 'cache-control': 'public, max-age=60, stale-while-revalidate=600' } },
  )
}
