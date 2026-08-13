import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * 검색 엔진에게 무엇이 있는지 알리는 자리.
 *
 * 전에는 `/robots.txt`도 `/sitemap.xml`도 **404**였다. 질문 251개가 각각
 * 색인 가능한 상태로 이미 만들어져 있었는데(완전 서버 렌더 · 질문마다 다른
 * 제목과 설명) 그것이 있다고 알려줄 방법이 없었다. 구글 색인 0건.
 *
 * 홍보를 한 적이 없으니 사람이 들어올 길은 검색뿐인데 그 길의 표지판이
 * 안 서 있었다.
 */
const ENTRIES = [
  { id: 'aaa', question: '질문 A', category: '네트워크', publishDate: '2026-08-01' },
  { id: 'bbb', question: '질문 B', category: '운영체제', publishDate: null },
]

beforeEach(() => {
  vi.resetModules()
  process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.NEXT_PUBLIC_SITE_URL
})

async function loadSitemap(catalog: () => Promise<unknown>) {
  vi.doMock('@/lib/db/bootstrap', () => ({ ensureSeeded: async () => {} }))
  vi.doMock('@/lib/db/catalog', () => ({ loadCatalog: catalog }))
  return (await import('@/app/sitemap')).default()
}

describe('sitemap', () => {
  it('질문 하나하나를 주소로 내놓는다', async () => {
    const map = await loadSitemap(async () => ({ date: '2026-08-07', entries: ENTRIES, byCategory: [] }))
    const urls = map.map((m) => m.url)
    expect(urls).toContain('https://example.test/q/aaa')
    expect(urls).toContain('https://example.test/q/bbb')
  })

  it('주요 화면도 함께 넣는다', async () => {
    const map = await loadSitemap(async () => ({ date: '', entries: [], byCategory: [] }))
    const urls = map.map((m) => m.url)
    expect(urls).toContain('https://example.test')
    expect(urls).toContain('https://example.test/questions')
    expect(urls).toContain('https://example.test/map')
    expect(urls).toContain('https://example.test/glossary')
  })

  it('용어별 면접 질문 입구를 함께 알린다', async () => {
    const map = await loadSitemap(async () => ({ date: '', entries: [], byCategory: [] }))
    const urls = map.map((m) => m.url)
    expect(urls).toContain(`https://example.test/concept/${encodeURIComponent('멱등성')}`)
    expect(urls.filter((url) => url.includes('/concept/'))).toHaveLength(75)
  })

  /*
   * 공유 트리는 사용자가 판 경로라 내용이 우리 것이 아니다. 지금 하나뿐이기도 하다.
   */
  it('공유 트리는 넣지 않는다', async () => {
    const map = await loadSitemap(async () => ({ date: '', entries: ENTRIES, byCategory: [] }))
    expect(map.some((m) => m.url.includes('/t/'))).toBe(false)
  })

  /*
   * **여기서 던지면 sitemap이 통째로 500이 되고 위의 세 주소도 못 알린다.**
   * 부팅 직후나 마이그레이션 전이면 표가 없을 수 있다.
   */
  it('질문을 못 읽어도 주요 화면은 내놓는다', async () => {
    const missing = Object.assign(new Error('relation "qnode" does not exist'), { code: '42P01' })
    const map = await loadSitemap(async () => {
      throw missing
    })
    expect(map.map((m) => m.url)).toContain('https://example.test/questions')
  })

  /* 표가 없는 것 말고 다른 고장은 삼키지 않는다. 조용히 반쪽 sitemap이 나가면 안 된다 */
  it('다른 고장은 삼키지 않는다', async () => {
    await expect(
      loadSitemap(async () => {
        throw new Error('connection refused')
      }),
    ).rejects.toThrow('connection refused')
  })
})

describe('robots', () => {
  it('sitemap 자리를 알려준다', async () => {
    const robots = (await import('@/app/robots')).default()
    expect(robots.sitemap).toBe('https://example.test/sitemap.xml')
  })

  /* `/api/`는 사람이 읽을 화면이 아니고 같은 내용이 `/q/…`에 제대로 된 모양으로 있다 */
  it('API는 색인에서 뺀다', async () => {
    const robots = (await import('@/app/robots')).default()
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules
    expect(rule.disallow).toContain('/api/')
    expect(rule.allow).toBe('/')
  })
})
