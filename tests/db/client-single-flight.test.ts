import { describe, it, expect } from 'vitest'
import { getDb } from '@/lib/db/client'

/**
 * 동시에 열어도 DB는 하나여야 한다.
 *
 * 원래 `getDb`는 완성된 결과만 캐싱했다. 첫 호출이 `await`에 걸려 있는 동안
 * 도착한 호출이 `if (!holder.__csqtDb)`를 그대로 통과해 저마다 새 인스턴스를
 * 만들었다.
 *
 * 실측으로 잡았다 — 네 번 동시에 부르니 서로 다른 인스턴스가 4개 나왔고
 * 그중 하나만 스키마를 가졌다. 나머지 셋은 `relation "qnode" does not exist`다.
 *
 * 프로덕션에서는 스키마가 서버에 있어 질의는 통하지만 요청마다 `pg.Pool`이
 * 생기고 아무도 안 닫는다. 그보다 나쁜 것은 그 위에 쌓은 리스·자문 잠금·
 * 할당량 행 잠금이 전부 "같은 DB를 본다"를 전제한다는 점이다.
 */
describe('getDb 단일 비행', () => {
  it('hands the same instance to concurrent callers', async () => {
    const dbs = await Promise.all([getDb(), getDb(), getDb(), getDb(), getDb()])
    expect(new Set(dbs).size).toBe(1)
  })

  /* 인스턴스가 같아도 마이그레이션이 안 끝났으면 소용없다 */
  it('gives every concurrent caller a migrated schema', async () => {
    const dbs = await Promise.all([getDb(), getDb(), getDb(), getDb()])
    for (const db of dbs) {
      await expect(db.query('select 1 from qnode limit 1')).resolves.toBeDefined()
    }
  })

  /* 이어서 불러도 같은 것을 준다. 약속을 캐싱해도 결과 캐싱이 살아 있어야 한다 */
  it('keeps returning the same instance afterwards', async () => {
    const first = await getDb()
    expect(await getDb()).toBe(first)
  })
})
