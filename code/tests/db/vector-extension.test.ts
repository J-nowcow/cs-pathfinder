import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'

/**
 * **시험 DB에서 벡터 연산이 도는가.**
 *
 * PGlite는 `new PGlite()`로 만들면 확장이 안 실린다. 번들은 패키지에
 * 들어 있는데 인스턴스를 만들 때 넘겨야 로드된다. 안 넘기면
 * `extension "vector" is not available`이다.
 *
 * 이 시험이 없으면 `createPglite`에서 `extensions` 인자가 사라져도 아무도
 * 모른다 -- 사라지는 순간 마이그레이션 `0012`가 첫 줄에서 죽고 DB 시험이
 * **전부** 깨지긴 하지만, 그때 원인이 여기라는 것을 알려주는 것이 없다.
 * 그래서 무엇이 깨졌는지 말해 주는 시험을 따로 둔다.
 *
 * 캐스팅도 함께 건다. `0012`가 컬럼을 안 옮기기로 한 근거가 그것이고,
 * 캐스팅이 안 되면 그 결정 전체가 무너진다.
 */
beforeEach(resetDb)

describe('벡터 확장', () => {
  it('확장이 실려 있다', async () => {
    const db = await getDb()
    const rows = await db.query<{ extname: string }>(
      `select extname from pg_extension where extname = 'vector'`,
    )
    expect(rows).toHaveLength(1)
  })

  /**
   * `0012`가 컬럼을 `vector`로 안 옮긴 근거다. 이것이 깨지면 `real[]`에
   * 담아 둔 값이 검색에 못 쓰이고, `0005`의 "값은 그대로 살아 있다"도
   * 거짓이 된다.
   */
  it('real[]을 vector로 캐스팅할 수 있다', async () => {
    const db = await getDb()
    const rows = await db.query<{ v: string }>(
      `select ('{1,0,0,0}'::real[])::vector(4) as v`,
    )
    expect(rows[0].v).toBe('[1,0,0,0]')
  })

  /**
   * `<=>`는 코사인 **거리**다. 같으면 0, 직교면 1이다.
   * 유사도로 쓰려면 `1 - (a <=> b)`여야 한다. 부호를 뒤집어 쓰면
   * 가장 안 닮은 것이 top-k로 올라온다.
   */
  it('코사인 거리가 방향을 맞게 준다', async () => {
    const db = await getDb()
    const rows = await db.query<{ same: number; near: number; ortho: number }>(
      `select ('{1,0,0,0}'::real[]::vector(4) <=> '[1,0,0,0]'::vector(4)) as same,
              ('{0.9,0.1,0,0}'::real[]::vector(4) <=> '[1,0,0,0]'::vector(4)) as near,
              ('{0,1,0,0}'::real[]::vector(4) <=> '[1,0,0,0]'::vector(4)) as ortho`,
    )
    const { same, near, ortho } = rows[0]
    expect(same).toBeCloseTo(0, 5)
    expect(near).toBeGreaterThan(same)
    expect(ortho).toBeGreaterThan(near)
    expect(ortho).toBeCloseTo(1, 5)
  })

  /** 차원이 다른 벡터를 견주면 터진다. 상수가 어긋나면 여기서 잡힌다 */
  it('차원이 다르면 거부한다', async () => {
    const db = await getDb()
    await expect(
      db.query(`select '{1,0,0}'::real[]::vector(3) <=> '[1,0,0,0]'::vector(4)`),
    ).rejects.toThrow()
  })
})
