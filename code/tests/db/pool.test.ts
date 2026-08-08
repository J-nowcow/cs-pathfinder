import { describe, it, expect, beforeEach } from 'vitest'
import { getPool, getDb, resetDb } from '@/lib/db/client'

/**
 * 연결 풀을 하나만 쓰는가.
 *
 * 인증 어댑터(`@auth/pg-adapter`)는 우리 `Db` 인터페이스를 못 받고 **`pg.Pool`
 * 그 자체**를 요구한다. 그렇다고 어댑터가 자기 풀을 따로 만들게 두면 서버
 * 인스턴스마다 풀이 둘이 되고 아무도 안 닫는다 — `getDb` 주석이 적어 둔
 * 그 함정을 이름만 바꿔 다시 밟는 것이다.
 *
 * 그래서 만든 풀을 내주되 **새로 만들지는 않는다**를 걸어 둔다.
 *
 * 이 시험은 PGlite로 돈다(`DATABASE_URL`이 없다). 그때 `null`이 나오는 것이
 * 맞는 답이다 — PGlite는 WASM이라 `pg.Pool`이 아예 없다. `null`이 고장이
 * 아니라는 것을 부르는 쪽이 알아야 한다.
 */
beforeEach(async () => {
  await resetDb()
})

describe('연결 풀', () => {
  it('PGlite로 돌 때는 null이다', async () => {
    /*
     * `DATABASE_URL`이 비어 있는지 보면 안 된다. 실제로는 채워져 있고,
     * 시험을 막는 것은 `postgresUrl()`의 `NODE_ENV === 'test' &&
     * USE_REAL_DB !== '1'`이다. 엉뚱한 것을 걸면 그 가드가 사라져도
     * 시험은 통과한다 -- 그리고 `truncateAll`이 운영 DB에서 돈다.
     */
    expect(process.env.NODE_ENV).toBe('test')
    expect(process.env.USE_REAL_DB ?? '').not.toBe('1')
    await expect(getPool()).resolves.toBeNull()
  })

  /*
   * 던지면 부르는 쪽이 감싸야 하고, 감싸는 코드가 조용히 새 풀을 만드는
   * 우회로가 된다. `null`로 돌려주는 편이 낫다.
   */
  it('없다고 던지지 않는다', async () => {
    await expect(getPool()).resolves.not.toThrow
    const a = await getPool()
    const b = await getPool()
    expect(a).toBe(b)
  })

  /* 풀을 얻으려다 DB를 못 세우면 안 된다. 순서 의존을 없앤다 */
  it('먼저 불러도 DB가 선다', async () => {
    await getPool()
    const db = await getDb()
    const rows = await db.query<{ n: number }>('select 1::int as n')
    expect(rows[0].n).toBe(1)
  })

  /*
   * 여기부터는 **실제 Postgres인 척**한다.
   *
   * PGlite로 돌면 풀이 언제나 `null`이라 아무것도 관찰되지 않는다. 실제로
   * 처음 쓴 시험이 그랬다 — 풀을 얹는 줄을 지워도, 되돌릴 때 놓는 줄을
   * 지워도 통과했다. 아무것도 안 잡는 시험이었다.
   *
   * 그래서 `getDb()`가 얹었을 자리에 표식을 직접 넣고 그 다음을 건다.
   */
  const holder = globalThis as unknown as { __csqtPool?: unknown }

  it('있으면 그것을 그대로 내준다. 새로 만들지 않는다', async () => {
    await getDb()
    const sentinel = { iAm: 'the one pool' }
    holder.__csqtPool = sentinel
    await expect(getPool()).resolves.toBe(sentinel)
  })

  /*
   * 되돌린 뒤에 옛 풀이 남으면 죽은 DB를 가리키는 손잡이를 다음 사람이
   * 받아 간다. 실제 Postgres에서는 그 풀이 이미 닫힌 연결을 들고 있다.
   */
  it('되돌리면 풀도 같이 놓는다', async () => {
    await getDb()
    holder.__csqtPool = { iAm: 'stale' }
    await resetDb()
    await expect(getPool()).resolves.toBeNull()
  })
})

/**
 * 못 거는 것을 적어 둔다.
 *
 * `createPostgres`가 만든 풀을 실제로 얹는지는 여기서 못 건다. 그 줄은
 * 실제 Postgres 경로에서만 돌고 시험은 PGlite로 돈다. 표식으로 대신한
 * 것은 **얹은 뒤의 계약**(그대로 내준다·되돌리면 놓는다)이지 얹는 행위
 * 자체가 아니다.
 *
 * 인증을 붙일 때 실제 연결로 한 번 확인해야 한다. `USE_REAL_DB=1`로
 * 돌리면 되지만 그건 운영 DB를 가리키므로 읽기만 하는 시험이어야 한다.
 */
