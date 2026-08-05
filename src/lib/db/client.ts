import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 트랜잭션 안에서 쓸 수 있는 최소 인터페이스. 중첩 트랜잭션은 열지 않는다 */
export interface Tx {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface Db extends Tx {
  /** 여러 문장을 한 번에 실행한다. 마이그레이션 전용 */
  exec(sql: string): Promise<void>
  /**
   * 콜백 전체를 한 커넥션에서 begin/commit으로 묶는다.
   *
   * pool.query로 begin을 던지면 뒤따르는 문장이 다른 커넥션에 실릴 수 있다.
   * 그러면 트랜잭션은 열린 채 방치되고 나머지는 자동 커밋된다.
   * 트랜잭션은 반드시 전용 커넥션에서 돌아야 한다.
   */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>
}

/**
 * DB는 두 갈래다.
 *
 * `DATABASE_URL`이 있으면 실제 Postgres(Neon)를 쓴다. 배포와 영속이 필요한 경로다.
 * 없으면 PGlite로 떨어진다. Postgres를 WASM으로 컴파일한 것이라 plpgsql까지
 * 그대로 돌아서 Docker 없이 실제 의미론으로 테스트할 수 있다.
 *
 * 테스트는 PGlite 경로로 돈다. 격리가 쉽고 빠르며 외부 의존이 없다.
 * 다만 PGlite는 단일 연결이라 진짜 동시성은 재현되지 않는다.
 * `for update` 행 잠금과 `on conflict` 경합은 실제 Postgres에서 따로 확인해야 한다.
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

/** 테스트는 실제 DB를 건드리면 안 된다. 명시적으로 켤 때만 Postgres를 쓴다. */
function postgresUrl(): string | null {
  if (process.env.NODE_ENV === 'test' && process.env.USE_REAL_DB !== '1') return null
  const url = process.env.DATABASE_URL?.trim()
  return url && url.length > 0 ? url : null
}

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
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return pg.transaction(async (tx) => {
        const res = await fn({
          async query<R>(sql: string, params?: unknown[]): Promise<R[]> {
            const out = await tx.query<R>(sql, params as never[])
            return out.rows
          },
        })
        return res
      }) as Promise<T>
    },
  }
}

/**
 * Neon 연결.
 *
 * HTTP 드라이버가 아니라 TCP 풀을 쓴다. 마이그레이션이 plpgsql 함수 본문을 담고
 * 있어서 세미콜론으로 문장을 쪼갤 수 없고, 다중 문장을 한 번에 보낼 수 있어야 한다.
 * HTTP 드라이버는 그걸 못 한다.
 */
async function createPostgres(connectionString: string): Promise<Db> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Neon은 TLS를 요구하는데 사내망 프록시가 인증서를 가로채면 검증이 깨진다.
    ssl: { rejectUnauthorized: false },
  })

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const res = await pool.query(sql, params as unknown[])
      return res.rows as T[]
    },
    async exec(sql: string): Promise<void> {
      // params 없이 보내면 다중 문장이 허용된다
      await pool.query(sql)
    },
    async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const out = await fn({
          async query<R>(sql: string, params?: unknown[]): Promise<R[]> {
            const res = await client.query(sql, params as unknown[])
            return res.rows as R[]
          },
        })
        await client.query('commit')
        return out
      } catch (e) {
        // 롤백까지 실패해도 원래 예외를 던져야 원인이 보인다
        await client.query('rollback').catch(() => undefined)
        throw e
      } finally {
        client.release()
      }
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
  if (!holder.__csqtDb) {
    const url = postgresUrl()
    holder.__csqtDb = url ? await createPostgres(url) : await createPglite()

    // 실제 Postgres는 스키마가 이미 서 있다. 마이그레이션은 배포 시 한 번만 돌린다.
    // 매 요청마다 create table을 다시 던지면 느리고 위험하다.
    if (url) holder.__csqtMigrated = true
  }

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
    truncate tree_vote, tree_occurrence, tree, qedge, qnode_alias, qnode_suggestion,
             qnode_equivalence, expansion_event, generation_job, usage_quota, topic_seed,
             qnode restart identity cascade
  `)
}
