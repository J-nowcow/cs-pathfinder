/**
 * 오늘의 질문을 구독으로 받는 길.
 *
 * 매일 하나씩 올라오는데 **다시 올 이유가 사용자 기억뿐이었다.** 알림도 메일도
 * 없다. 카카오톡 채널은 사업자 등록과 채널 개설이 앞에 있어 지금 못 연다.
 *
 * RSS는 지금 열 수 있다. 서버가 XML 한 장을 만들면 끝이고, 계정도 비밀도
 * 필요 없다. 이 서비스를 볼 사람들은 대개 읽기 도구를 하나쯤 쓴다.
 *
 * XML을 손으로 만든다. 라이브러리를 하나 더 들이기에는 만들 것이 너무 적고,
 * **여기서 위험한 것은 문법이 아니라 escape**다. 질문에 `<`나 `&`가 들어가면
 * 문서가 통째로 깨진다. 그래서 escape만 따로 시험한다.
 */
export type FeedItem = {
  title: string
  link: string
  description: string
  /** 'YYYY-MM-DD' (KST) */
  date: string
  guid: string
}

/**
 * XML에서 뜻을 갖는 다섯 글자를 막는다.
 *
 * `&`를 **맨 먼저** 바꿔야 한다. 나중에 바꾸면 앞서 넣은 `&lt;`의 `&`까지
 * 다시 바뀌어 `&amp;lt;`가 된다.
 */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * RSS의 `pubDate`는 RFC 822 모양이어야 한다.
 *
 * `toUTCString()`을 그냥 쓰면 `GMT`로 끝나는데 그것도 유효하다. 다만 발행은
 * KST 기준이라 `+0900`으로 적어야 읽기 도구가 날짜를 하루 당기거나 밀지 않는다.
 *
 * 시각은 **발행 시각(오전 6시 KST)** 으로 둔다. 자정으로 두면 도구에 따라
 * 전날로 보이는 자리가 생긴다.
 */
export function rfc822(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d))
  const wd = DAYS[at.getUTCDay()]
  const mon = MONTHS[at.getUTCMonth()]
  return `${wd}, ${String(d).padStart(2, '0')} ${mon} ${y} 06:00:00 +0900`
}

export function buildRss(opts: {
  siteUrl: string
  title: string
  description: string
  items: FeedItem[]
}): string {
  const self = `${opts.siteUrl}/rss.xml`
  const body = opts.items
    .map(
      (it) =>
        `    <item>\n` +
        `      <title>${escapeXml(it.title)}</title>\n` +
        `      <link>${escapeXml(it.link)}</link>\n` +
        `      <guid isPermaLink="false">${escapeXml(it.guid)}</guid>\n` +
        `      <pubDate>${rfc822(it.date)}</pubDate>\n` +
        `      <description>${escapeXml(it.description)}</description>\n` +
        `    </item>`,
    )
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>${escapeXml(opts.title)}</title>\n` +
    `    <link>${escapeXml(opts.siteUrl)}</link>\n` +
    `    <description>${escapeXml(opts.description)}</description>\n` +
    `    <language>ko</language>\n` +
    `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />\n` +
    (body ? `${body}\n` : '') +
    `  </channel>\n` +
    `</rss>\n`
  )
}
