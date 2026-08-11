import { getDb } from '@/lib/db/client'
import { CATEGORIES } from '@/lib/tree/categories'
import { kstToday } from '@/lib/daily/date'

/**
 * 레포에 올릴 질문 목록.
 *
 * 서비스는 Vercel에 있고 목록은 화면에서 본다. 그런데 레포만 보러 온 사람에게는
 * 이 서비스가 무엇을 담고 있는지 보이지 않는다. 주제어 시드 412개가 파일로
 * 있긴 하지만 그건 "언젠가 질문을 만들 대기열"이지 질문이 아니다.
 *
 * 그래서 실제로 만들어진 질문을 마크다운으로 떠서 커밋한다.
 */
export type CatalogEntry = {
  id: string
  question: string
  category: string
  /** 발행분이면 'YYYY-MM-DD', 예시나 사용자 질문이면 null */
  publishDate: string | null
  /** `withBody`로 물었을 때만 담긴다. 목록 용도에서는 나르지 않는다 */
  body?: string
}

export type Catalog = {
  /** 생성 기준일 (KST). 문서 머리말에 적는다 */
  date: string
  entries: CatalogEntry[]
  byCategory: Array<{ category: string; entries: CatalogEntry[] }>
}

type Row = {
  id: string
  question: string
  category: string
  publish_date: string | null
  body?: string
}

/**
 * 목록에 담을 질문을 고른다.
 *
 * `origin='batch'`만 본다. 사용자가 자유 입력으로 판 질문(`on_demand`)은 빼는데,
 * `ready`는 "생성이 끝났다"는 뜻이지 "공개해도 된다"는 뜻이 아니기 때문이다.
 * 남의 입력이 레포에 영구히 박히는 것은 되돌릴 수 없다.
 *
 * 아직 오지 않은 발행분도 뺀다. 화면에서 감춰 놓고 레포에 적으면 감춘 의미가 없다.
 */
export async function loadCatalog(
  today: string = kstToday(),
  opts: { withBody?: boolean } = {},
): Promise<Catalog> {
  const db = await getDb()
  const rows = await db.query<Row>(
    `select n.id,
            n.normalized_question as question,
            n.primary_category    as category,
            ${opts.withBody ? 'n.body,' : ''}
            to_char(t.publish_date, 'YYYY-MM-DD') as publish_date
       from qnode n
       left join tree t
              on t.root_node_id = n.id
             and t.kind = 'daily'
      where n.status = 'ready'
        and n.origin = 'batch'
        and (t.publish_date is null or t.publish_date <= $1::date)
      order by n.created_at asc, n.normalized_question asc`,
    [today],
  )

  const entries: CatalogEntry[] = rows.map((r) => ({
    id: r.id,
    question: r.question,
    category: r.category,
    publishDate: r.publish_date,
    ...(opts.withBody ? { body: r.body ?? '' } : {}),
  }))

  // CATEGORIES 순서를 따른다. 개수순으로 세우면 발행 하나에 순서가 흔들려서
  // 커밋 diff가 내용과 무관하게 통째로 뒤집힌다
  const byCategory = CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0)

  return { date: today, entries, byCategory }
}

/**
 * 마크다운으로 옮긴다.
 *
 * 커밋 diff가 읽히는 것이 중요하다. 질문이 하나 늘었을 때 한 줄만 늘어야지
 * 문서가 통째로 흔들리면 이력이 쓸모없어진다. 그래서 순서를 고정하고, 개수처럼
 * 매번 바뀌는 값은 최소한으로 적는다.
 */
export function renderCatalog(catalog: Catalog, siteUrl: string): string {
  const base = siteUrl.replace(/\/+$/, '')
  const lines: string[] = [
    '# 질문 목록',
    '',
    `지금까지 올라온 질문 ${catalog.entries.length}개. 서비스에서는 [카테고리별 질문](${base}/questions)으로 볼 수 있다.`,
    '',
    '이 파일은 발행 워크플로가 자동으로 다시 쓴다. 손으로 고치면 다음 발행에 덮인다.',
    '',
    '사용자가 자유 입력으로 판 질문은 담지 않는다. 생성이 끝났다는 것과 공개해도 된다는 것은 다르고, 레포에 박히면 되돌릴 수 없다.',
    '',
  ]

  for (const group of catalog.byCategory) {
    lines.push(`## ${group.category}`, '')
    for (const e of group.entries) {
      const when = e.publishDate ? ` — ${e.publishDate}` : ''
      lines.push(`- [${e.question}](${base}/q/${e.id})${when}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
