import { describe, it, expect } from 'vitest'
import { buildSnapshot, MAX_SNAPSHOT_NODES } from '@/lib/tree/snapshot'
import type { JourneyState, Occurrence } from '@/lib/journey/types'

const NODE = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`

function occ(id: string, node: number, parentId: string | null): Occurrence {
  return {
    id,
    nodeId: NODE(node),
    parentId,
    question: `질문 ${node}`,
    category: '네트워크',
  }
}

/** a → b → c 한 줄에 b 아래 가지 하나가 더 붙은 모양 */
function sample(): JourneyState {
  return {
    occurrences: [occ('a', 1, null), occ('b', 2, 'a'), occ('c', 3, 'b'), occ('d', 4, 'b')],
    currentId: 'c',
  }
}

describe('buildSnapshot', () => {
  it('keeps the parent link instead of flattening to node ids', () => {
    const res = buildSnapshot(sample())
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const byTemp = new Map(res.snapshot.rows.map((r) => [r.tempId, r]))
    expect(byTemp.get('a')!.parentTempId).toBeNull()
    expect(byTemp.get('b')!.parentTempId).toBe('a')
    expect(byTemp.get('c')!.parentTempId).toBe('b')
    expect(byTemp.get('d')!.parentTempId).toBe('b')
  })

  it('lists parents before children so a sequential insert can resolve them', () => {
    const res = buildSnapshot(sample())
    if (!res.ok) throw new Error('expected ok')

    const seen = new Set<string>()
    for (const row of res.snapshot.rows) {
      if (row.parentTempId !== null) expect(seen.has(row.parentTempId)).toBe(true)
      seen.add(row.tempId)
    }
  })

  it('reports the root node id', () => {
    const res = buildSnapshot(sample())
    if (!res.ok) throw new Error('expected ok')
    expect(res.snapshot.rootNodeId).toBe(NODE(1))
  })

  it('numbers siblings in the order they were dug', () => {
    const res = buildSnapshot(sample())
    if (!res.ok) throw new Error('expected ok')

    const kids = res.snapshot.rows.filter((r) => r.parentTempId === 'b')
    expect(kids.map((r) => [r.tempId, r.position])).toEqual([
      ['c', 0],
      ['d', 1],
    ])
  })

  it('keeps branches, not just the chain to the current node', () => {
    // 여기가 이 서비스의 자산이다. 한 줄만 박제하면 공유 화면이 빵부스러기와 같아진다
    const res = buildSnapshot(sample())
    if (!res.ok) throw new Error('expected ok')
    expect(res.snapshot.rows.map((r) => r.tempId).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('takes only the tree the reader is standing in when the session has several', () => {
    // 다른 루트에서 새로 시작하면 숲이 된다. tree.root_node_id는 하나뿐이다
    const state: JourneyState = {
      occurrences: [
        occ('a', 1, null),
        occ('b', 2, 'a'),
        occ('x', 7, null),
        occ('y', 8, 'x'),
      ],
      currentId: 'y',
    }

    const res = buildSnapshot(state)
    if (!res.ok) throw new Error('expected ok')
    expect(res.snapshot.rows.map((r) => r.tempId)).toEqual(['x', 'y'])
    expect(res.snapshot.rootNodeId).toBe(NODE(7))
  })

  it('rejects an empty journey', () => {
    const res = buildSnapshot({ occurrences: [], currentId: null })
    expect(res).toEqual({ ok: false, reason: 'empty' })
  })

  it('rejects when the current footprint is missing', () => {
    const res = buildSnapshot({ occurrences: [occ('a', 1, null)], currentId: 'gone' })
    expect(res).toEqual({ ok: false, reason: 'no_current' })
  })

  it('rejects a duplicated footprint id', () => {
    const res = buildSnapshot({
      occurrences: [occ('a', 1, null), occ('a', 2, null)],
      currentId: 'a',
    })
    expect(res).toEqual({ ok: false, reason: 'duplicate_id' })
  })

  it('rejects a node id that is not a uuid', () => {
    // 이 값은 그대로 외래키에 들어간다. DB에서 터지게 두면 500이 난다
    const bad: Occurrence = { ...occ('a', 1, null), nodeId: 'not-a-uuid' }
    const res = buildSnapshot({ occurrences: [bad], currentId: 'a' })
    expect(res).toEqual({ ok: false, reason: 'invalid_node_id' })
  })

  it('survives a parent cycle written by hand into sessionStorage', () => {
    const state: JourneyState = {
      occurrences: [occ('a', 1, 'b'), occ('b', 2, 'a')],
      currentId: 'a',
    }
    const res = buildSnapshot(state)
    expect(res).toEqual({ ok: false, reason: 'no_root' })
  })

  it('drops a footprint whose parent vanished', () => {
    // 고아는 어느 트리 소속인지 알 수 없다. 심으면 화면에 안 그려지는 행만 남는다
    const state: JourneyState = {
      occurrences: [occ('a', 1, null), occ('b', 2, 'a'), occ('z', 9, 'ghost')],
      currentId: 'b',
    }
    const res = buildSnapshot(state)
    if (!res.ok) throw new Error('expected ok')
    expect(res.snapshot.rows.map((r) => r.tempId)).toEqual(['a', 'b'])
  })

  it('rejects a tree bigger than the render limit', () => {
    const occurrences: Occurrence[] = [occ('n0', 0, null)]
    for (let i = 1; i <= MAX_SNAPSHOT_NODES; i += 1) {
      occurrences.push(occ(`n${i}`, i, 'n0'))
    }

    const res = buildSnapshot({ occurrences, currentId: 'n0' })
    expect(res).toEqual({ ok: false, reason: 'too_large' })
  })

  it('accepts a tree exactly at the limit', () => {
    const occurrences: Occurrence[] = [occ('n0', 0, null)]
    for (let i = 1; i < MAX_SNAPSHOT_NODES; i += 1) {
      occurrences.push(occ(`n${i}`, i, 'n0'))
    }

    const res = buildSnapshot({ occurrences, currentId: 'n0' })
    expect(res.ok).toBe(true)
  })
})
