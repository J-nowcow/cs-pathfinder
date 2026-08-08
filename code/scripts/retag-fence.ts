import { loadEnvLocal } from '../src/lib/load-env'
import { writeFileSync, mkdirSync } from 'node:fs'

/**
 * 도식 울타리 이름 하나를 바꾼다. 운영 DB와 `data/generated-nodes.ts` 양쪽에.
 *
 * `state`·`tree`·`memory`·`timeline`은 파서도 렌더러도 이미 배포됐는데 저장된
 * 본문이 전부 `flow`나 `stack`으로 태그돼 있다. 그래서 렌더러만 있고 아무도
 * 안 쓴다. 이 도구는 그 이름만 바꾼다 -- **본문의 다른 글자는 안 건드린다.**
 *
 * **기본은 미리보기다.** `--apply`를 줘야 실제로 쓴다. 그 전에 바뀔 본문을
 * 통째로 백업한다(`docs/audit/_bodies-before-retag.json`).
 *
 * 일괄 치환을 하지 않는 이유가 있다. `:::flow`로 쓰인 것 중 실제로 상태
 * 기계인 것은 소수다 -- 나머지는 마디가 상태가 아니라 행위자다. 한 편씩
 * 열어 보고 정해야 하므로 질문을 하나씩 지목하게 만들었다.
 *
 * 실행:
 *   npm run retag -- --q "서킷 브레이커" --from flow --to state
 *   npm run retag -- --q "서킷 브레이커" --from flow --to state --apply
 */
loadEnvLocal()

const KINDS = ['flow', 'state', 'tree', 'memory', 'timeline', 'stack'] as const
type Kind = (typeof KINDS)[number]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const q = arg('q')
  const from = arg('from') as Kind | undefined
  const to = arg('to') as Kind | undefined
  const apply = process.argv.includes('--apply')

  if (!q || !from || !to) {
    console.error('필요: --q <질문 일부> --from <종류> --to <종류> [--apply]')
    process.exit(1)
  }
  if (!KINDS.includes(from) || !KINDS.includes(to)) {
    console.error(`종류는 ${KINDS.join(' · ')} 중 하나여야 한다.`)
    process.exit(1)
  }

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const r = await pool.query<{ id: string; number: number | null; question: string; body: string }>(
    `select id, number, normalized_question as question, coalesce(body,'') as body
       from qnode where normalized_question ilike $1`,
    [`%${q}%`],
  )

  if (r.rows.length === 0) {
    console.error(`"${q}"에 맞는 질문이 없다.`)
    process.exit(1)
  }
  /*
   * 여럿이 걸리면 멈춘다. 어느 것을 고칠지 사람이 정해야 한다 --
   * 지레짐작으로 첫 번째를 고르면 엉뚱한 편을 건드린다.
   */
  if (r.rows.length > 1) {
    console.error(`${r.rows.length}편이 걸렸다. 더 좁혀라.`)
    for (const row of r.rows) console.error(`  #${row.number} ${row.question}`)
    process.exit(1)
  }

  const row = r.rows[0]
  const open = new RegExp(`^:::[ \\t]*${from}\\b`, 'gm')
  const hits = [...row.body.matchAll(open)].length

  console.log(`#${row.number} ${row.question}`)
  console.log(`  :::${from} ${hits}건`)

  if (hits === 0) {
    console.log('  바꿀 것이 없다.')
    await pool.end()
    return
  }
  if (hits > 1) {
    console.error(`  한 편에 :::${from}이 ${hits}개다. 이 도구는 하나짜리만 다룬다.`)
    process.exit(1)
  }

  const next = row.body.replace(open, `:::${to}`)

  /* 바뀐 줄만 보여준다. 본문 전체를 쏟으면 무엇이 바뀌었는지 안 보인다 */
  const beforeLine = row.body.split('\n').find((l) => new RegExp(`^:::[ \\t]*${from}\\b`).test(l))
  console.log(`  ${beforeLine}  ->  :::${to}`)
  console.log(`  나머지 글자 그대로: ${row.body.length === next.length + from.length - to.length ? '예' : '아니오 — 확인 필요'}`)

  if (!apply) {
    console.log('\n미리보기다. 실제로 쓰려면 --apply')
    await pool.end()
    return
  }

  mkdirSync('docs/audit', { recursive: true })
  const backupPath = 'docs/audit/_bodies-before-retag.json'
  let backup: Record<string, { question: string; body: string }> = {}
  try {
    backup = JSON.parse(require('node:fs').readFileSync(backupPath, 'utf8'))
  } catch {
    /* 처음이면 없다 */
  }
  /* 같은 편을 두 번 고쳐도 **맨 처음 것**이 남아야 되돌릴 수 있다 */
  if (!backup[row.id]) backup[row.id] = { question: row.question, body: row.body }
  writeFileSync(backupPath, JSON.stringify(backup, null, 2))

  await pool.query(`update qnode set body = $1 where id = $2`, [next, row.id])
  console.log(`\n적용했다. 되돌리려면 ${backupPath}의 body를 다시 넣으면 된다.`)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
