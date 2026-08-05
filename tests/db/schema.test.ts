import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode, insertSuggestions, bindAlias, ensureEdge } from '@/lib/expand/nodes'
import { loadNode, lookupByHash } from '@/lib/expand/cache'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'

const mk = (over: Partial<Parameters<typeof insertNode>[0]> = {}) =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: '테스트 질문',
    body: '본문',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
    ...over,
  })

describe('core graph schema', () => {
  beforeEach(truncateAll)

  it('inserts a ready node and reads it back', async () => {
    const id = await mk()
    const node = await loadNode(id)
    expect(node!.question).toBe('테스트 질문')
    expect(node!.primaryCategory).toBe('네트워크')
  })

  it('hides a pending node from loadNode', async () => {
    const id = await mk({ status: 'pending' })
    expect(await loadNode(id)).toBeNull()
  })

  it('rejects a self edge', async () => {
    const db = await getDb()
    const id = await mk()
    await expect(
      db.query('insert into qedge (parent_id, child_id) values ($1, $1)', [id]),
    ).rejects.toThrow()
  })

  it('allows a cycle in the global graph', async () => {
    const a = await mk({ normalizedQuestion: '순환 A' })
    const b = await mk({ normalizedQuestion: '순환 B' })
    await ensureEdge(a, b)
    await ensureEdge(b, a)

    const db = await getDb()
    const rows = await db.query('select * from qedge')
    expect(rows).toHaveLength(2)
  })

  it('is idempotent on repeated edge insert', async () => {
    const a = await mk({ normalizedQuestion: 'edge A' })
    const b = await mk({ normalizedQuestion: 'edge B' })
    await ensureEdge(a, b)
    await ensureEdge(a, b)

    const db = await getDb()
    expect(await db.query('select * from qedge')).toHaveLength(1)
  })

  it('enforces alias uniqueness per normalizer version', async () => {
    const db = await getDb()
    const a = await mk({ normalizedQuestion: 'alias A' })
    const b = await mk({ normalizedQuestion: 'alias B' })

    await bindAlias(NORMALIZER_VERSION, 'hash-x', a)
    await bindAlias(NORMALIZER_VERSION, 'hash-x', b)

    const rows = await db.query('select qnode_id from qnode_alias where normalized_hash = $1', [
      'hash-x',
    ])
    expect(rows).toHaveLength(1)
  })

  it('allows the same hash under a different normalizer version', async () => {
    const db = await getDb()
    const a = await mk({ normalizedQuestion: 'ver A' })
    await bindAlias('gate-v1', 'hash-y', a)
    await bindAlias('gate-v2', 'hash-y', a)

    expect(await db.query('select 1 from qnode_alias where normalized_hash = $1', ['hash-y']))
      .toHaveLength(2)
  })

  it('returns suggestions in position order', async () => {
    const id = await mk()
    await insertSuggestions(id, ['첫째', '둘째', '셋째'])

    const node = await loadNode(id)
    expect(node!.suggestions.map((s) => s.text)).toEqual(['첫째', '둘째', '셋째'])
  })

  it('looks up by hash through the alias', async () => {
    const id = await mk({ normalizedQuestion: '해시 조회 대상' })
    await bindAlias(NORMALIZER_VERSION, 'hash-lookup', id)

    const hit = await lookupByHash('hash-lookup')
    expect(hit!.id).toBe(id)
  })

  it('returns null when the alias points at a pending node', async () => {
    const id = await mk({ status: 'pending', normalizedQuestion: '아직 생성 중' })
    await bindAlias(NORMALIZER_VERSION, 'hash-pending', id)

    expect(await lookupByHash('hash-pending')).toBeNull()
  })

  it('returns null for an unknown hash', async () => {
    expect(await lookupByHash('hash-nope')).toBeNull()
  })
})
