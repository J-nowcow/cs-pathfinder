import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  /** 여러 문장을 한 번에 실행한다. 마이그레이션 전용 */
  exec(sql: string): Promise<void>
}

/**
 * PGlite는 Postgres를 WASM으로 컴파일한 것이라 plpgsql까지 그대로 돈다.
 * Docker 없이 실제 Postgres 의미론으로 테스트할 수 있다.
 *
 * DATABASE_URL이 주어지면 그쪽을 쓰도록 어댑터를 추가할 자리다.
 * 지금은 PGlite 단일 경로다.
 */
let instance: Db | null = null
let migrated = false

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = resolve(here, '../../../supabase/migrations')

async function createPglite(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite')
  const pg = new PGlite()
  await pg.waitReady

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const res = await pg.query<T>(sql, params as never[])
      return res.rows
    },
    async exec(sql: string): Promise<void> {
      await pg.exec(sql)
    },
  }
}

export function readMigrations(): Array<{ name: string; sql: string }> {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(resolve(migrationsDir, name), 'utf8') }))
}

export async function getDb(): Promise<Db> {
  if (!instance) instance = await createPglite()

  if (!migrated) {
    for (const { sql } of readMigrations()) {
      await instance.exec(sql)
    }
    migrated = true
  }

  return instance
}

/** 테스트 격리용. 스키마를 통째로 다시 만든다. */
export async function resetDb(): Promise<Db> {
  instance = null
  migrated = false
  return getDb()
}

/** 테스트에서 특정 테이블만 비울 때 쓴다. */
export async function truncateAll(): Promise<void> {
  const db = await getDb()
  await db.query(`
    truncate qedge, qnode_alias, qnode_suggestion, expansion_event,
             generation_job, usage_quota, topic_seed, qnode restart identity cascade
  `)
}
