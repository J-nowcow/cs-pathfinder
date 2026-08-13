import { getDb } from '@/lib/db/client'
import { NOT_FOLDED_SQL } from '@/lib/db/equivalence'
import { kstToday } from '@/lib/daily/date'

export type RootSummary = {
  id: string
  question: string
  category: string
  /** 카드에 보여줄 첫 문단. 본문 전체를 홈으로 실어 나르지 않는다. */
  excerpt: string
  /** `data/tags.ts` 통제 어휘 안의 태그. 무태그면 빈 배열 */
  tags: string[]
  /** `data/levels.ts` 3단 중 하나. 미판정이면 null */
  level: string | null
}

/** 개념 역탐색에서만 쓰는 전체 해설. 일반 목록 응답에는 싣지 않는다. */
export type SearchableRootSummary = RootSummary & { searchText: string }

type Row = {
  id: string
  normalized_question: string
  primary_category: string
  excerpt: string
  tags: string[]
  level: string | null
}

type SearchableRow = Row & { search_text: string }

/**
 * 배치로 발행된 루트 노드 목록.
 *
 * 계획 3에서 매일 발행이 붙으면 같은 질의에 오늘의 질문이 함께 잡힌다.
 * status='ready'만 본다. 생성 중이거나 실패한 노드가 홈에 뜨면 안 된다.
 *
 * `limit`을 주면 **새 것부터** 그만큼만 준다. 상한이 없을 때는 오래된 것
 * 먼저 주는데, 거기에 상한만 걸면 새 발행분이 먼저 잘려나간다.
 *
 * 상한이 필요한 이유는 홈의 무게다. 249개를 다 실으니 HTML이 447KB였다.
 * 유입이 카톡 링크라 첫 방문 대부분이 폰인데, 오늘 질문 하나 보려고 그만큼을
 * 받는다. 전체 목록은 /questions가 따로 맡는다.
 */
export async function listRoots(opts: { limit?: number } = {}): Promise<RootSummary[]> {
  const db = await getDb()

  // 발췌를 DB에서 자른다. 카드는 첫 문단만 쓰는데 본문을 통째로 실어 나르면
  // 예시 스무 개만 해도 20KB가 넘고, 발행이 쌓일수록 매일 한 문서씩 늘어난다.
  const rows = await db.query<Row>(
    `select id, normalized_question, primary_category, tags, level,
            split_part(body, E'\n\n', 1) as excerpt
     from qnode
     where origin = 'batch' and status = 'ready'
       and ${NOT_FOLDED_SQL('qnode')}
       and not exists (
         select 1 from tree t
          where t.root_node_id = qnode.id
            and t.publish_date > $1::date
       )
     order by created_at ${opts.limit ? 'desc' : 'asc'}, normalized_question asc
     ${opts.limit ? `limit ${Math.max(1, Math.floor(opts.limit))}` : ''}`,
    [kstToday()],
  )

  return rows.map((r) => ({
    id: r.id,
    question: r.normalized_question,
    category: r.primary_category,
    excerpt: r.excerpt,
    tags: r.tags ?? [],
    level: r.level,
  }))
}

/**
 * 용어에서 질문을 역으로 찾을 때만 전체 해설을 읽는다.
 *
 * `listRoots`에 body를 붙이면 홈과 질문 목록까지 300편의 본문을 매번 읽는다.
 * 이 질의는 개념 페이지에서만 호출해 그 비용을 역탐색 경로 안에 가둔다.
 */
export async function listSearchableRoots(): Promise<SearchableRootSummary[]> {
  const db = await getDb()
  const rows = await db.query<SearchableRow>(
    `select id, normalized_question, primary_category, body as search_text, tags, level,
            split_part(body, E'\n\n', 1) as excerpt
       from qnode
      where origin = 'batch' and status = 'ready'
        and ${NOT_FOLDED_SQL('qnode')}
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
    searchText: r.search_text,
    tags: r.tags ?? [],
    level: r.level,
  }))
}

/**
 * 배치 루트 총 개수.
 *
 * 홈은 열두 개만 보여주지만 "지난 질문 N개"의 N은 전체다. 그 숫자를 위해
 * 249행을 다 실어올 이유는 없다.
 */
export async function countRoots(today: string = kstToday()): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ n: string }>(
    `select count(*) as n
       from qnode
      where origin = 'batch' and status = 'ready'
        and not exists (
          select 1 from tree t
           where t.root_node_id = qnode.id
             and t.publish_date > $1::date
        )`,
    [today],
  )
  return Number(rows[0]?.n ?? 0)
}
