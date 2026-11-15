import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { certificateLessons } from '@/lib/certificate/course'
import { conversionDisplayRows } from '@/lib/certificate/conversion-display'
import { CertificateTable } from '@/components/certificate/CertificateTable'

it('shows raw spaces and empty strings distinctly without changing the source result rows', () => {
  const example = certificateLessons.get('data-conversion-reconciliation')!.example
  const original = structuredClone(example.rows!)
  const displayed = conversionDisplayRows(example.headers!, example.rows!)
  expect(example.rows![0]).toEqual(['S01', ' 12 ', ' a ', 12, 'A', 'ready'])
  expect(example.rows![1]).toEqual(['S02', '0', ' ', 0, null, 'ready'])
  expect(example.rows![2]).toEqual(['S03', '', 'b', null, null, 'held:required'])
  expect(displayed.map(row => row.slice(1, 3))).toEqual([
    ['"␠12␠"', '"␠a␠"'], ['"0"', '"␠"'], ['""', '"b"'],
    ['"8.5"', '"c"'], ['"1000000"', '"d"'], ['"0007"', '"␠e␠"'],
    [null, '"f"'], ['"5"', '"?"'],
  ])
  for (let i = 0; i < displayed.length; i++) {
    expect([displayed[i][0], ...displayed[i].slice(3)]).toEqual([original[i][0], ...original[i].slice(3)])
  }
  expect(example.rows).toEqual(original)
  expect(example.verification).toContain('ASCII 공백(U+0020)')
  expect(example.verification).toContain('빈 문자열')
  expect(example.verification).toContain('SQL NULL')
})

it('keeps SQL NULL, the text NULL, zero, literal space markers and escaped controls distinct', () => {
  const raw = [[null], ['NULL'], [0], ['0'], [' '], [''], ['␠'], ['\\u2420'], ['a\tb\nc']]
  const result = conversionDisplayRows(['raw_qty'], raw)
  expect(result).toEqual([
    [null], ['"NULL"'], [0], ['"0"'], ['"␠"'], ['""'],
    ['"\\u2420"'], ['"\\\\u2420"'], ['"a\\tb\\nc"'],
  ])
  expect(new Set(result.map(row => JSON.stringify(row))).size).toBe(raw.length)
})

it('renders display notation as escaped text, leaving other columns and lesson tables alone', () => {
  const headers = ['raw_qty', 'other']
  const rows = [['<img src=x>', ' ordinary text ']]
  const html = renderToStaticMarkup(<CertificateTable caption="Synthetic display" headers={headers} rows={conversionDisplayRows(headers, rows)} />)
  expect(html).toContain('&lt;img␠src=x&gt;')
  expect(html).not.toContain('<img')
  expect(conversionDisplayRows(['other'], [[' unchanged ']])).toEqual([[' unchanged ']])
  expect(conversionDisplayRows(['raw_zone'], [['a']])).toEqual([['"a"']])
})
