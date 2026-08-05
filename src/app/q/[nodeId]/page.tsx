import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadNode } from '@/lib/expand/cache'
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

  if (!node) return { title: '질문을 찾을 수 없습니다 · CS 질문 트리' }

  return {
    title: `${node.question} · CS 질문 트리`,
    description: node.body.split('\n\n')[0]?.slice(0, 140),
  }
}

export default async function ReadPage({ params }: { params: Promise<{ nodeId: string }> }) {
  await ensureSeeded()

  const { nodeId } = await params
  const node = await loadNode(nodeId)
  if (!node) notFound()

  const initial: ReadingNode = {
    id: node.id,
    question: node.question,
    body: node.body,
    identityScope: node.identityScope,
    category: node.primaryCategory,
    suggestions: node.suggestions.map((s) => ({
      id: s.id,
      text: s.text,
      resolved: s.targetNodeId !== null,
    })),
  }

  return <ReadingView initialNode={initial} />
}
