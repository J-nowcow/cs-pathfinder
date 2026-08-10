import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadNode } from '@/lib/expand/cache'
import { socialMeta } from '@/lib/site'
import { headers } from 'next/headers'
import { getQuota } from '@/lib/quota'
import { quotaKeyFromHeaders, anonDailyLimit } from '@/lib/quota/key'
import { ReadingView, type ReadingNode } from '@/components/ReadingView'

export const dynamic = 'force-dynamic'

/**
 * 읽기 뷰.
 *
 * 설계 §7은 이 자리의 URL을 occurrence ID로 잡았다. 계획 2는 익명 전용이라
 * 서버에 occurrence가 없어 노드 ID를 쓴다. 경로 문맥은 클라이언트가 얹는다.
 * 인증이 붙는 계획 3에서 /j/[occurrenceId]가 이 역할을 가져간다.
 *
 * 서버는 공개 노드만 렌더한다. 개인 경로를 섞지 않으므로 캐시 경계가 지켜진다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ nodeId: string }>
}): Promise<Metadata> {
  await ensureSeeded()
  const { nodeId } = await params
  const node = await loadNode(nodeId)

  // 접미는 layout의 title template이 붙인다. 여기서 또 붙이면 두 번 나온다.
  if (!node) return { title: '없는 질문입니다' }

  // 해설 첫 문단이 결론이라 미리보기 두 번째 줄로 알맞다
  const lead = node.body.split('\n\n')[0]?.slice(0, 140) ?? ''

  return {
    // title은 socialMeta가 준다. 여기서 또 적으면 두 곳이 갈릴 자리가 생긴다
    description: lead,
    ...socialMeta({ title: node.question, description: lead, type: 'article' }),
  }
}

export default async function ReadPage({ params }: { params: Promise<{ nodeId: string }> }) {
  await ensureSeeded()

  const { nodeId } = await params
  const node = await loadNode(nodeId)
  if (!node) notFound()

  // 남은 횟수를 첫 화면부터 보여준다. 클라이언트가 따로 물으면 한 번 더 왕복하고
  // 그 사이에 숫자가 없는 순간이 생긴다. 확장 API와 같은 키로 조회해야
  // 화면이 말하는 값과 실제로 차감되는 값이 어긋나지 않는다.
  const quotaKey = quotaKeyFromHeaders(await headers())
  const limit = anonDailyLimit()
  const used = (await getQuota(quotaKey)).used

  const initial: ReadingNode = {
    id: node.id,
    number: node.number,
    question: node.question,
    body: node.body,
    tags: node.tags,
    level: node.level,
    identityScope: node.identityScope,
    category: node.primaryCategory,
    suggestions: node.suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      resolved: s.targetNodeId !== null,
    })),
  }

  return <ReadingView initialNode={initial} initialQuota={{ used, limit }} />
}
