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
type Holder = {
  __csqtDb?: Db | null
  __csqtMigrated?: boolean
  /**
   * 실제 Postgres일 때의 연결 풀.
   *
   * `Db` 인터페이스 뒤에 숨겨 두면 될 줄 알았는데 안 되는 손님이 있다.
   * 인증 어댑터(`@auth/pg-adapter`)는 **`pg.Pool` 그 자체**를 요구한다.
   * 우리 인터페이스를 못 받는다.
   *
   * 그렇다고 어댑터가 자기 풀을 따로 만들게 두면 안 된다. 서버 인스턴스마다
   * 풀이 둘이 되고(각 max 5) 아무도 안 닫는다 -- 바로 아래 `getDb` 주석이
   * 적어 둔 그 함정을 이름만 바꿔 다시 밟는 것이다.
   *
   * 그래서 만든 풀을 여기 얹어 두고 필요한 쪽이 **같은 것을** 받아 가게 한다.
   */
  __csqtPool?: unknown
}
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
  /* 인증 어댑터처럼 `pg.Pool` 자체를 요구하는 쪽이 같은 것을 받아 가게 둔다 */
  holder.__csqtPool = pool

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

/**
 * 준비 중인 작업을 들고 있는다.
 *
 * 완성된 결과가 아니라 **약속**을 캐싱하는 것이 요점이다. 결과만 캐싱하면
 * 첫 호출이 `await`에 걸려 있는 동안 도착한 두 번째 호출이 `if (!holder…)`를
 * 그대로 통과한다.
 *
 * 실제로 그랬다. `Promise.all([getDb(), getDb(), getDb(), getDb()])`를 재보니
 * 서로 다른 인스턴스가 4개 나왔고 그중 하나만 스키마를 가졌다 — 나머지 셋은
 * `relation "qnode" does not exist`로 죽는다.
 *
 * 프로덕션에서는 스키마가 서버에 있어 질의는 통하지만, 요청 수만큼 `pg.Pool`이
 * 생기고(각 max 5) 아무도 안 닫는다. 연결 상한으로 직행한다.
 *
 * 더 나쁜 것은 그 위에 쌓은 동시성 장치들이다. 생성 리스·자문 잠금·할당량 행
 * 잠금이 전부 "같은 DB를 본다"를 전제하는데, 서로 다른 풀에서 돌면 그 전제가
 * 깨진다.
 *
 * 바로 아래 `ensureSeeded`(db/bootstrap.ts)가 같은 이유로 같은 패턴을 쓴다.
 * 그쪽 주석이 이 함정을 정확히 적어 놓고 정작 자기가 부르는 `getDb`가 그
 * 함정이었다.
 */
let opening: Promise<Db> | null = null

export async function getDb(): Promise<Db> {
  if (holder.__csqtDb && holder.__csqtMigrated) return holder.__csqtDb

  if (!opening) {
    opening = open().catch((e) => {
      // 실패를 캐싱하면 다음 요청이 영영 같은 실패를 돌려받는다
      opening = null
      throw e
    })
  }
  return opening
}

async function open(): Promise<Db> {
  if (!holder.__csqtDb) {
    const url = postgresUrl()
    const db = url ? await createPostgres(url) : await createPglite()

    // 실제 Postgres는 스키마가 이미 서 있다. 마이그레이션은 배포 시 한 번만 돌린다.
    // 매 요청마다 create table을 다시 던지면 느리고 위험하다.
    holder.__csqtDb = db
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

/**
 * 연결 풀을 그대로 내준다. PGlite로 돌 때는 `null`이다.
 *
 * **`null`을 받았으면 그건 고장이 아니라 "여기서는 못 쓴다"는 뜻이다.**
 * 테스트는 PGlite로 도는데 그건 WASM이라 `pg.Pool`이 아예 없다. 부르는 쪽이
 * 그때 무엇을 할지 정해야 한다 -- 조용히 새 풀을 만들어 우회하면 안 된다.
 *
 * 풀을 여기서 만들지 않는다. `getDb()`가 만든 것을 돌려줄 뿐이다. 그래야
 * 인스턴스마다 하나만 산다.
 */
export async function getPool(): Promise<import('pg').Pool | null> {
  await getDb()
  return (holder.__csqtPool as import('pg').Pool | undefined) ?? null
}

/** 테스트 격리용. 스키마를 통째로 다시 만든다. */
export async function resetDb(): Promise<Db> {
  // 준비 중인 약속도 같이 비운다. 안 그러면 getDb가 옛 인스턴스를 계속 돌려준다
  opening = null
  holder.__csqtDb = null
  holder.__csqtMigrated = false
  // 풀도 같이 놓는다. 안 그러면 죽은 DB의 풀을 다음 사람이 받아 간다
  holder.__csqtPool = undefined
  return getDb()
}

/** 테스트에서 특정 테이블만 비울 때 쓴다. */
export async function truncateAll(): Promise<void> {
  const db = await getDb()
  await db.query(`
    truncate semantic_relation, tree_vote, tree_occurrence, tree, qedge, qnode_alias, qnode_suggestion,
             qnode_equivalence, expansion_event, generation_job, usage_quota, topic_seed,
             qnode restart identity cascade
  `)
}
