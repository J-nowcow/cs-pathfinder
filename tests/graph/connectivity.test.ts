import { describe, it, expect } from 'vitest'
import { analyzeConnectivity, verdict } from '@/lib/graph/connectivity'

/**
 * 지도를 만들기 전에 봐야 하는 숫자다.
 *
 * 선이 거의 없으면 화면은 지식망이 아니라 흩어진 카드가 된다. 그 사실을
 * 좌표 저장·LOD·바텀시트를 다 만든 뒤에 알면 늦다.
 */
const ids = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`)

describe('analyzeConnectivity', () => {
  it('counts nodes with no edge at all', () => {
    const c = analyzeConnectivity(ids(4), [{ parentId: 'n0', childId: 'n1' }])
    expect(c.isolated).toBe(2)
    expect(c.isolatedRatio).toBeCloseTo(0.5)
  })

  it('finds connected components largest first', () => {
    const c = analyzeConnectivity(ids(5), [
      { parentId: 'n0', childId: 'n1' },
      { parentId: 'n1', childId: 'n2' },
      { parentId: 'n3', childId: 'n4' },
    ])
    expect(c.components).toEqual([3, 2])
    expect(c.largestRatio).toBeCloseTo(0.6)
  })

  /** qedge는 순환을 허용한다. 무향으로 보므로 순환이 있어도 한 덩어리다 */
  it('treats a cycle as one component', () => {
    const c = analyzeConnectivity(ids(3), [
      { parentId: 'n0', childId: 'n1' },
      { parentId: 'n1', childId: 'n2' },
      { parentId: 'n2', childId: 'n0' },
    ])
    expect(c.components).toEqual([3])
    expect(c.isolated).toBe(0)
  })

  /**
   * ready가 아닌 노드로 이어진 간선은 화면에 안 나온다. 그것까지 세면
   * 숫자가 실제보다 좋아 보인다.
   */
  it('ignores edges pointing outside the node list', () => {
    const c = analyzeConnectivity(['n0', 'n1'], [
      { parentId: 'n0', childId: 'n1' },
      { parentId: 'n0', childId: '없는노드' },
    ])
    expect(c.edges).toBe(1)
    expect(c.isolated).toBe(0)
  })

  it('handles an empty graph without dividing by zero', () => {
    const c = analyzeConnectivity([], [])
    expect(c.isolatedRatio).toBe(0)
    expect(c.largestRatio).toBe(0)
    expect(c.medianDegree).toBe(0)
  })
})

describe('verdict', () => {
  it('says no when most nodes stand alone', () => {
    const c = analyzeConnectivity(ids(10), [{ parentId: 'n0', childId: 'n1' }])
    const v = verdict(c)
    expect(v.ready).toBe(false)
    expect(v.reason).toContain('고립')
  })

  /** 고립은 적어도 잘게 쪼개져 있으면 조망이 안 된다 */
  it('says no when the graph is shattered into small pieces', () => {
    const c = analyzeConnectivity(ids(10), [
      { parentId: 'n0', childId: 'n1' },
      { parentId: 'n2', childId: 'n3' },
      { parentId: 'n4', childId: 'n5' },
      { parentId: 'n6', childId: 'n7' },
      { parentId: 'n8', childId: 'n9' },
    ])
    expect(c.isolated).toBe(0)
    expect(verdict(c).ready).toBe(false)
    expect(verdict(c).reason).toContain('덩어리')
  })

  it('says yes when one big piece holds most of it', () => {
    const c = analyzeConnectivity(ids(6), [
      { parentId: 'n0', childId: 'n1' },
      { parentId: 'n1', childId: 'n2' },
      { parentId: 'n2', childId: 'n3' },
      { parentId: 'n3', childId: 'n4' },
      { parentId: 'n4', childId: 'n5' },
    ])
    expect(verdict(c).ready).toBe(true)
  })
})
