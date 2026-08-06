import { describe, it, expect } from 'vitest'
import {
  startJourney,
  enterAsRoot,
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

/**
 * 저장된 여정에 없는 질문으로 들어왔을 때.
 *
 * **전에는 판 것이 통째로 날아갔다.** 그 노드가 저장된 여정에 없으면 화면이
 * 아무것도 안 하고 넘어갔는데, 이미 1개짜리 새 여정을 들고 있어서 곧바로
 * 그것이 저장소를 덮었다. 새 탭으로 질문을 열거나 공유 링크를 타고 들어오면
 * 그렇게 됐다 — 지도 2 → 1, 깊이 1 → 0.
 *
 * 홈이 "판 만큼 지도가 그려지고요"라고 약속하는 자리라 그냥 두면 안 된다.
 */
describe('enterAsRoot', () => {
  it('판 것을 버리지 않는다', () => {
    const { state } = linear()
    const r = enterAsRoot(state, node('Z'))
    expect(r.state.occurrences).toHaveLength(4)
    expect(r.state.occurrences.map((o) => o.nodeId)).toEqual(['A', 'B', 'C', 'Z'])
  })

  it('새 질문을 뿌리로 붙이고 그리로 옮긴다', () => {
    const { state } = linear()
    const r = enterAsRoot(state, node('Z'))
    const added = r.state.occurrences.find((o) => o.nodeId === 'Z')!
    expect(added.parentId).toBeNull()
    expect(r.state.currentId).toBe(added.id)
    expect(r.occurrenceId).toBe(added.id)
  })

  /* 안 그러면 그 질문을 열 때마다 쌍둥이 뿌리가 하나씩 늘어난다 */
  it('이미 뿌리면 두 번 만들지 않는다', () => {
    const { state } = linear()
    const once = enterAsRoot(state, node('Z')).state
    const twice = enterAsRoot(once, node('Z'))
    expect(twice.state.occurrences).toHaveLength(4)
    expect(twice.occurrenceId).toBe(once.currentId)
  })

  /*
   * 뿌리가 아니라 가지로 있는 질문은 새 뿌리를 만든다.
   *
   * 같은 개념이라도 맥락이 다르면 다른 발자국이라는 이 여정 모델의 규칙을
   * 그대로 따른다. 여기서 B의 가지 자리로 끌고 가면 가지 않은 길이 그려진다.
   */
  it('가지로만 있던 질문은 새 뿌리가 된다', () => {
    const { state } = linear()
    const r = enterAsRoot(state, node('B'))
    expect(r.state.occurrences).toHaveLength(4)
    expect(r.state.occurrences.filter((o) => o.nodeId === 'B')).toHaveLength(2)
  })

  it('빈 여정에서도 돈다', () => {
    const r = enterAsRoot({ occurrences: [], currentId: null }, node('A'))
    expect(r.state.occurrences).toHaveLength(1)
    expect(r.state.currentId).toBe(r.occurrenceId)
  })
})
