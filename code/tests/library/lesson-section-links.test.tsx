// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import PmpLesson from '@/app/(study)/learn/pmp/[lesson]/page'
import CertificateLesson from '@/app/(study)/learn/certificate/[lesson]/page'
import TopicPage from '@/app/(study)/learn/engineer/[topic]/page'
import { pmpCourse } from '@/lib/pmp/course'
import certificate from '../../learning-content/certificate/course.json'
import guides from '../../data/engineer-guides.json'

vi.mock('@/components/library/LibraryShell', () => ({
  LibraryShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  ConceptFlow: () => null,
  libraryButton: '',
}))
vi.mock('@/components/library/StudyPractice', () => ({ StudyPractice: () => null }))
vi.mock('@/components/library/ExamBrowser', () => ({ ExamBrowser: () => null }))
vi.mock('@/components/pmp/PmpPractice', () => ({ PmpPractice: () => null }))
vi.mock('@/components/certificate/CertificatePractice', () => ({ CertificatePractice: () => null }))

function checkLinks(html: string) {
  // Existing authored SVG metadata/CSS exceeds happy-dom's HTML parser.
  // Section targets are outside figures; inspect those without changing production HTML.
  const textHtml = html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/g, '')
  const doc = new DOMParser().parseFromString(textHtml, 'text/html')
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('h2 > a[href^="#lesson-"]')]
  expect(links.length).toBeGreaterThanOrEqual(3)
  for (const link of links) {
    const id = link.getAttribute('href')!.slice(1)
    const matches = [...doc.querySelectorAll('[id]')].filter(el => el.id === id)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toBe(link.parentElement)
    expect(matches[0].getAttribute('tabindex')).toBe('-1')
    expect(link.getAttribute('aria-label')).toContain(link.parentElement!.firstChild!.textContent)
    expect(link.getAttribute('href')).not.toContain('?')
  }
  expect(doc.querySelector('h2#lesson-sources')).not.toBeNull()
}

it('server-renders unique citation targets across all native lesson branches without JavaScript', async () => {
  for (const n of pmpCourse.nodes) {
    checkLinks(renderToString(await PmpLesson({ params: Promise.resolve({ lesson: n.id }) })))
  }
  for (const n of certificate.lessons) {
    checkLinks(renderToString(await CertificateLesson({ params: Promise.resolve({ lesson: n.id }) })))
  }
  for (const g of guides) {
    checkLinks(renderToString(await TopicPage({ params: Promise.resolve({ topic: g.id }) })))
  }
})
