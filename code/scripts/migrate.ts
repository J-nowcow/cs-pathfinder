import { loadEnvLocal } from '../src/lib/load-env'
import { readMigrations } from '../src/lib/db/client'

/**
 * 실제 Postgres에 마이그레이션을 적용한다.
 *
 * 런타임(getDb)은 실제 DB일 때 마이그레이션을 돌리지 않는다. 매 요청마다
 * create table을 던지면 느리고 위험해서다. 대신 배포 전에 이 스크립트를 한 번 돌린다.
 *
 * 적용 이력을 schema_migrations에 남겨서 두 번 돌려도 안전하다.
 *
 * 실행: npm run db:migrate
 */
loadEnvLocal()

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다. Neon 연결 후 다시 실행할 것.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  await pool.query(`
    create table if not exists schema_migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const applied = new Set(
    (await pool.query<{ name: string }>('select name from schema_migrations')).rows.map(
      (r) => r.name,
    ),
  )

  let count = 0
  for (const { name, sql } of readMigrations()) {
    if (applied.has(name)) {
      console.log(`  건너뜀  ${name}`)
      continue
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations (name) values ($1)', [name])
      await client.query('commit')
      console.log(`  적용됨  ${name}`)
      count += 1
    } catch (e) {
      await client.query('rollback')
      console.error(`  실패    ${name}`)
      throw e
    } finally {
      client.release()
    }
  }

  const tables = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  )
  console.log(`\n${count}개 적용. 현재 테이블:`)
  for (const t of tables.rows) console.log(`  ${t.table_name}`)

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
