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
  'tree',
  'tree_occurrence',
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

  // 매일 발행 상태. 하루 하나가 지켜지는지, 시드가 며칠치 남았는지 본다.
  const daily = await pool.query<{ d: string; c: string; slug: string; q: string }>(
    `select to_char(t.publish_date, 'YYYY-MM-DD') as d, t.category as c, t.slug,
            n.normalized_question as q
     from tree t join qnode n on n.id = t.root_node_id
     where t.kind = 'daily'
     order by t.publish_date desc
     limit 7`,
  )
  console.log('\n오늘의 질문 (최근 7건)')
  if (daily.rows.length === 0) console.log('  (아직 발행 없음)')
  for (const r of daily.rows) console.log(`  ${r.d}  [${r.c}] ${r.q}`)

  const seeds = await pool.query<{ left: number; used: number }>(
    `select count(*) filter (where consumed_at is null)::int as left,
            count(*) filter (where consumed_at is not null)::int as used
     from topic_seed`,
  )
  const s = seeds.rows[0]
  console.log(`\n주제어 시드  남음 ${s.left} / 소비 ${s.used}  (하루 하나면 ${s.left}일치)`)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
