import { loadEnvLocal } from '../src/lib/load-env'

/**
 * 질문 번호로 본문의 도식 울타리만 그대로 찍는다.
 *
 * 재태깅을 판정하려면 **저장된 글자 그대로**를 봐야 한다. 파서를 거친 결과만
 * 보면 파서가 고쳐 준 것(구분줄 버리기 같은)이 원본인 줄 알게 된다.
 *
 * 실행: npm run show -- 166 176
 */
loadEnvLocal()

async function main() {
  const nums = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number)
  if (nums.length === 0) {
    console.error('질문 번호를 달라. 예: npm run show -- 166 176')
    process.exit(1)
  }

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const r = await pool.query<{ number: number; question: string; body: string }>(
    `select number, normalized_question as question, coalesce(body,'') as body
       from qnode where number = any($1::int[]) order by number`,
    [nums],
  )

  for (const row of r.rows) {
    console.log(`\n===== #${row.number} ${row.question}`)
    for (const m of row.body.matchAll(/^:::[\s\S]*?^:::[ \t]*(end)?[ \t]*$/gm)) {
      console.log(m[0])
    }
  }
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
