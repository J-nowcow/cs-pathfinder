import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { reserveQuota, commitQuota, releaseQuota, getQuota } from '@/lib/quota'

const KEY = 'anon:quota-test'

describe('quota', () => {
  beforeEach(truncateAll)

  it('reserves when under the limit', async () => {
    expect(await reserveQuota(KEY, 3)).toBe(true)
    expect(await getQuota(KEY)).toEqual({ used: 0, reserved: 1 })
  })

  it('counts used and reserved together against the limit', async () => {
    expect(await reserveQuota(KEY, 2)).toBe(true)
    expect(await reserveQuota(KEY, 2)).toBe(true)
    expect(await reserveQuota(KEY, 2)).toBe(false)
  })

  it('moves reserved to used on commit', async () => {
    await reserveQuota(KEY, 3)
    await commitQuota(KEY)
    expect(await getQuota(KEY)).toEqual({ used: 1, reserved: 0 })
  })

  it('frees the slot on release', async () => {
    await reserveQuota(KEY, 1)
    expect(await reserveQuota(KEY, 1)).toBe(false)
    await releaseQuota(KEY)
    expect(await reserveQuota(KEY, 1)).toBe(true)
  })

  it('never grants more than the limit', async () => {
    const results: boolean[] = []
    for (let i = 0; i < 10; i += 1) results.push(await reserveQuota(KEY, 4))
    expect(results.filter(Boolean)).toHaveLength(4)
  })

  it('keeps counters non-negative on excess release', async () => {
    await releaseQuota(KEY)
    expect(await getQuota(KEY)).toEqual({ used: 0, reserved: 0 })
  })

  it('reports zero for an unseen key', async () => {
    expect(await getQuota('anon:never-seen')).toEqual({ used: 0, reserved: 0 })
  })

  it('isolates keys from each other', async () => {
    await reserveQuota('anon:a', 1)
    expect(await reserveQuota('anon:b', 1)).toBe(true)
  })
})
