import { ensureSeeded } from '@/lib/db/bootstrap'
import { getDb } from '@/lib/db/client'
import { kstToday } from '@/lib/daily/date'
import { buildRss, type FeedItem } from '@/lib/feed/rss'
import { SITE_URL } from '@/lib/site'

/**
 * 오늘의 질문 구독.
 *
 * 매일 하나씩 올라오는데 **다시 올 이유가 사용자 기억뿐이었다.** 알림도
 * 메일도 없다. 카카오톡 채널은 사업자 등록과 채널 개설이 앞에 있어 지금 못
 * 연다. RSS는 지금 열 수 있고 계정도 비밀도 필요 없다.
 *
 * 인증을 안 건다. `/api/catalog`는 열쇠로 잠갔는데 그건 **아직 안 추린 질문까지
 * 통째로** 내보내기 때문이다. 여기는 이미 발행돼 홈에 걸린 것만 담는다.
 *
 * `force-dynamic`으로 둔다. 매일 아침 6시에 새 항목이 생기는데 빌드 시점에
 * 굳으면 다음 배포까지 옛 목록이 나간다.
 */
export const dynamic = 'force-dynamic'

const LIMIT = 30

export async function GET() {
  await ensureSeeded()
  const db = await getDb()

  /*
   * **미래 발행분은 뺀다.** 자동 발행이 막힐 때를 대비해 다음 날 것을 미리
   * 뽑아 두는데, 그것이 피드에 실리면 홈에는 없는 질문이 구독자에게 먼저 간다.
   */
  const rows = await db.query<{
    slug: string
    title: string
    category: string
    summary: string
    date: string
  }>(
    `select t.slug,
            n.normalized_question as title,
            n.primary_category    as category,
            split_part(n.body, E'\n\n', 1) as summary,
            to_char(t.publish_date, 'YYYY-MM-DD') as date
       from tree t
       join qnode n on n.id = t.root_node_id
      where t.kind = 'daily'
        and n.status = 'ready'
        and t.publish_date <= $1::date
      order by t.publish_date desc
      limit ${LIMIT}`,
    [kstToday()],
  )

  const items: FeedItem[] = rows.map((r) => ({
    title: r.title,
    link: `${SITE_URL}/t/${r.slug}`,
    /* 분야를 앞에 붙인다. 읽기 도구는 제목만 늘어놓아 무엇에 대한 것인지 안 보인다 */
    description: `[${r.category}] ${r.summary}`,
    date: r.date,
    guid: r.slug,
  }))

  return new Response(
    buildRss({
      siteUrl: SITE_URL,
      title: 'CS 길라잡이 — 오늘의 질문',
      description: '하루에 CS 면접 질문 하나. 궁금한 곳으로 계속 파고들 수 있다.',
      items,
    }),
    {
      headers: {
        'content-type': 'application/rss+xml; charset=utf-8',
        /* 하루 한 번 바뀌는 문서다. 10분 캐시면 아침 발행이 늦어도 곧 따라온다 */
        'cache-control': 'public, max-age=600, s-maxage=600',
      },
    },
  )
}
