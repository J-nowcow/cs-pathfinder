import { getDb } from '@/lib/db/client'

export type RootSummary = {
  id: string
  question: string
  category: string
  /** 카드에 보여줄 첫 문단. 본문 전체를 홈으로 실어 나르지 않는다. */
  excerpt: string
}

type Row = {
  id: string
  normalized_question: string
  primary_category: string
  body: string
}

/**
 * 배치로 발행된 루트 노드 목록.
 *
 * 계획 3에서 매일 발행이 붙으면 같은 질의에 오늘의 질문이 함께 잡힌다.
 * status='ready'만 본다. 생성 중이거나 실패한 노드가 홈에 뜨면 안 된다.
 */
export async function listRoots(): Promise<RootSummary[]> {
  const db = await getDb()

  const rows = await db.query<Row>(
    `select id, normalized_question, primary_category, body
     from qnode
     where origin = 'batch' and status = 'ready'
     order by created_at asc, normalized_question asc`,
  )

  return rows.map((r) => ({
    id: r.id,
    question: r.normalized_question,
    category: r.primary_category,
    excerpt: r.body.split('\n\n')[0] ?? '',
  }))
}
