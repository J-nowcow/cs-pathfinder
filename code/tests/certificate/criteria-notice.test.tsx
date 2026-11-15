import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CertificateLesson from '@/app/(study)/learn/certificate/[lesson]/page'
import { CertificateCriteriaNotice } from '@/components/certificate/CertificateCriteriaNotice'
import { certificateSyllabus as source, certificateCriteriaPeriod } from '@/lib/certificate/syllabus'

it('labels the displayed subject/unit criteria with the source-derived period on direct lessons', () => {
  const html = renderToStaticMarkup(<CertificateCriteriaNotice />)
  expect(html).toContain(certificateCriteriaPeriod.dates)
  expect(certificateCriteriaPeriod.dates).toBe(`${source.source.validFrom}~${source.source.validThrough}`)
  expect(html).toContain('이 수업의 과목·단원은')
  expect(html).toContain('목차에 따라 표시했습니다')
  expect(html).toContain('응시 예정일에 맞는 기준인지')
  expect(html.replaceAll('&amp;', '&')).toContain(`href="${source.source.url}"`)
  expect(html).not.toMatch(/2026년 기준|개념의 유효기간|<script/)
})

it('renders criteria before the article on direct lessons and adds grouped practice only to count-null', async () => {
  for (const lesson of ['count-null', 'input-validation-trust-boundary']) {
    const html = renderToStaticMarkup(await CertificateLesson({
      params: Promise.resolve({ lesson }),
    }))
    const notice = html.indexOf('이 수업의 과목·단원은')
    const article = html.indexOf('<article')
    expect(notice).toBeGreaterThanOrEqual(0)
    expect(article).toBeGreaterThan(notice)
    expect(html.slice(notice, article)).toContain(certificateCriteriaPeriod.dates)
    expect(html.slice(notice, article).replaceAll('&amp;', '&')).toContain(`href="${source.source.url}"`)
    if (lesson === 'count-null') {
      expect(html).toContain('id="lesson-count-groups"')
      expect(html).toContain('SELECT COUNT(*) AS all_rows,')
      expect(html).toContain('쪽수가 NULL인 책을 80쪽으로 수정하면')
    } else {
      expect(html).not.toContain('id="lesson-count-groups"')
      expect(html).not.toContain('<summary>결과와 해설 보기</summary>')
    }
  }
})
