import { loadEnvLocal } from '../src/lib/load-env'
import { writeFileSync, mkdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * 표만 있는 해설을 통째로 뽑는다.
 *
 * 279편 중 **167편(59.9%)이 표뿐이다.** 사용자가 "죄다 표만 있다"고 한 것의
 * 정확한 크기이고, 지금까지 고친 것은 **있는 도식을 제대로 그리게** 만든
 * 것이지 **없는 도식을 늘린** 것이 아니다.
 *
 * 표를 다 없애자는 것이 아니다. 앞선 손대조는 표 127개 중 65~76%가
 * **정당한 비교표**라고 봤다. 두 방식을 나란히 놓고 견주는 글에서 표는
 * 맞는 형태다. 표적은 나머지 30~45편 -- **순서·계층·관계인데 표로 눕힌 것**이다.
 *
 * 그래서 이 파일은 판정용이다. 여럿에게 따로 읽히고 **둘 이상이 일치한
 * 것만** 손댄다. 혼자 고르면 멀쩡한 비교표를 그림으로 만든다.
 *
 * 표만 붙은 것을 세되 **본문 전체를 담는다.** 표 두 줄만 보면 그것이 비교인지
 * 순서인지 못 가린다 -- 글이 무엇을 말하려던 것인지가 판정을 가른다.
 *
 * 실행: npm run dump:tables
 */
loadEnvLocal()

const OUT = 'docs/audit/_table-only.md'

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const r = await pool.query<{
    number: number | null
    question: string
    category: string
    body: string
  }>(
    `select number, normalized_question as question, primary_category as category,
            coalesce(body,'') as body
       from qnode order by number asc nulls last`,
  )

  const out: string[] = [
    '# 표만 있는 해설',
    '',
    '`npm run dump:tables`가 만든다. 손으로 고치지 마라 — 다시 만들면 덮인다.',
    '',
  ]
  let n = 0

  for (const row of r.rows) {
    const kinds = new Set(parseBlocks(row.body).map((b) => b.type))
    /* 도식 울타리가 하나라도 있으면 여기 관심 밖이다 */
    const hasDiagram = ['flow', 'state', 'tree', 'memory', 'timeline', 'stack'].some((k) =>
      kinds.has(k as never),
    )
    if (hasDiagram || !kinds.has('table')) continue

    n += 1
    out.push(`## #${row.number} ${row.question}`)
    out.push(`\`${row.category}\``)
    out.push('')
    out.push('```')
    out.push(row.body)
    out.push('```')
    out.push('')
  }

  out.splice(4, 0, `${n}편.`, '')
  mkdirSync('docs/audit', { recursive: true })
  writeFileSync(OUT, out.join('\n'))
  console.log(`표만 있는 해설 ${n}편 → ${OUT}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
