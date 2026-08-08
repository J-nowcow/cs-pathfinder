import { loadEnvLocal } from '../src/lib/load-env'
import { writeFileSync, mkdirSync } from 'node:fs'

/**
 * 남은 `:::stack` 전부를 **저장된 글자 그대로** 파일에 쏟는다.
 *
 * 분류를 여럿에게 따로 시키려면 같은 원문을 봐야 한다. 파서를 거친 결과를
 * 주면 파서가 고쳐 준 것(구분줄 버리기 같은)을 원본으로 착각한다.
 *
 * 앞뒤 문단도 한 개씩 붙인다. `이름 | 설명` 두 줄만 보면 그것이 계층인지
 * 비교인지 가릴 수 없다 -- 글이 무엇을 말하려던 것인지가 판정을 가른다.
 *
 * 실행: npm run dump:stack
 */
loadEnvLocal()

const OUT = 'docs/audit/_stack-blocks.md'

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const r = await pool.query<{ number: number | null; question: string; category: string; body: string }>(
    `select number, normalized_question as question, primary_category as category, coalesce(body,'') as body
       from qnode where body like '%:::stack%' order by number asc nulls last`,
  )

  const out: string[] = [
    '# 남은 `:::stack` 원문',
    '',
    '`npm run dump:stack`이 만든다. 손으로 고치지 마라 — 다시 만들면 덮인다.',
    '',
    `${r.rows.length}편.`,
    '',
  ]

  for (const row of r.rows) {
    const lines = row.body.split('\n')
    const start = lines.findIndex((l) => /^:::[ \t]*stack\b/.test(l))
    const end = lines.findIndex((l, i) => i > start && /^:::[ \t]*(end)?[ \t]*$/.test(l))
    if (start < 0 || end < 0) continue

    /* 앞뒤로 비지 않은 문단 하나씩 */
    const before = lines.slice(0, start).filter((l) => l.trim().length > 0).slice(-1)[0] ?? ''
    const after = lines.slice(end + 1).filter((l) => l.trim().length > 0)[0] ?? ''

    out.push(`## #${row.number} ${row.question}`)
    out.push(`\`${row.category}\``)
    out.push('')
    if (before) out.push(`앞: ${before}`)
    out.push('')
    out.push('```')
    out.push(...lines.slice(start, end + 1))
    out.push('```')
    out.push('')
    if (after) out.push(`뒤: ${after}`)
    out.push('')
  }

  mkdirSync('docs/audit', { recursive: true })
  writeFileSync(OUT, out.join('\n'))
  console.log(`${r.rows.length}편 → ${OUT}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
