// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { resetDb, truncateAll } from '@/lib/db/client'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadNode } from '@/lib/expand/cache'

/**
 * 주소에 번호와 UUID를 둘 다 받는가.
 *
 * 번호는 짧아서 레포와 이슈에 적기 좋고, UUID는 **이미 공유된 링크가 쓰고
 * 있어 깨면 안 된다.** 공유가 이 서비스의 핵심이라 한쪽만 되면 회귀다.
 *
 * 그리고 **둘 다 아닌 것이 오면 반드시 `null`이어야 한다.** 모양을 안 보고
 * 질의에 넣으면 Postgres가 `invalid input syntax for type uuid`를 던져
 * 없는 주소가 아니라 서버 고장으로 보인다. 실제로 `/q/없는것`이 500이었다.
 */
beforeAll(async () => {
  await resetDb()
  await ensureSeeded()
})
afterAll(async () => {
  await truncateAll()
})

describe('loadNode · 주소 열쇠', () => {
  it('UUID로 찾는다', async () => {
    const byNumber = await loadNode('1')
    expect(byNumber).not.toBeNull()
    const byUuid = await loadNode(byNumber!.id)
    expect(byUuid?.id).toBe(byNumber!.id)
  })

  it('번호로 찾은 것과 UUID로 찾은 것이 같다', async () => {
    const a = await loadNode('1')
    const b = await loadNode(a!.id)
    expect(b?.question).toBe(a!.question)
    expect(b?.number).toBe(1)
  })

  it('번호로 찾아도 꼬리질문이 붙는다', async () => {
    const n = await loadNode('1')
    expect(n!.suggestions.length).toBeGreaterThan(0)
  })

  /* 여기가 500이었다. 크롤러와 옛 링크가 온갖 것을 들고 온다 */
  it.each(['없는것', '0', '1e10', '../etc', ''])('%s 는 null이다 (터지지 않는다)', async (key) => {
    await expect(loadNode(key)).resolves.toBeNull()
  })

  it('없는 번호는 null이다', async () => {
    await expect(loadNode('999999')).resolves.toBeNull()
  })
})
