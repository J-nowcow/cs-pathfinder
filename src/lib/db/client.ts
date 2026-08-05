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
/**
 * 인스턴스를 globalThis에 둔다.
 *
 * dev 서버가 HMR로 모듈을 갈아끼우면 모듈 스코프 변수가 초기화된다. 그러면
 * 인메모리 DB가 통째로 새로 생겨 파던 노드가 사라지고 열어둔 URL이 404가 된다.
 * 코드 한 줄 고칠 때마다 이러면 화면 작업이 불가능하다.
 *
 * 테스트는 파일마다 환경이 분리되므로 영향이 없다. resetDb가 여기도 비운다.
 */
type Holder = { __csqtDb?: Db | null; __csqtMigrated?: boolean }
const holder = globalThis as unknown as Holder

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
  if (!holder.__csqtDb) holder.__csqtDb = await createPglite()

  if (!holder.__csqtMigrated) {
    for (const { sql } of readMigrations()) {
      await holder.__csqtDb.exec(sql)
    }
    holder.__csqtMigrated = true
  }

  return holder.__csqtDb
}

/** 테스트 격리용. 스키마를 통째로 다시 만든다. */
export async function resetDb(): Promise<Db> {
  holder.__csqtDb = null
  holder.__csqtMigrated = false
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
