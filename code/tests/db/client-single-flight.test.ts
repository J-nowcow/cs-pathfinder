import { describe, it, expect, beforeEach } from 'vitest'

/**
 * 동시에 열어도 DB는 하나여야 한다.
 *
 * 원래 `getDb`는 완성된 결과만 캐싱했다. 첫 호출이 `await`에 걸려 있는 동안
 * 도착한 호출이 `if (!holder.__csqtDb)`를 그대로 통과해 저마다 새 인스턴스를
 * 만들었다. 네 번 동시에 부르니 서로 다른 인스턴스가 4개 나왔고 그중 하나만
 * 스키마를 가졌다.
 *
 * **차가운 상태를 강제해야 의미가 있다.** 처음에는 그냥 `getDb`를 부르는
 * 시험을 썼는데 전체 스위트에서 0ms에 끝났다 — 앞선 시험 파일이 이미 DB를
 * 만들어 뒀고 `vitest.config.ts`가 `singleThread`라 `globalThis`가 공유된다.
 * 데워진 상태에서는 **옛 코드도 통과한다.** 초록색이 아무것도 보증하지 않았다.
 *
 * 그래서 매번 모듈을 새로 띄운다. 모듈 스코프의 `opening`이 초기화되고,
 * `globalThis` 쪽 두 값도 직접 비워 진짜 첫 호출을 재현한다.
 */
type Holder = { __csqtDb?: unknown; __csqtMigrated?: boolean }

async function coldClient(tag: string) {
  const holder = globalThis as unknown as Holder
  holder.__csqtDb = null
  holder.__csqtMigrated = false
  return import(`@/lib/db/client?cold=${tag}`)
}

describe('getDb 단일 비행', () => {
  /* 다른 파일이 데워 놓은 것을 물려받지 않는다 */
  beforeEach(() => {
    const holder = globalThis as unknown as Holder
    holder.__csqtDb = null
    holder.__csqtMigrated = false
  })

  it('hands the same instance to concurrent callers', async () => {
    const { getDb } = await coldClient('same')
    const dbs = await Promise.all([getDb(), getDb(), getDb(), getDb(), getDb()])
    expect(new Set(dbs).size).toBe(1)
  })

  /*
   * 인스턴스가 같아도 마이그레이션이 안 끝났으면 소용없다.
   *
   * 옛 코드에서 실제로 났던 모양이 이것이다 — 스키마는 A에 서고 호출자는 C를
   * 받아 `relation "qnode" does not exist`로 죽었다.
   */
  it('gives every concurrent caller a migrated schema', async () => {
    const { getDb } = await coldClient('migrated')
    const dbs = await Promise.all([getDb(), getDb(), getDb(), getDb()])
    for (const db of dbs) {
      await expect(db.query('select 1 from qnode limit 1')).resolves.toBeDefined()
    }
  })

  /* 약속을 캐싱해도 이어지는 호출이 같은 것을 받아야 한다 */
  it('keeps returning the same instance afterwards', async () => {
    const { getDb } = await coldClient('after')
    const first = await getDb()
    expect(await getDb()).toBe(first)
  })
})
