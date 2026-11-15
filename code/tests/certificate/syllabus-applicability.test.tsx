import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import source from '../../learning-content/certificate/syllabus.json'
import { certificate } from '@/lib/certificate/course'
import { certificateHref } from '@/lib/certificate/routes'
import { CertificateSyllabus } from '@/components/certificate/CertificateSyllabus'
import { certificateLocation } from '@/lib/certificate/syllabus'

describe('certificate criteria applicability and existing lesson navigation', () => {
  it('states the exact criteria validity period beside a source link before showing subject counts, including without client JavaScript', () => {
    const html = renderToStaticMarkup(<CertificateSyllabus />)
    const period = `${source.source.validFrom}~${source.source.validThrough}`
    const applicability = html.indexOf(`시험 적용기간: ${period}`)
    const subjectCounts = html.indexOf(`필기 ${source.written.subjects.length}과목`)
    expect(applicability).toBeGreaterThan(-1)
    expect(subjectCounts).toBeGreaterThan(applicability)
    expect(html.slice(applicability, subjectCounts).replaceAll('&amp;', '&')).toContain(`href="${source.source.url}"`)
    expect(html.slice(applicability, subjectCounts)).toContain('응시 예정일에 맞는')
    expect(html).toContain(`${source.written.questions}문항`)
    expect(html).toContain(`${source.written.minutes}분`)
    expect(html).toContain(`실기 ${source.practical.title} · ${source.practical.units.length}개 주요항목`)
    expect(html).toContain(source.coverageNotice)
    expect(html).toContain(source.mappingNotice)
  })

  it('preserves every authored lesson link and subject/unit location while labeling linked units as partial', () => {
    const html = renderToStaticMarkup(<CertificateSyllabus />)
    for (const lesson of certificate.lessons) {
      const location = certificateLocation(lesson.id)
      expect(location, lesson.id).toBeDefined()
      expect(location!.unit.lessons).toContain(lesson.id)
      expect(html).toContain(`href="${certificateHref(lesson.id)}"`)
      expect(html).toContain(`id="certificate-unit-${location!.unit.id}"`)
    }
    expect(html).toContain('읽을 수 있는 기초 개념 · 단원 일부')
    expect(html).toContain('목차 정리 · 본문 미작성')
  })
})
