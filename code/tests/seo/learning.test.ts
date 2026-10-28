import { describe, it, expect, vi } from 'vitest'
import { learningPages, learningMetadata, learningJsonLd, learningBreadcrumbs, renderLearningLinks, renderLearningSitemap } from '@/lib/seo/learning'
import { pmpCourse } from '@/lib/pmp/course'
import certificate from '../../learning-content/certificate/course.json'
import guides from '../../data/engineer-guides.json'

describe('public learning discovery coverage', () => {
  it('covers every actual native lesson and case, retaining editorial titles', () => {
    const paths = new Map(learningPages.map((p) => [p.path, p]))
    for (const n of pmpCourse.nodes) expect(paths.get('/learn/pmp/' + n.id)?.title).toBe(n.title)
    for (const n of pmpCourse.cases) expect(paths.get('/learn/pmp/case/' + n.id)?.title).toBe(n.title)
    for (const n of certificate.lessons) expect(paths.get('/learn/certificate/' + n.id)?.title).toBe(n.title)
    for (const n of guides) expect(paths.get('/learn/engineer/' + n.id)?.title).toBe(n.title)
    expect(paths.size).toBe(74 + 3 + 16 + 24 + 6)
  })
  it('publishes only canonical content paths, never records, query parameters, fragments or retired editions', () => {
    for (const p of learningPages) {
      expect(p.path).not.toMatch(/\?|#|\/library|\/progress|\/search|^\/pmp\//)
      expect(p.description).not.toMatch(/<[^>]+>/)
      expect(p.description.length).toBeGreaterThan(0)
    }
    for (const forbidden of ['/learn/library', '/learn/progress', '/learn/pmp/search', '/pmp/index.html']) {
      expect(renderLearningSitemap('https://example.test')).not.toContain('<loc>https://example.test' + forbidden + '</loc>')
      expect(renderLearningLinks('https://example.test').join('\n')).not.toContain('](' + 'https://example.test' + forbidden + ')')
    }
  })
  it('uses topic-specific copy and identical canonical/OG/structured-data URLs', () => {
    for (const p of learningPages) {
      const meta = learningMetadata(p.path)
      const canonical = (meta.alternates as { canonical: string }).canonical
      expect(new URL(canonical).pathname).toBe(p.path)
      expect(meta.description).toBe(p.description)
      expect(meta.openGraph).toMatchObject({ url: canonical, description: p.description })
      const ld = learningJsonLd(p.path)!['@graph'][0]
      expect(ld).toMatchObject({ url: canonical, description: p.description, inLanguage: 'ko' })
      expect(JSON.stringify(ld)).not.toMatch(/QAPage|aggregateRating|dateModified|datePublished/)
    }
    expect(learningMetadata('/learn/pmp/n01').title).toBe('산출물·성과·편익 · PMP')
    expect(learningMetadata('/learn/certificate/keys').title).toContain('정보처리기사')
  })
  it('describes actual navigation with no invented breadcrumb levels or invalid-page markup', () => {
    expect(learningBreadcrumbs('/learn/pmp/n01').map((p) => p.path)).toEqual(['/learn', '/learn/pmp', '/learn/pmp/n01'])
    for (const p of learningPages) {
      const chain = learningBreadcrumbs(p.path)
      expect(new Set(chain.map((n) => n.path)).size).toBe(chain.length)
    }
    expect(learningJsonLd('/learn/pmp/unknown')).toBeNull()
    expect(learningMetadata('/learn/pmp/unknown').robots).toMatchObject({ index: false })
  })
  it('serves the static learning sitemap even if any database access would fail', async () => {
    vi.doMock('@/lib/db/client', () => ({ getDb: () => { throw new Error('DB must stay asleep') } }))
    const { GET, dynamic } = await import('@/app/learn/sitemap.xml/route')
    expect(dynamic).toBe('force-static')
    const response = GET(), xml = await response.text()
    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(xml.match(/<loc>/g)).toHaveLength(123)
    expect(xml).not.toContain('<lastmod>')
    vi.doUnmock('@/lib/db/client')
  })
})
