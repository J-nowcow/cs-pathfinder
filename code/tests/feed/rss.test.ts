import { describe, it, expect } from 'vitest'
import { buildRss, escapeXml, rfc822, type FeedItem } from '@/lib/feed/rss'

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  title: '오늘의 질문',
  link: 'https://example.com/t/daily-2026-08-08',
  description: '설명',
  date: '2026-08-08',
  guid: 'daily-2026-08-08',
  ...over,
})

describe('XML 막기', () => {
  /*
   * 질문에 `<`나 `&`가 들어가면 문서가 통째로 깨진다. 읽기 도구는 대개
   * 조용히 아무것도 안 보여준다 -- 그래서 눈으로 안 잡힌다.
   */
  it('다섯 글자를 전부 막는다', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  /* `&`를 나중에 바꾸면 앞서 넣은 `&lt;`가 `&amp;lt;`가 된다 */
  it('앰퍼샌드를 두 번 바꾸지 않는다', () => {
    expect(escapeXml('<')).toBe('&lt;')
    expect(escapeXml('&lt;')).toBe('&amp;lt;')
  })

  it('제목에 든 꺾쇠가 문서를 안 깬다', () => {
    const xml = buildRss({
      siteUrl: 'https://example.com',
      title: 't',
      description: 'd',
      items: [item({ title: 'Array<T>와 List<T>는 무엇이 다른가?' })],
    })
    expect(xml).toContain('Array&lt;T&gt;와 List&lt;T&gt;')
    expect(xml).not.toContain('<title>Array<T>')
  })
})

describe('발행 시각', () => {
  /* 2026-08-08은 토요일이다 */
  it('RFC 822 모양으로 적는다', () => {
    expect(rfc822('2026-08-08')).toBe('Sat, 08 Aug 2026 06:00:00 +0900')
  })

  /*
   * 자정으로 두면 시간대에 따라 전날로 보인다. 발행 시각인 오전 6시로 둔다.
   * `+0900`을 빼면 읽기 도구가 KST 날짜를 하루 당긴다.
   */
  it('KST 오프셋을 적는다', () => {
    expect(rfc822('2026-01-01')).toContain('+0900')
    expect(rfc822('2026-01-01')).toContain('06:00:00')
  })

  it('한 자리 날짜를 0으로 채운다', () => {
    expect(rfc822('2026-01-05')).toBe('Mon, 05 Jan 2026 06:00:00 +0900')
  })
})

describe('피드 문서', () => {
  const xml = buildRss({
    siteUrl: 'https://example.com',
    title: 'CS 길라잡이',
    description: '하루에 질문 하나',
    items: [item(), item({ guid: 'daily-2026-08-07', date: '2026-08-07' })],
  })

  it('선언과 채널을 갖춘다', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain('<language>ko</language>')
  })

  /* 자기 주소를 안 적으면 일부 도구가 구독 갱신을 못 한다 */
  it('자기 주소를 적는다', () => {
    expect(xml).toContain('href="https://example.com/rss.xml" rel="self"')
  })

  it('항목을 준 만큼 담는다', () => {
    expect(xml.match(/<item>/g)?.length).toBe(2)
  })

  /*
   * guid가 겹치면 읽기 도구가 같은 글로 보고 새 것을 안 띄운다. 날짜를
   * 쓰므로 겹칠 수 없지만, 그것을 시험으로 걸어 둔다.
   */
  it('항목마다 다른 guid를 갖는다', () => {
    const ids = [...xml.matchAll(/isPermaLink="false">([^<]+)</g)].map((m) => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('항목이 없어도 문서는 성립한다', () => {
    const empty = buildRss({ siteUrl: 'https://example.com', title: 't', description: 'd', items: [] })
    expect(empty).toContain('</channel>')
    expect(empty).not.toContain('<item>')
  })
})
