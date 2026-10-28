import { beforeEach, describe, expect, it } from 'vitest'
import { getDb, truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import {
  saveRelations,
  deactivateRelation,
  type NewRelation,
} from '@/lib/db/relations'
let relation: NewRelation
async function snapshot() {
  const db = await getDb()
  return (
    await db.query<{
      position: string
      votes: number
      source: string
      reason: string
      active: boolean
    }>(
      'select ctid::text position,votes,source,reason,active from semantic_relation',
    )
  )[0]
}
beforeEach(async () => {
  await truncateAll()
  const node = (question: string) =>
    insertNode({
      identityScope: 'generic',
      normalizedQuestion: question,
      body: question,
      primaryCategory: 'network',
      status: 'ready',
      origin: 'batch',
    })
  relation = {
    fromId: await node('Synthetic source'),
    toId: await node('Synthetic target'),
    kind: 'prerequisite',
    source: 'llm',
    reason: 'Initial judgment',
    votes: 3,
  }
})
describe('relation upserts avoid unchanged physical row versions', () => {
  it('does not rewrite an identical or weaker judgment', async () => {
    await saveRelations([relation])
    const before = await snapshot()
    await saveRelations([relation])
    expect(await snapshot()).toEqual(before)
    await saveRelations([{ ...relation, votes: 1, reason: 'Weaker evidence' }])
    expect(await snapshot()).toEqual(before)
  })
  it('updates higher votes and reason but never downgrades human provenance', async () => {
    await saveRelations([{ ...relation, source: 'human' }])
    const before = await snapshot()
    await saveRelations([
      { ...relation, votes: 7, reason: 'Stronger evidence' },
    ])
    const after = await snapshot()
    expect(after.position).not.toBe(before.position)
    expect(after).toMatchObject({
      votes: 7,
      reason: 'Stronger evidence',
      source: 'human',
    })
    await saveRelations([
      { ...relation, votes: 7, reason: 'Tie does not replace reason' },
    ])
    expect(await snapshot()).toEqual(after)
  })
  it('promotes human provenance once even at lower votes and preserves deactivation', async () => {
    await saveRelations([relation])
    const db = await getDb()
    const [row] = await db.query<{ id: string }>(
      'select id from semantic_relation',
    )
    await deactivateRelation(row.id)
    const before = await snapshot(),
      human = {
        ...relation,
        source: 'human' as const,
        votes: 1,
        reason: 'Human confirmation',
      }
    await saveRelations([human])
    const promoted = await snapshot()
    expect(promoted.position).not.toBe(before.position)
    expect(promoted).toMatchObject({
      votes: 3,
      reason: 'Initial judgment',
      source: 'human',
      active: false,
    })
    await saveRelations([human])
    expect(await snapshot()).toEqual(promoted)
  })
})
