import type { Cell } from './course'

/** Display notation only. The source rows and SQL values remain unchanged. */
export function conversionDisplayRows(headers: string[], rows: Cell[][]): Cell[][] {
  const rawColumns = new Set(headers.flatMap((header, index) =>
    header === 'raw_qty' || header === 'raw_zone' ? [index] : [],
  ))
  return rows.map(row => row.map((value, index) => {
    if (!rawColumns.has(index) || typeof value !== 'string') return value
    // Escape a literal marker first so it cannot be confused with a space.
    return JSON.stringify(value).replace(/␠/g, '\\u2420').replace(/ /g, '␠')
  }))
}
