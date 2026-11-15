import { PGlite } from '@electric-sql/pglite'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { countGroups } from '@/lib/certificate/count-groups'
import { CertificateCountGroups } from '@/components/certificate/CertificateCountGroups'

it('executes the displayed five-row SELECT with duplicate values and a NULL grouping key', async () => {
  const db = new PGlite()
  try {
    expect(countGroups.sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i)
    expect(Math.max(...countGroups.sql.split('\n').map(line => line.length))).toBeLessThanOrEqual(75)
    const result = await db.query<Record<string, unknown>>(countGroups.sql)
    expect(result.rows.map(row => countGroups.headers.map(key => row[key]))).toEqual(countGroups.rows)
    expect(result.rows).toHaveLength(3)
    const transfer = await db.query<Record<string, unknown>>(countGroups.transferSql)
    expect(transfer.rows.map(row => countGroups.headers.map(key => row[key]))).toEqual(countGroups.transferRows)
    expect((await db.query(countGroups.emptyGroupedSql)).rows).toEqual([])
    expect((await db.query(countGroups.emptyOverallSql)).rows).toEqual([{ all_rows: 0, known_pages: 0, distinct_pages: 0 }])
  } finally { await db.close() }
})

it('provides optional native disclosure and readable source-linked content without client scoring', () => {
  const html = renderToStaticMarkup(<CertificateCountGroups />)
  expect(html).toContain('id="lesson-count-groups"')
  expect(html).toContain('href="#lesson-count-groups"')
  expect(html).toContain('<summary>결과와 해설 보기</summary>')
  expect(html).toContain('<summary>변경한 입력의 답과 이유 보기</summary>')
  expect(html).not.toMatch(/<details[^>]*\bopen\b|<input|<button|<script/)
  expect(html.indexOf('먼저 결과가 몇 행인지')).toBeLessThan(html.indexOf('<details>'))
  expect(html).toContain('위의 books 4행과 다른 창작 입력 5행')
  expect(html).toContain('자동 채점은 하지 않는다')
  expect(html).toContain('숙련도를 평가하지 않는다')
  expect(html).toContain('scope="col"')
  for (const source of countGroups.sources) expect(html).toContain(`href="${source.url}"`)
})
