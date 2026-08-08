import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'

/**
 * 번호가 새지 않는가.
 *
 * `0010`이 `number`에 `default nextval(...)`을 걸었다. 그런데 부팅 시드는
 * `insert ... on conflict (id) do update`로 넣는다. `number`를 안 적으면
 * **컬럼 기본값이 충돌 검사보다 먼저 평가된다.** 이미 있는 행이어도 `nextval`이
 * 돌고, 시퀀스는 트랜잭션을 안 타므로 되돌지도 않는다.
 *
 * 그래서 **부팅 한 번에 시드 개수만큼 번호가 사라졌다.** 운영에서 행 283개에
 * 시퀀스가 29763까지 갔다 — 29,480개가 샜고 새 질문이 `/q/28728`을 받았다.
 * `/q/3` 같은 짧은 주소가 이 서비스의 값인데 그것을 깎는 결함이다.
 *
 * 눈으로는 안 잡힌다. 화면은 멀쩡하고 번호도 유일하다. **두 번 부팅해 보고
 * 시퀀스를 읽어야** 보인다.
 */
beforeEach(async () => {
  await resetDb()
  /*
   * **이것을 빼면 시험이 통째로 헛돈다.**
   *
   * `ensureSeeded`는 약속을 캐싱한다. DB만 되돌리고 캐시를 안 비우면 두 번째
   * 파일부터는 이미 끝난 약속을 그대로 돌려받아 **새 DB에는 아무것도 안 심긴다.**
   * 그러면 `count(*)`가 0이 되고, 0과 0을 견주는 단언은 무엇을 지워도 통과한다.
   *
   * 실제로 그랬다. 번호 붙이는 줄을 지웠는데 시험이 통과했다.
   */
  resetSeedCache()
})

async function seqValue(): Promise<number> {
  const db = await getDb()
  const rows = await db.query<{ v: string }>(`select last_value as v from qnode_number_seq`)
  return Number(rows[0].v)
}

describe('부팅 시드', () => {
  it('두 번째 부팅은 번호를 하나도 안 먹는다', async () => {
    await ensureSeeded()
    const after1 = await seqValue()

    await ensureSeeded()
    const after2 = await seqValue()

    expect(after2).toBe(after1)
  })

  it('모든 노드에 번호가 있고 겹치지 않는다', async () => {
    await ensureSeeded()
    const db = await getDb()
    const rows = await db.query<{ total: number; numbered: number; distinct: number }>(
      `select count(*)::int total,
              count(number)::int numbered,
              count(distinct number)::int distinct
         from qnode`,
    )
    const { total, numbered, distinct } = rows[0]
    /*
     * **먼저 정말 심겼는지 본다.** 이걸 빼면 `total`이 0일 때 나머지도 0이라
     * 시험이 그냥 통과한다. 실제로 그랬다 — 번호 붙이는 줄을 지웠는데도
     * 통과했다. 아무것도 안 세는 시험이었다.
     */
    expect(total).toBeGreaterThan(20)
    expect(numbered).toBe(total)
    expect(distinct).toBe(total)
  })

  /*
   * 기본값이 살아 있으면 `on conflict` 경로가 다시 번호를 먹는다. 컬럼에
   * 기본값이 없다는 것 자체를 걸어 둔다 — 다음에 누가 편하다고 되돌릴 수 있다.
   */
  it('number 컬럼에 기본값이 없다', async () => {
    const db = await getDb()
    const rows = await db.query<{ def: string | null }>(
      `select column_default as def
         from information_schema.columns
        where table_name = 'qnode' and column_name = 'number'`,
    )
    expect(rows[0].def).toBeNull()
  })
})
