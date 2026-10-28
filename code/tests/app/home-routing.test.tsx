// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import Home, { metadata } from '@/app/(study)/page'
import HomeLayout from '@/app/(study)/layout'
import config from '../../next.config'
import { learningPages, learningJsonLd, learningMetadata } from '@/lib/seo/learning'
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/db/client', () => ({ getDb: () => { throw new Error('Root must not open a database') } }))
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: () => { throw new Error('Root must not seed') } }))

it('renders the integrated root home without the legacy CS shell or database preparation', () => {
  const html = renderToString(<HomeLayout><Home /></HomeLayout>)
  expect(html).toContain('PM·CS 학습 길라잡이')
  expect(html).toContain('href="/learn/library"')
  expect(html).toContain('href="/cs"')
  expect(html).not.toContain('오늘 질문부터')
  expect(new URL(metadata.alternates!.canonical as string).pathname).toBe('/')
  expect(new URL(learningMetadata('/cs').alternates!.canonical as string).pathname).toBe('/cs')
})
it('retains an exact permanent alias without capturing lessons or private records', async () => {
  const redirects = await config.redirects!()
  expect(redirects).toContainEqual({ source: '/learn', destination: '/', permanent: true })
  expect(redirects.some(r => r.source === '/learn/:path*')).toBe(false)
  expect(learningPages.some(p => p.path === '/learn')).toBe(false)
  expect(learningPages.some(p => p.path === '/cs')).toBe(true)
  const graph = learningJsonLd('/')!['@graph']
  expect(graph.some(node => node['@type'] === 'WebSite')).toBe(true)
})
