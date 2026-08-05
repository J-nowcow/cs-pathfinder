import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { acquireLease, completeLease, failLease } from '@/lib/expand/singleflight'
import { insertNode } from '@/lib/expand/nodes'

const HASH = 'sf-hash'

describe('single flight lease', () => {
  beforeEach(truncateAll)

  it('grants the lease to the first caller', async () => {
    expect((await acquireLease(HASH)).result).toBe('acquired')
  })

  it('reports busy to the second caller', async () => {
    await acquireLease(HASH)
    expect((await acquireLease(HASH)).result).toBe('busy')
  })

  it('grants exactly one lease across many attempts', async () => {
    const results: string[] = []
    for (let i = 0; i < 8; i += 1) results.push((await acquireLease(HASH)).result)
    expect(results.filter((r) => r === 'acquired')).toHaveLength(1)
  })

  it('reports done with the node id after completion', async () => {
    await acquireLease(HASH)
    const nodeId = await insertNode({
      identityScope: 'generic',
      normalizedQuestion: 'single flight 대상',
      body: '본문',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
    await completeLease(HASH, nodeId)

    const r = await acquireLease(HASH)
    expect(r.result).toBe('done')
    expect(r.qnodeId).toBe(nodeId)
  })

  it('lets a new caller retry after failure', async () => {
    await acquireLease(HASH)
    await failLease(HASH)
    expect((await acquireLease(HASH)).result).toBe('acquired')
  })

  it('reclaims an expired lease', async () => {
    await acquireLease(HASH, -1)
    expect((await acquireLease(HASH)).result).toBe('acquired')
  })
})
