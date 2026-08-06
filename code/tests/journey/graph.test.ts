import { describe, it, expect } from 'vitest'
import { layoutJourney, cullAround, MAP_NODE_LIMIT } from '@/lib/journey/graph'
import { startJourney, visit } from '@/lib/journey/path'
import type { JourneyState, VisitedNode } from '@/lib/journey/types'

const node = (id: string): VisitedNode => ({ id, question: `질문 ${id}`, category: '네트워크' })

/** 루트 A에서 자식 n개를 뻗는다. */
function fan(n: number): JourneyState {
  let s = startJourney(node('A'))
  const root = s.currentId!
  for (let i = 0; i < n; i += 1) s = visit(s, root, node(`C${i}`)).state
  return s
}

/** 깊이 n의 선형 사슬을 만든다. 마지막 발자국이 현재 위치다. */
function chain(n: number): JourneyState {
  let s = startJourney(node('N0'))
  let cursor = s.currentId!
  for (let i = 1; i < n; i += 1) {
    const r = visit(s, cursor, node(`N${i}`))
    s = r.state
    cursor = r.occurrenceId
  }
  return s
}

describe('layoutJourney', () => {
  it('places a single root at the origin', () => {
    const l = layoutJourney(startJourney(node('A')))

    expect(l.nodes).toHaveLength(1)
    expect(l.nodes[0].x).toBe(0)
    expect(l.nodes[0].y).toBe(0)
    expect(l.edges).toHaveLength(0)
  })

  it('increases x with depth', () => {
    const l = layoutJourney(chain(4))
    const xs = [...l.nodes].sort((a, b) => a.depth - b.depth).map((n) => n.x)

    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  })

  it('separates siblings on the y axis', () => {
    const l = layoutJourney(fan(3))
    const ys = l.nodes.filter((n) => n.depth === 1).map((n) => n.y)

    expect(new Set(ys).size).toBe(3)
  })

  it('centers a parent between its children', () => {
    const l = layoutJourney(fan(2))
    const root = l.nodes.find((n) => n.depth === 0)!
    const kids = l.nodes.filter((n) => n.depth === 1).map((n) => n.y)

    expect(root.y).toBeGreaterThan(Math.min(...kids) - 1)
    expect(root.y).toBeLessThan(Math.max(...kids) + 1)
  })

  it('emits one edge per non-root occurrence', () => {
    const s = fan(3)
    const l = layoutJourney(s)

    expect(l.edges).toHaveLength(s.occurrences.length - 1)
  })

  it('marks only the current path as onPath', () => {
    let s = startJourney(node('A'))
    const root = s.currentId!
    const kept = visit(s, root, node('B'))
    s = visit(kept.state, root, node('C')).state
    s = { ...s, currentId: kept.occurrenceId }

    const l = layoutJourney(s)
    const onPath = l.nodes.filter((n) => n.onPath).map((n) => n.nodeId).sort()

    expect(onPath).toEqual(['A', 'B'])
  })

  it('marks the edges along the current path', () => {
    const l = layoutJourney(chain(3))
    expect(l.edges.every((e) => e.onPath)).toBe(true)
  })

  it('reports bounds that cover every node', () => {
    const l = layoutJourney(fan(4))

    expect(l.bounds.width).toBeGreaterThanOrEqual(Math.max(...l.nodes.map((n) => n.x)))
    expect(l.bounds.height).toBeGreaterThanOrEqual(Math.max(...l.nodes.map((n) => n.y)))
  })

  it('carries the question so the renderer needs no extra lookup', () => {
    const l = layoutJourney(startJourney(node('A')))
    expect(l.nodes[0].label).toBe('질문 A')
  })

  it('handles an empty journey', () => {
    const l = layoutJourney({ occurrences: [], currentId: null })
    expect(l.nodes).toEqual([])
    expect(l.edges).toEqual([])
  })
})

describe('cullAround', () => {
  it('keeps everything when under the limit', () => {
    const l = layoutJourney(fan(5))
    expect(cullAround(l, l.nodes[0].occurrenceId, 200).nodes).toHaveLength(l.nodes.length)
  })

  it('never exceeds the limit', () => {
    const l = layoutJourney(fan(50))
    expect(cullAround(l, l.nodes[0].occurrenceId, 10).nodes).toHaveLength(10)
  })

  it('always keeps the focus node', () => {
    const l = layoutJourney(fan(50))
    const focus = l.nodes[l.nodes.length - 1].occurrenceId
    const culled = cullAround(l, focus, 5)

    expect(culled.nodes.some((n) => n.occurrenceId === focus)).toBe(true)
  })

  it('prefers nodes closer to the focus', () => {
    // 깊이 30 사슬에서 끝을 보면 가까운 조상이 남고 루트 근처가 잘린다.
    const s = chain(30)
    const l = layoutJourney(s)
    const focus = l.nodes.find((n) => n.depth === 29)!.occurrenceId
    const culled = cullAround(l, focus, 5)

    expect(Math.min(...culled.nodes.map((n) => n.depth))).toBe(25)
  })

  it('drops edges whose endpoint was culled', () => {
    // 끊긴 간선이 남으면 React Flow가 경고를 뱉고 렌더가 지저분해진다.
    const l = layoutJourney(chain(30))
    const focus = l.nodes.find((n) => n.depth === 29)!.occurrenceId
    const culled = cullAround(l, focus, 5)

    const kept = new Set(culled.nodes.map((n) => n.occurrenceId))
    expect(culled.edges.every((e) => kept.has(e.from) && kept.has(e.to))).toBe(true)
  })

  it('reports whether anything was hidden so the ui can say so', () => {
    const l = layoutJourney(fan(50))

    expect(cullAround(l, l.nodes[0].occurrenceId, 10).hiddenCount).toBe(41)
    expect(cullAround(l, l.nodes[0].occurrenceId, 200).hiddenCount).toBe(0)
  })

  it('caps at 200 nodes by default per the spec', () => {
    expect(MAP_NODE_LIMIT).toBe(200)
  })

  it('returns the layout untouched for an unknown focus', () => {
    const l = layoutJourney(fan(3))
    expect(cullAround(l, 'nope', 2).nodes).toHaveLength(l.nodes.length)
  })
})
