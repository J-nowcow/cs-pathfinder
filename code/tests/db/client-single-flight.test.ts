import { describe, it, expect, beforeEach, vi } from 'vitest'

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
 * Cold tests clear the shared database and initialization state before loading modules.
 */
type Holder = { __csqtDb?: unknown; __csqtMigrated?: boolean; __csqtOpening?: unknown }

async function coldClient(tag: string) {
  const holder = globalThis as unknown as Holder
  holder.__csqtDb = null
  holder.__csqtMigrated = false
  holder.__csqtOpening = null
  return import(`@/lib/db/client?cold=${tag}`)
}

describe('getDb 단일 비행', () => {
  /* 다른 파일이 데워 놓은 것을 물려받지 않는다 */
  beforeEach(() => {
    const holder = globalThis as unknown as Holder
    holder.__csqtDb = null
    holder.__csqtMigrated = false
    holder.__csqtOpening = null
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

  it('shares initialization across separately loaded client modules', async () => {
    const [firstModule, secondModule] = await Promise.all([
      coldClient('module-a'),
      coldClient('module-b'),
    ])
    const dbs = await Promise.all([firstModule.getDb(), secondModule.getDb()])
    expect(new Set(dbs).size).toBe(1)
    for (const db of dbs) {
      await expect(db.query('select 1 from tree limit 1')).resolves.toBeDefined()
    }
  })

  it('clears a failed shared initialization and retries from another module', async () => {
    const [firstModule, secondModule] = await Promise.all([
      coldClient('retry-a'),
      coldClient('retry-b'),
    ])
    const failure = new Error('synthetic migration failure')
    const exec = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined)
    const db = { exec, query: vi.fn(), transaction: vi.fn() }
    ;(globalThis as unknown as Holder).__csqtDb = db
    const attempts = await Promise.allSettled([firstModule.getDb(), secondModule.getDb()])
    expect(attempts).toEqual([
      { status: 'rejected', reason: failure },
      { status: 'rejected', reason: failure },
    ])
    expect(exec).toHaveBeenCalledTimes(1)
    await expect(secondModule.getDb()).resolves.toBe(db)
    await expect(firstModule.getDb()).resolves.toBe(db)
    expect((globalThis as unknown as Holder).__csqtMigrated).toBe(true)
  })

  /* 약속을 캐싱해도 이어지는 호출이 같은 것을 받아야 한다 */
  it('keeps returning the same instance afterwards', async () => {
    const { getDb } = await coldClient('after')
    const first = await getDb()
    expect(await getDb()).toBe(first)
  })
})
