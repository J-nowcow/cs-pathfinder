import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { certificate as c } from '@/lib/certificate/course'
let db: PGlite
const fixture = `CREATE TABLE shelves(code TEXT PRIMARY KEY,name TEXT NOT NULL);
INSERT INTO shelves VALUES('DB','데이터'),('SW','설계');
CREATE TABLE books(book_id INTEGER PRIMARY KEY,title TEXT NOT NULL,shelf_code TEXT REFERENCES shelves(code),pages INTEGER CHECK(pages>0));
CREATE TABLE loans(loan_id INTEGER PRIMARY KEY,book_id INTEGER NOT NULL REFERENCES books(book_id));`
beforeEach(async () => {
  db = new PGlite()
  await db.exec(fixture)
  for (const row of c.books.rows)
    await db.query('INSERT INTO books VALUES($1,$2,$3,$4)', row)
  for (const row of c.loans.rows)
    await db.query('INSERT INTO loans VALUES($1,$2)', row)
})
afterEach(async () => {
  await db.close()
})
describe('독립 정처기 이론의 실제 SQL과 경계', () => {
  it('서재의 모든 예상 결과를 초기 상태에서 실행해 확인한다', async () => {
    for (const n of c.lessons) {
      if (n.domain === 'db-sql' && n.example.code && n.example.rows) {
        const result = await db.query(n.example.code)
        expect(
          result.rows.map((r) =>
            n.example.headers!.map((h) => (r as Record<string, unknown>)[h]),
          ),
          n.id,
        ).toEqual(n.example.rows)
      }
    }
    await db.exec(c.lessons.find((x) => x.id === 'indexes')!.example.code!)
    expect(
      (
        await db.query(
          "SELECT indexname FROM pg_indexes WHERE indexname='loans_book_idx'",
        )
      ).rows,
    ).toHaveLength(1)
  })
  it('외래키·CHECK·NULL·중복 참조를 실DB 의미론으로 구분한다', async () => {
    await expect(db.query('INSERT INTO loans VALUES(14,99)')).rejects.toThrow()
    await db.query('INSERT INTO loans VALUES(14,1)')
    await expect(
      db.query("INSERT INTO books VALUES(5,'새 책',NULL,0)"),
    ).rejects.toThrow()
    await db.query("INSERT INTO books VALUES(5,'새 책',NULL,NULL)")
    await expect(
      db.query('DELETE FROM books WHERE book_id=1'),
    ).rejects.toThrow()
    const isolated = new PGlite()
    try {
      await isolated.exec('CREATE TABLE shelves(code TEXT PRIMARY KEY)')
      await isolated.exec(
        c.lessons.find((n) => n.id === 'constraints')!.example.code!,
      )
      await expect(
        isolated.query('INSERT INTO books VALUES(1,NULL,NULL,10)'),
      ).rejects.toThrow()
    } finally {
      await isolated.close()
    }
  })
  it('빈 집합과 NULL을 예시 문장과 별도로 실행한다', async () => {
    expect(
      (
        await db.query(
          'SELECT 170 > ALL(SELECT pages FROM books WHERE false) AS all_empty,170 > ANY(SELECT pages FROM books WHERE false) AS any_empty,9 NOT IN (1,NULL) AS not_in',
        )
      ).rows,
    ).toEqual([{ all_empty: true, any_empty: false, not_in: null }])
    expect(
      (
        await db.query(
          'SELECT COUNT(*) AS c,SUM(pages) AS s FROM books WHERE false',
        )
      ).rows,
    ).toEqual([{ c: 0, s: null }])
    expect(
      (
        await db.query(
          "SELECT 'SQL' LIKE 'SQL%' AS zero_chars,'SQL' LIKE '_QL' AS one_char",
        )
      ).rows,
    ).toEqual([{ zero_chars: true, one_char: true }])
    expect(
      (
        await db.query(
          'SELECT b.book_id FROM books b LEFT JOIN loans l ON b.book_id=l.book_id WHERE l.loan_id IS NULL ORDER BY b.book_id',
        )
      ).rows,
    ).toEqual([{ book_id: 3 }, { book_id: 4 }])
    expect(
      (await db.query('SELECT count(*) AS c FROM books CROSS JOIN loans')).rows,
    ).toEqual([{ c: 12 }])
  })
  it('정규형 반례의 후보키를 독립 폐포 계산으로 확인한다', () => {
    const attrs = ['reader', 'topic', 'staff'],
      fds = [
        [['reader', 'topic'], ['staff']],
        [['staff'], ['topic']],
      ] as const
    const closure = (x: string[]) => {
      const set = new Set(x)
      let changed = true
      while (changed) {
        changed = false
        for (const [l, r] of fds)
          if (l.every((a) => set.has(a)))
            for (const a of r)
              if (!set.has(a)) {
                set.add(a)
                changed = true
              }
      }
      return set
    }
    const subsets = Array.from({ length: 8 }, (_, mask) =>
      attrs.filter((_, i) => mask & (1 << i)),
    )
    const keys = subsets.filter(
      (x) =>
        closure(x).size === 3 &&
        !subsets.some(
          (y) =>
            y.length < x.length &&
            y.every((a) => x.includes(a)) &&
            closure(y).size === 3,
        ),
    )
    expect(keys).toEqual([
      ['reader', 'topic'],
      ['reader', 'staff'],
    ])
    expect(closure(['staff']).size).toBe(2)
    const prime = new Set(keys.flat())
    for (const x of subsets)
      for (const a of closure(x))
        if (!x.includes(a))
          expect(closure(x).size === 3 || prime.has(a)).toBe(true)
    const interests = [
        ['하린', 'DB'],
        ['하린', 'SW'],
        ['도윤', 'DB'],
      ],
      required = ['DB', 'SW']
    expect(
      [...new Set(interests.map((x) => x[0]))].filter((name) =>
        required.every((topic) =>
          interests.some((x) => x[0] === name && x[1] === topic),
        ),
      ),
    ).toEqual(['하린'])
  })
  it('기출 파일 없이 정제한 범위와 원천 출처를 보존한다', () => {
    expect(c.lessons).toHaveLength(16)
    expect(new Set(c.lessons.map((x) => x.id)).size).toBe(16)
    expect(c.lessons.filter((x) => x.domain === 'db-sql')).toHaveLength(12)
    expect(c.origin.concepts).toHaveLength(19)
    expect(c.origin.file).toBe('concepts-theory.json')
    const sourceIds = new Set(c.sources.map((x) => x.id)),
      originIds = new Set(c.origin.concepts.map((x) => x.id))
    for (const n of c.lessons) {
      expect(n.body.length).toBeGreaterThanOrEqual(2)
      expect(n.sources.every((x) => sourceIds.has(x))).toBe(true)
      expect(n.originConceptIds.every((x) => originIds.has(x))).toBe(true)
      expect(n.comparison.every((row) => row.length === 3)).toBe(true)
    }
    for (const s of c.sources) {
      expect(s.url.startsWith('https://')).toBe(true)
      expect(s.checked).toBe('2026-10-28')
    }
    expect(JSON.stringify(c)).not.toMatch(
      /authentic-20|solutions-.*json|practice-.*json|sources\/authentic|<iframe|<img|<script/,
    )
  })
})
