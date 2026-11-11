import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CertificateLesson from '@/app/(study)/learn/certificate/[lesson]/page'
import { certificate, certificateLessons } from '@/lib/certificate/course'

const renderLesson = async (lesson: string) => renderToStaticMarkup(
  await CertificateLesson({ params: Promise.resolve({ lesson }) }),
)

describe('certificate lesson source provenance', () => {
  it('keeps inherited concept titles and their source links on every existing linked lesson', async () => {
    const inherited = certificate.lessons.filter(lesson => certificate.origin.concepts.some(
      concept => lesson.originConceptIds.includes(concept.id),
    ))
    expect(inherited.length).toBeGreaterThan(0)
    for (const lesson of inherited) {
      const html = await renderLesson(lesson.id)
      expect(html).toContain('<summary>이전 개념 자료와의 연결</summary>')
      for (const concept of certificate.origin.concepts.filter(value => lesson.originConceptIds.includes(value.id))) {
        expect(html).toContain(concept.title)
        for (const source of concept.sources) {
          expect(html.replaceAll('&amp;', '&')).toContain(`href="${source.url}"`)
        }
      }
    }
  })

  it('shows independent lesson references without claiming inherited sources when none exist', async () => {
    const independent = certificate.lessons.filter(lesson => lesson.originConceptIds.length === 0)
    expect(independent.length).toBeGreaterThan(0)
    for (const lesson of independent) {
      const html = await renderLesson(lesson.id)
      expect(html).not.toContain('<summary>이전 개념 자료와의 연결</summary>')
      expect(html).not.toContain('이전 자료에서 다룬 주제를 이어받아')
      for (const source of certificate.sources.filter(value => lesson.sources.includes(value.id))) {
        expect(html.replaceAll('&amp;', '&')).toContain(`href="${source.url}"`)
      }
    }
  })

  it('does not turn an unresolved origin identifier into an inheritance claim', async () => {
    const lesson = certificateLessons.get('requirements-traceability')!
    const original = lesson.originConceptIds
    try {
      lesson.originConceptIds = ['synthetic-unresolved-origin']
      const html = await renderLesson(lesson.id)
      expect(html).not.toContain('<summary>이전 개념 자료와의 연결</summary>')
      expect(html).not.toContain('이전 자료에서 다룬 주제를 이어받아')
    } finally {
      lesson.originConceptIds = original
    }
  })
})
