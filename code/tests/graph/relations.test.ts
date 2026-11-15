import { describe, expect, it } from 'vitest'
import type { MapData, MapEdge } from '@/lib/db/graph'
import { buildGraphNeighborIndex, getGraphNeighbors } from '@/lib/graph/relations'

const nodes = [
  { id: 'a', question: 'TCP', category: 'Network' },
  { id: 'b', question: 'Handshake', category: 'Network' },
  { id: 'c', question: 'UDP', category: 'Network' },
]

function map(edges: MapEdge[]): MapData {
  return { nodes, edges }
}

describe('graph neighbor meaning', () => {
  it('keeps a prerequisite direction relative to each selected endpoint', () => {
    const data = map([{ parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: 'TCP first' }])

    expect(getGraphNeighbors(data, 'a')).toEqual([
      { ...nodes[1], kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', direction: 'outgoing', reason: 'TCP first' },
    ])
    expect(getGraphNeighbors(data, 'b')).toEqual([
      { ...nodes[0], kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', direction: 'incoming', reason: 'TCP first' },
    ])
  })

  it('keeps abstraction-to-example orientation rather than reversing the meaning', () => {
    const data = map([{ parentId: 'a', childId: 'b', kind: 'related', relationKind: 'instance_of', relationDirection: 'forward' }])
    const index = buildGraphNeighborIndex(data)

    expect(index.get('a')?.[0]).toMatchObject({ id: 'b', relationKind: 'instance_of', relationDirection: 'forward', direction: 'outgoing' })
    expect(index.get('b')?.[0]).toMatchObject({ id: 'a', relationKind: 'instance_of', relationDirection: 'forward', direction: 'incoming' })
  })

  it.each(['alternative', 'shares_concept'] as const)('does not assign prerequisite order to %s', (relationKind) => {
    const data = map([{ parentId: 'a', childId: 'b', kind: 'related', relationKind }])
    expect(getGraphNeighbors(data, 'a')[0].direction).toBe('undirected')
    expect(getGraphNeighbors(data, 'b')[0].direction).toBe('undirected')
  })

  it('keeps legacy related edges generic while preserving actual traversal direction', () => {
    const data = map([
      { parentId: 'a', childId: 'b', kind: 'related', reason: 'Legacy reason' },
      { parentId: 'a', childId: 'c', kind: 'walked' },
    ])
    expect(getGraphNeighbors(data, 'b')[0]).toMatchObject({ kind: 'related', direction: 'undirected' })
    expect(getGraphNeighbors(data, 'c')[0]).toMatchObject({ kind: 'walked', direction: 'incoming' })
    expect(getGraphNeighbors(data, 'a')[1]).toMatchObject({ kind: 'walked', direction: 'outgoing' })
  })

  it('does not interpret unexpected metadata as a learning relation', () => {
    const data = map([
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'causes' as MapEdge['relationKind'] },
      { parentId: 'a', childId: 'c', kind: 'walked', relationKind: 'prerequisite' },
    ])
    const neighbors = getGraphNeighbors(data, 'a')
    expect(neighbors.every((n) => n.relationKind === undefined)).toBe(true)
    expect(neighbors[0].direction).toBe('undirected')
  })

  it('removes self loops and edges outside the supplied public node set', () => {
    const data = map([
      { parentId: 'a', childId: 'a', kind: 'walked' },
      { parentId: 'a', childId: 'private', kind: 'related', relationKind: 'prerequisite' },
      { parentId: 'private', childId: 'b', kind: 'walked' },
    ])
    expect(buildGraphNeighborIndex(data).size).toBe(0)
    expect(getGraphNeighbors(data, 'missing')).toEqual([])
  })

  it('keeps one card with typed meaning when legacy duplicates arrive in either order', () => {
    const edges: MapEdge[] = [
      { parentId: 'a', childId: 'b', kind: 'related' },
      { parentId: 'a', childId: 'b', kind: 'walked' },
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: 'Specific relationship' },
    ]
    const expected = getGraphNeighbors(map(edges), 'a')
    expect(expected).toHaveLength(1)
    expect(expected[0]).toMatchObject({ relationKind: 'prerequisite', relationDirection: 'forward', direction: 'outgoing' })
    expect(getGraphNeighbors(map([...edges].reverse()), 'a')).toEqual(expected)
  })

  it('uses a deterministic tie-break for multiple typed rows, without mutating stored data', () => {
    const edges: MapEdge[] = [
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'shares_concept', reason: 'Shared basis' },
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: 'Prior knowledge' },
    ]
    const before = structuredClone(edges)
    const expected = getGraphNeighbors(map(edges), 'a')
    expect(getGraphNeighbors(map([...edges].reverse()), 'a')).toEqual(expected)
    expect(expected).toHaveLength(1)
    expect(edges).toEqual(before)
  })

  it('chooses the same stored direction from both ends of reciprocal typed rows', () => {
    const edges: MapEdge[] = [
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: 'A before B' },
      { parentId: 'b', childId: 'a', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: 'B before A' },
    ]
    for (const order of [edges, [...edges].reverse()]) {
      expect(getGraphNeighbors(map(order), 'a')[0]).toMatchObject({ direction: 'outgoing', reason: 'A before B' })
      expect(getGraphNeighbors(map(order), 'b')[0]).toMatchObject({ direction: 'incoming', reason: 'A before B' })
    }
  })
  it('does not invent reading order from unaudited directional labels', () => {
    for (const relationKind of ['prerequisite', 'instance_of'] as const) {
      for (const relationDirection of [undefined, 'unreviewed'] as const) {
        const data = map([{ parentId: 'a', childId: 'b', kind: 'related', relationKind, relationDirection }])
        for (const id of ['a', 'b']) expect(getGraphNeighbors(data, id)[0]).toMatchObject({ relationKind, relationDirection: 'unreviewed', direction: 'undirected' })
      }
    }
  })

  it('normalizes reviewed reverse metadata without rewriting stored edges', () => {
    const data = map([{ parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'reverse', reason: 'B supports A' }])
    const before = structuredClone(data)
    expect(getGraphNeighbors(data, 'a')[0]).toMatchObject({ relationDirection: 'reverse', direction: 'incoming' })
    expect(getGraphNeighbors(data, 'b')[0]).toMatchObject({ relationDirection: 'reverse', direction: 'outgoing' })
    expect(data).toEqual(before)
  })

  it('prefers reviewed meaning over a competing unreviewed directed row', () => {
    const data = map([
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', reason: 'Unreviewed' },
      { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'instance_of', relationDirection: 'forward', reason: 'Reviewed example' },
    ])
    expect(getGraphNeighbors(data, 'a')[0]).toMatchObject({ relationKind: 'instance_of', relationDirection: 'forward', reason: 'Reviewed example' })
  })

  it('normalizes unknown direction metadata to neutral without outranking reviewed evidence', () => {
    const unknown: MapEdge = { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'prerequisite', relationDirection: 'future-policy' as MapEdge['relationDirection'] }
    expect(getGraphNeighbors(map([unknown]), 'a')[0]).toMatchObject({ relationKind: 'prerequisite', relationDirection: 'unreviewed', direction: 'undirected' })
    const reviewed: MapEdge = { parentId: 'a', childId: 'b', kind: 'related', relationKind: 'instance_of', relationDirection: 'forward' }
    for (const rows of [[unknown, reviewed], [reviewed, unknown]]) {
      expect(getGraphNeighbors(map(rows), 'a')[0]).toMatchObject({ relationKind: 'instance_of', relationDirection: 'forward' })
    }
  })

})
