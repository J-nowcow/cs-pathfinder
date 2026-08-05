import { getDb } from '@/lib/db/client'
import { loadNode } from '@/lib/expand/cache'
import { kstToday } from '@/lib/daily/date'
import type { PublicNode } from '@/lib/api/expand-client'

export type { PublicNode, PublicSuggestion } from '@/lib/api/expand-client'

/**
 * 오늘의 질문 한 건.
 *
 * `root`가 읽기 뷰가 바로 그릴 수 있는 형태다. `/api/expand` 응답의 노드와
 * 같은 모양(PublicNode)이라 화면이 분기를 둘 필요가 없다.
 */
export type DailyTree = {
  id: string
  slug: string
  title: string
  category: string
  summary: string
  /** 'YYYY-MM-DD' (KST) */
  publishDate: string
  /** ISO 8601 */
  publishedAt: string
  /**
   * 오늘(KST) 발행분이면 true.
   *
   * false면 오늘 것이 아직 없어 최근 것을 대신 보여주는 상태다.
   * 화면이 "오늘의 질문"과 "가장 최근 질문"을 구분하려면 이 값이 필요하다.
   */
  isToday: boolean
  root: PublicNode
}

type TreeRow = {
  id: string
  slug: string
  title: string
  category: string
  summary: string
  publish_date: string
  published_at: string | Date
  root_node_id: string
}

// publish_date는 to_char로 문자열로 뽑는다.
// date 컬럼을 드라이버가 Date로 파싱하면 로컬 자정 기준이라 날짜가 하루 밀 수 있다.
const SELECT = `
  select t.id, t.slug, t.title, t.category, t.summary,
         to_char(t.publish_date, 'YYYY-MM-DD') as publish_date,
         t.published_at, t.root_node_id
  from tree t
  where t.kind = 'daily'
`

function isoOf(v: string | Date): string {
  return typeof v === 'string' ? new Date(v).toISOString() : v.toISOString()
}

async function hydrate(row: TreeRow | undefined, today: string): Promise<DailyTree | null> {
  if (!row) return null

  const node = await loadNode(row.root_node_id)
  // 루트가 ready가 아니면 오늘의 질문이 성립하지 않는다. 빈 해설을 내보내지 않는다.
  if (!node) return null

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    summary: row.summary,
    publishDate: row.publish_date,
    publishedAt: isoOf(row.published_at),
    isToday: row.publish_date === today,
    root: {
      id: node.id,
      question: node.question,
      body: node.body,
      identityScope: node.identityScope,
      suggestions: node.suggestions.map((s) => ({
        id: s.id,
        text: s.text,
        resolved: s.targetNodeId !== null,
      })),
    },
  }
}

/**
 * 홈이 부르는 함수.
 *
 * 오늘 발행분이 있으면 그것, 없으면 가장 최근 것을 준다. 발행이 하루 밀렸다고
 * 홈이 비면 안 된다. 어느 쪽인지는 `isToday`로 구분한다.
 *
 * **미래 발행분은 후보에서 뺀다.** 자동 발행이 막힐 때를 대비해 다음 날 것을
 * 미리 뽑아두는데, 그것이 후보에 남아 있으면 오늘 발행이 없는 날 홈의 주인공
 * 자리를 내일 질문이 차지한다. 하루 하나라는 약속이 그 자리에서 깨진다.
 *
 * @param today 기준 날짜 'YYYY-MM-DD'. 기본은 KST 오늘. 테스트에서만 넘긴다
 */
export async function getTodayTree(today: string = kstToday()): Promise<DailyTree | null> {
  const db = await getDb()
  const rows = await db.query<TreeRow>(
    `${SELECT} and t.publish_date <= $1::date
     order by t.publish_date desc
     limit 1`,
    [today],
  )
  return hydrate(rows[0], today)
}

/**
 * 그날 트리 행이 있는지만 본다.
 *
 * findDailyTree는 루트가 ready가 아니면 null을 낸다. 그걸 "미발행"으로 읽으면
 * 발행을 다시 시도하게 되고 매번 LLM만 태우다 유니크 인덱스에 막힌다.
 * 발행 여부는 트리 행의 존재로만 판단한다.
 */
export async function dailyTreeExists(date: string): Promise<boolean> {
  const db = await getDb()
  const rows = await db.query<{ one: number }>(
    `select 1 as one from tree where kind = 'daily' and publish_date = $1::date limit 1`,
    [date],
  )
  return rows.length > 0
}

/** 특정 날짜의 발행분. 발행 로직이 중복 발행을 막을 때 쓴다 */
export async function findDailyTree(
  date: string,
  today: string = kstToday(),
): Promise<DailyTree | null> {
  const db = await getDb()
  const rows = await db.query<TreeRow>(`${SELECT} and t.publish_date = $1::date limit 1`, [date])
  return hydrate(rows[0], today)
}
