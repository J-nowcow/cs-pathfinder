import { describe, it, expect } from 'vitest'
import {
  startJourney,
  visit,
  pathTo,
  ancestorNodeIds,
  findOccurrenceByNode,
  moveTo,
  currentOccurrence,
  childrenOf,
} from '@/lib/journey/path'
import type { JourneyState, VisitedNode } from '@/lib/journey/types'

const node = (id: string, question = `질문 ${id}`): VisitedNode => ({
  id,
  question,
  category: '네트워크',
})

/** A ─ B ─ C 선형 경로를 만든다. */
function linear(): { state: JourneyState; ids: string[] } {
  const s0 = startJourney(node('A'))
  const a = s0.currentId!

  const r1 = visit(s0, a, node('B'))
  const r2 = visit(r1.state, r1.occurrenceId, node('C'))

  return { state: r2.state, ids: [a, r1.occurrenceId, r2.occurrenceId] }
}

describe('startJourney', () => {
  it('creates a single root occurrence with no parent', () => {
    const s = startJourney(node('A'))

    expect(s.occurrences).toHaveLength(1)
    expect(s.occurrences[0].parentId).toBeNull()
    expect(s.currentId).toBe(s.occurrences[0].id)
  })

  it('keeps the node id and question for later display', () => {
    const s = startJourney(node('A', 'TCP란?'))

    expect(s.occurrences[0].nodeId).toBe('A')
    expect(s.occurrences[0].question).toBe('TCP란?')
  })
})

describe('visit', () => {
  it('attaches a child occurrence and moves there', () => {
    const s0 = startJourney(node('A'))
    const r = visit(s0, s0.currentId!, node('B'))

    expect(r.state.occurrences).toHaveLength(2)
    expect(r.state.currentId).toBe(r.occurrenceId)

    const child = r.state.occurrences.find((o) => o.id === r.occurrenceId)!
    expect(child.parentId).toBe(s0.currentId)
  })

  it('creates two occurrences when the same node is reached from different parents', () => {
    // 설계의 핵심 성질이다. 같은 개념이라도 다른 맥락에서 지나면 다른 발자국이다.
    const s0 = startJourney(node('A'))
    const b = visit(s0, s0.currentId!, node('B'))
    const c = visit(b.state, s0.currentId!, node('C'))

    const viaB = visit(c.state, b.occurrenceId, node('X'))
    const viaC = visit(viaB.state, c.occurrenceId, node('X'))

    expect(viaB.occurrenceId).not.toBe(viaC.occurrenceId)
    expect(viaC.state.occurrences.filter((o) => o.nodeId === 'X')).toHaveLength(2)
  })

  it('reuses the occurrence when the same node is revisited from the same parent', () => {
    const s0 = startJourney(node('A'))
    const first = visit(s0, s0.currentId!, node('B'))
    const second = visit(first.state, s0.currentId!, node('B'))

    expect(second.occurrenceId).toBe(first.occurrenceId)
    expect(second.state.occurrences).toHaveLength(2)
  })

  it('leaves the state untouched when the parent does not exist', () => {
    const s0 = startJourney(node('A'))
    const r = visit(s0, 'no-such-occurrence', node('B'))

    expect(r.state).toBe(s0)
    expect(r.occurrenceId).toBe(s0.currentId)
  })
})

describe('pathTo', () => {
  it('returns the chain from root to the target in order', () => {
    const { state, ids } = linear()
    expect(pathTo(state, ids[2]).map((o) => o.nodeId)).toEqual(['A', 'B', 'C'])
  })

  it('returns just the root for the root itself', () => {
    const { state, ids } = linear()
    expect(pathTo(state, ids[0]).map((o) => o.nodeId)).toEqual(['A'])
  })

  it('returns empty for an unknown occurrence', () => {
    const { state } = linear()
    expect(pathTo(state, 'nope')).toEqual([])
  })

  it('does not loop forever when parent links form a cycle', () => {
    // 저장된 상태가 손상될 수 있다. 화면이 멈추는 것보다 잘린 경로가 낫다.
    const state: JourneyState = {
      occurrences: [
        { id: 'x', nodeId: 'A', parentId: 'y', question: 'q', category: 'c' },
        { id: 'y', nodeId: 'B', parentId: 'x', question: 'q', category: 'c' },
      ],
      currentId: 'x',
    }

    const path = pathTo(state, 'x')
    expect(path.length).toBeLessThanOrEqual(2)
  })
})

describe('ancestorNodeIds', () => {
  it('includes the target node itself so the server can detect a self loop', () => {
    const { state, ids } = linear()
    expect(ancestorNodeIds(state, ids[2])).toEqual(['A', 'B', 'C'])
  })

  it('returns empty for an unknown occurrence', () => {
    const { state } = linear()
    expect(ancestorNodeIds(state, 'nope')).toEqual([])
  })
})

describe('findOccurrenceByNode', () => {
  it('finds the occurrence on the current path for an ancestor jump', () => {
    const { state, ids } = linear()
    expect(findOccurrenceByNode(state, ids[2], 'B')).toBe(ids[1])
  })

  it('returns null when the node is not an ancestor', () => {
    const { state, ids } = linear()
    expect(findOccurrenceByNode(state, ids[2], 'Z')).toBeNull()
  })
})

describe('moveTo', () => {
  it('moves the cursor to an existing occurrence', () => {
    const { state, ids } = linear()
    expect(moveTo(state, ids[0]).currentId).toBe(ids[0])
  })

  it('ignores an unknown occurrence', () => {
    const { state } = linear()
    expect(moveTo(state, 'nope')).toBe(state)
  })
})

describe('currentOccurrence', () => {
  it('returns the occurrence the cursor points at', () => {
    const { state, ids } = linear()
    expect(currentOccurrence(state)!.id).toBe(ids[2])
  })

  it('returns null for an empty journey', () => {
    expect(currentOccurrence({ occurrences: [], currentId: null })).toBeNull()
  })
})

describe('childrenOf', () => {
  it('lists the branches taken from an occurrence', () => {
    const s0 = startJourney(node('A'))
    const b = visit(s0, s0.currentId!, node('B'))
    const c = visit(b.state, s0.currentId!, node('C'))

    expect(childrenOf(c.state, s0.currentId!).map((o) => o.nodeId)).toEqual(['B', 'C'])
  })

  it('returns empty for a leaf', () => {
    const { state, ids } = linear()
    expect(childrenOf(state, ids[2])).toEqual([])
  })
})
