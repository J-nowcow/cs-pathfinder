import { loadEnvLocal } from '../src/lib/load-env'

/**
 * 실제 DB 상태를 훑는다.
 *
 * 테스트가 실수로 실제 DB를 건드리지 않았는지 확인하는 용도이기도 하다.
 * truncateAll이 프로덕션에서 돌면 조용히 전부 사라진다.
 *
 * 실행: npm run db:status
 */
loadEnvLocal()

const TABLES = [
  'qnode',
  'qnode_suggestion',
  'qnode_alias',
  'qnode_equivalence',
  'qedge',
  'topic_seed',
  'expansion_event',
  'usage_quota',
]

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  console.log('테이블별 행 수')
  for (const t of TABLES) {
    const r = await pool.query<{ n: number }>(`select count(*)::int as n from ${t}`)
    console.log(`  ${t.padEnd(20)} ${String(r.rows[0].n).padStart(4)}`)
  }

  const roots = await pool.query<{ q: string; c: string }>(
    `select n.normalized_question as q, n.primary_category as c
     from qnode n
     where n.origin = 'batch'
     order by n.created_at
     limit 10`,
  )
  console.log('\n루트 노드')
  for (const r of roots.rows) console.log(`  [${r.c}] ${r.q}`)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
