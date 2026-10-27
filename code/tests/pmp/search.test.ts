import { expect, it } from 'vitest'
import { pmpCourse, pmpOrder } from '@/lib/pmp/course'
import { pmpSearchText, searchPmpLessons } from '@/lib/pmp/search'

it('finds all lessons by their titles, without duplicate results, and ranks title matches first', () => {
  for (const n of pmpCourse.nodes) {
    const results = searchPmpLessons(n.title).results
    expect(results.some((r) => r.id === n.id)).toBe(true)
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length)
    expect(results[0].rank).toBe(0)
  }
  const results = searchPmpLessons('여유').results
  for (const rank of [0, 1, 2]) {
    const orders = results
      .filter((r) => r.rank === rank)
      .map((r) => pmpOrder.indexOf(r.id))
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  }
})
it('finds body-only concepts, supplementary evidence, comparison tables and rendered term aliases', () => {
  expect(
    searchPmpLessons('음수 여유').results.some((r) => r.id === 'n44'),
  ).toBe(true)
  const rich = searchPmpLessons('B-07').results.find((r) => r.id === 'n41')!
  expect(rich.snippet).toContain('B-07')
  expect(rich.snippet).not.toMatch(/<\/?(?:section|p|div|table)\b/)
  expect(
    searchPmpLessons('Free float').results.some((r) => r.id === 'n44'),
  ).toBe(true)
  expect(searchPmpLessons('cPi').results.some((r) => r.id === 'n35')).toBe(true)
})
it('uses literal case-insensitive AND tokens with whitespace/NFC normalization', () => {
  expect(searchPmpLessons('  CPI\t\n EV  ').results.map((r) => r.id)).toEqual(
    searchPmpLessons('cpi ev').results.map((r) => r.id),
  )
  expect(searchPmpLessons('여유'.normalize('NFD')).results).toEqual(
    searchPmpLessons('여유').results,
  )
  expect(searchPmpLessons('CPI not-a-course-word-49281').results).toEqual([])
  for (const query of [
    '[.*]',
    '<script>alert(1)</script>',
    '\\d+',
    'no-matching-49281',
  ])
    expect(searchPmpLessons(query).results).toEqual([])
})
it('rejects ambiguous and oversized URL queries and treats blank input as a prompt', () => {
  expect(searchPmpLessons(['CPI', 'SPI'])).toEqual({
    query: '',
    error: 'multiple',
    results: [],
  })
  const long = searchPmpLessons('x'.repeat(121))
  expect(long.error).toBe('long')
  expect(long.query).toHaveLength(120)
  expect(long.results).toEqual([])
  for (const raw of [undefined, '', ' \n\t '])
    expect(searchPmpLessons(raw).results).toEqual([])
})
it('does not find choice-only text or an unrelated private memo phrase', () => {
  const choice = pmpCourse.nodes[0].options[0].text
  expect(searchPmpLessons(choice).results.some((r) => r.id === 'n01')).toBe(
    false,
  )
  // No localStorage, API or user-supplied record source enters this public index.
  expect(
    searchPmpLessons('Synthetic private memo secret 49281').results,
  ).toEqual([])
})
it('decodes authored HTML entities as plain text, preserves text boundaries and handles invalid code points', () => {
  expect(
    pmpSearchText(
      '<p>PV &lt; EV</p><p>A&amp;B &#xD55C;&#44544; &nbsp; &#0; &#xD800;</p>',
    ),
  ).toBe('PV < EV A&B 한글')
})
