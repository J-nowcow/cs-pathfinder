import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { resetSeedCache } from '@/lib/db/bootstrap'
import { insertNode } from '@/lib/expand/nodes'

const auth = vi.hoisted(() => ({
  owner: 'alice',
  failure: null as Error | null,
}))
vi.mock('@/lib/auth/session', () => ({
  readUserId: async () => {
    if (auth.failure) throw auth.failure
    return auth.owner
  },
}))
import { GET } from '@/app/api/journey/route'
import { POST } from '@/app/api/journey/merge/route'

const read = () => GET(new Request('https://fixture.example/api/journey'))
const merge = (occurrences: unknown[], currentId: string | null) =>
  POST(
    new Request('https://fixture.example/api/journey/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ occurrences, current_id: currentId }),
    }),
  )
const makeNode = (question: string) =>
  insertNode({
    identityScope: 'network',
    normalizedQuestion: question,
    body: 'Synthetic public explanation',
    primaryCategory: 'network',
    origin: 'on_demand',
    status: 'ready',
  })
beforeEach(async () => {
  const db = await resetDb()
  resetSeedCache()
  for (const id of ['alice', 'bob'])
    await db.query(
      'insert into "user"(id,name,email,"emailVerified") values($1,\'\',$2,true)',
      [id, id + '@example.invalid'],
    )
  auth.owner = 'alice'
  auth.failure = null
})

describe('journey read and merge share one wire contract', () => {
  it('keeps the same empty bytes, null cursor and private response policy', async () => {
    const loaded = await read(),
      merged = await merge([], null)
    expect(loaded.status).toBe(200)
    expect(merged.status).toBe(200)
    expect(await loaded.text()).toBe('{"occurrences":[],"current_id":null}')
    expect(await merged.text()).toBe('{"occurrences":[],"current_id":null}')
    expect(loaded.headers.get('cache-control')).toBe('private, no-store')
    expect(merged.headers.get('cache-control')).toBe('private, no-store')
  })

  it('returns identical read/merge/retry snapshots using server-owned labels and stable path identities', async () => {
    const a = await makeNode('Fixture root'),
      b = await makeNode('Fixture child')
    const first = await merge(
      [
        {
          id: 'root',
          node_id: a,
          parent_id: null,
          question: 'Untrusted client label',
          category: 'untrusted',
        },
        { id: 'child', node_id: b, parent_id: 'root' },
      ],
      'child',
    )
    expect(first.status).toBe(200)
    const expected = await first.text()
    const parsed = JSON.parse(expected)
    expect(
      parsed.occurrences.map((row: { question: string }) => row.question),
    ).toEqual(['Fixture root', 'Fixture child'])
    expect(
      parsed.occurrences.every(
        (row: Record<string, unknown>) =>
          Object.keys(row).join(',') ===
          'id,node_id,parent_id,question,category',
      ),
    ).toBe(true)
    expect(parsed.current_id).toBe(parsed.occurrences[1].id)
    expect(await (await read()).text()).toBe(expected)
    const retry = await merge(
      [
        { id: 'new-root', node_id: a, parent_id: null },
        { id: 'new-child', node_id: b, parent_id: 'new-root' },
      ],
      'new-child',
    )
    expect(await retry.text()).toBe(expected)
    expect(
      (
        await (
          await getDb()
        ).query<{ count: number }>(
          'select count(*)::int count from journey_occurrence',
        )
      )[0].count,
    ).toBe(2)
  })

  it('keeps each session owner separate across both endpoints', async () => {
    const a = await makeNode('Fixture Alice'),
      b = await makeNode('Fixture Bob')
    const alice = await merge([{ id: 'a', node_id: a, parent_id: null }], 'a')
    const aliceBytes = await alice.text()
    auth.owner = 'bob'
    expect(await (await read()).json()).toEqual({
      occurrences: [],
      current_id: null,
    })
    const bob = await merge([{ id: 'b', node_id: b, parent_id: null }], 'b')
    const bobBytes = await bob.text()
    expect(bobBytes).not.toBe(aliceBytes)
    expect(await (await read()).text()).toBe(bobBytes)
    auth.owner = 'alice'
    expect(await (await read()).text()).toBe(aliceBytes)
  })

  it('preserves authentication failure propagation without returning a public or empty snapshot', async () => {
    auth.failure = new Error('Synthetic session lookup failure')
    await expect(read()).rejects.toThrow('Synthetic session lookup failure')
    await expect(merge([], null)).rejects.toThrow(
      'Synthetic session lookup failure',
    )
  })
})
