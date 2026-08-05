import { getDb } from '@/lib/db/client'
import { kstToday } from '@/lib/daily/date'

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
  excerpt: string
}

/**
 * 배치로 발행된 루트 노드 목록.
 *
 * 계획 3에서 매일 발행이 붙으면 같은 질의에 오늘의 질문이 함께 잡힌다.
 * status='ready'만 본다. 생성 중이거나 실패한 노드가 홈에 뜨면 안 된다.
 *
 * 상한이 없다. 매일 하나씩 늘어나므로 언젠가 홈이 길어진다. 어디서 자르고
 * 어떤 순서로 세울지는 화면 구성 결정이라 여기서 임의로 정하지 않는다 —
 * 지금 순서(오래된 것 먼저)에 상한만 걸면 새 발행분이 먼저 잘려나간다.
 */
export async function listRoots(): Promise<RootSummary[]> {
  const db = await getDb()

  // 발췌를 DB에서 자른다. 카드는 첫 문단만 쓰는데 본문을 통째로 실어 나르면
  // 예시 스무 개만 해도 20KB가 넘고, 발행이 쌓일수록 매일 한 문서씩 늘어난다.
  const rows = await db.query<Row>(
    `select id, normalized_question, primary_category,
            split_part(body, E'\n\n', 1) as excerpt
     from qnode
     where origin = 'batch' and status = 'ready'
       and not exists (
         select 1 from tree t
          where t.root_node_id = qnode.id
            and t.publish_date > $1::date
       )
     order by created_at asc, normalized_question asc`,
    [kstToday()],
  )

  return rows.map((r) => ({
    id: r.id,
    question: r.normalized_question,
    category: r.primary_category,
    excerpt: r.excerpt,
  }))
}
