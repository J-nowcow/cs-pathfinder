import type { Cell } from './course'

const input = `WITH sample(shelf_code, pages) AS (
  VALUES ('DB', 120), ('DB', 120), ('SW', NULL),
         (NULL, 80), (NULL, NULL)
)`
const projection = `SELECT shelf_code,
       COUNT(*) AS all_rows,
       COUNT(pages) AS known_pages,
       COUNT(DISTINCT pages) AS distinct_pages,
       COUNT(shelf_code) AS known_shelves
FROM sample`
const grouping = `GROUP BY shelf_code
ORDER BY shelf_code NULLS LAST;`

export const countGroups = {
  sql: `${input}
${projection}
${grouping}`,
  headers: [
    'shelf_code', 'all_rows', 'known_pages',
    'distinct_pages', 'known_shelves',
  ],
  rows: [
    ['DB', 2, 2, 1, 2],
    ['SW', 1, 0, 0, 1],
    [null, 2, 1, 1, 0],
  ] as Cell[][],
  emptyGroupedSql: `${input}
${projection}
WHERE FALSE
${grouping}`,
  emptyOverallSql: `${input}
SELECT COUNT(*) AS all_rows,
       COUNT(pages) AS known_pages,
       COUNT(DISTINCT pages) AS distinct_pages
FROM sample WHERE FALSE;`,
  transferSql: `${input.replace('(NULL, 80)', "('DB', 80)")}
${projection}
${grouping}`,
  transferRows: [
    ['DB', 3, 3, 2, 3],
    ['SW', 1, 0, 0, 1],
    [null, 1, 0, 0, 0],
  ] as Cell[][],
  sources: [
    {
      title: 'PostgreSQL 18 · GROUP BY와 그룹별 결과',
      url: 'https://www.postgresql.org/docs/18/queries-table-expressions.html#QUERIES-GROUP',
    },
    {
      title: 'PostgreSQL 18 · 집계식과 DISTINCT·NULL',
      url: 'https://www.postgresql.org/docs/18/sql-expressions.html#SYNTAX-AGGREGATES',
    },
  ],
}
