import type { Metadata } from 'next'
import pages from '../../../data/learning-search.json'
import { siteUrl, socialMeta, SITE_NAME } from '@/lib/site'

export const learningPages = pages
const byPath = new Map(pages.map((page) => [page.path, page]))
export function learningPage(path: string) { return byPath.get(path) }

export function learningMetadata(path: string): Metadata {
  const page = byPath.get(path)
  if (!page) return { robots: { index: false, follow: true } }
  const subject = path.startsWith('/learn/pmp/') ? 'PMP'
    : path.startsWith('/learn/certificate/') ? '정보처리기사'
      : path.startsWith('/learn/engineer/') ? '정보관리기술사' : ''
  const title = page.article && subject ? `${page.title} · ${subject}` : page.title
  const url = new URL(path, siteUrl()).href
  const social = socialMeta({ title, description: page.description, type: page.article ? 'article' : 'website' })
  return {
    ...social,
    description: page.description,
    alternates: { canonical: url, types: { 'application/rss+xml': '/rss.xml' } },
    openGraph: { ...social.openGraph, url },
  }
}

export function learningBreadcrumbs(path: string) {
  const current = byPath.get(path)
  if (!current) return []
  const chain = [current]
  let parent = current.parent && byPath.get(current.parent)
  while (parent) {
    chain.unshift(parent)
    parent = parent.parent && byPath.get(parent.parent)
  }
  return chain
}

export function learningJsonLd(path: string) {
  const page = byPath.get(path)
  if (!page) return null
  const base = siteUrl(), url = new URL(path, base).href
  const chain = learningBreadcrumbs(path)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': page.article ? 'Article' : 'CollectionPage', '@id': url, url,
        ...(page.article ? { headline: page.title, mainEntityOfPage: url, isAccessibleForFree: true } : { name: page.title }),
        description: page.description, inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', '@id': new URL('/#website', base).href, name: SITE_NAME } },
      ...(chain.length > 1 ? [{ '@type': 'BreadcrumbList',
        itemListElement: chain.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, item: new URL(p.path, base).href })) }] : []),
    ],
  }
}

export function renderLearningLinks(base: string): string[] {
  return ['## PM·CS 학습 서재', '', ...pages.map((p) =>
    `- [${p.title.replace(/[\[\]\n]/g, ' ')}](${new URL(p.path, base).href}): ${p.description}`), '']
}

export function renderLearningSitemap(base: string): string {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    + pages.map((p) => '<url><loc>' + escape(new URL(p.path, base).href) + '</loc></url>').join('')
    + '</urlset>\n'
}
