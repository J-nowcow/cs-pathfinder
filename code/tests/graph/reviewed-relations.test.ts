import { describe, expect, it } from 'vitest'
import { SEED_RELATIONS } from '../../data/relations'
import type { MapEdge, MapNode } from '@/lib/db/graph'
import { projectReviewedRelation, REVIEWED_RELATION_DIRECTIONS } from '@/lib/graph/reviewed-relations'
import { getGraphNeighbors } from '@/lib/graph/relations'

function nodes(fromQuestion: string, toQuestion: string) {
  return new Map<string, MapNode>([
    ['from', { id: 'from', question: fromQuestion, category: 'test' }],
    ['to', { id: 'to', question: toQuestion, category: 'test' }],
  ])
}

describe('bounded display direction review', () => {
  it('ties every reviewed direction to an exact unchanged source pair, kind and original reason', () => {
    expect(REVIEWED_RELATION_DIRECTIONS).toHaveLength(20)
    for (const entry of REVIEWED_RELATION_DIRECTIONS) {
      const originals = SEED_RELATIONS.filter((row) => row.fromQuestion === entry.fromQuestion
        && row.toQuestion === entry.toQuestion && row.kind === entry.kind && row.reason === entry.reason)
      expect(originals).toHaveLength(1)
      const edge: MapEdge = { parentId: 'from', childId: 'to', kind: 'related', relationKind: entry.kind, reason: entry.reason }
      const before = structuredClone(edge)
      const projected = projectReviewedRelation(edge, nodes(entry.fromQuestion, entry.toQuestion))
      expect(projected).toEqual({ ...edge, relationDirection: entry.direction })
      expect(edge).toEqual(before)
    }
  })

  it('corrects thread-pool direction for display while preserving its stored IDs and reason', () => {
    const fromQuestion = '스레드 풀을 사용하는 주된 이유는 무엇인가?'
    const toQuestion = '프로세스와 스레드의 핵심 차이는 무엇인가?'
    const reason = '스레드 풀의 효율성을 이해하려면 먼저 프로세스와 스레드의 구조적 차이와 스레드 생성 비용에 대한 이해가 필요하다.'
    const raw: MapEdge = { parentId: 'from', childId: 'to', kind: 'related', relationKind: 'prerequisite', reason }
    const byId = nodes(fromQuestion, toQuestion)
    const edge = projectReviewedRelation(raw, byId)
    expect(edge).toEqual({ ...raw, relationDirection: 'reverse' })
    const data = { nodes: [...byId.values()], edges: [edge] }
    expect(getGraphNeighbors(data, 'from')[0]).toMatchObject({ id: 'to', direction: 'incoming', relationDirection: 'reverse', reason })
    expect(getGraphNeighbors(data, 'to')[0]).toMatchObject({ id: 'from', direction: 'outgoing', relationDirection: 'reverse', reason })
  })

  it('invalidates the review when either endpoint wording or the original reason changes', () => {
    const entry = REVIEWED_RELATION_DIRECTIONS[0]
    const edge: MapEdge = { parentId: 'from', childId: 'to', kind: 'related', relationKind: entry.kind, reason: entry.reason }
    expect(projectReviewedRelation({ ...edge, reason: `${entry.reason} changed` }, nodes(entry.fromQuestion, entry.toQuestion)).relationDirection).toBe('unreviewed')
    expect(projectReviewedRelation(edge, nodes(`${entry.fromQuestion} changed`, entry.toQuestion)).relationDirection).toBe('unreviewed')
    expect(projectReviewedRelation(edge, nodes(entry.fromQuestion, `${entry.toQuestion} changed`)).relationDirection).toBe('unreviewed')
  })

  it('preserves unreviewed kinds/reasons neutrally and leaves symmetric/traversal rows unchanged', () => {
    const byId = nodes('unreviewed A', 'unreviewed B')
    for (const relationKind of ['prerequisite', 'instance_of'] as const) {
      const raw: MapEdge = { parentId: 'from', childId: 'to', kind: 'related', relationKind, reason: 'unknown reason' }
      expect(projectReviewedRelation(raw, byId)).toEqual({ ...raw, relationDirection: 'unreviewed' })
    }
    for (const raw of [
      { parentId: 'from', childId: 'to', kind: 'walked' },
      { parentId: 'from', childId: 'to', kind: 'related', relationKind: 'shares_concept' },
      { parentId: 'from', childId: 'to', kind: 'related', relationKind: 'alternative' },
    ] as MapEdge[]) expect(projectReviewedRelation(raw, byId)).toBe(raw)
  })
})
