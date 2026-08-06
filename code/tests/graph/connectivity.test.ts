import { describe, it, expect } from 'vitest'
import { analyzeConnectivity, verdict, mapStatus } from '@/lib/graph/connectivity'

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

describe('mapStatus', () => {
  const c = (nodes: number, isolated: number, largestRatio = 1, componentCount = 1) => ({
    nodes,
    edges: 0,
    isolated,
    isolatedRatio: nodes === 0 ? 0 : isolated / nodes,
    components: Array.from({ length: componentCount }, () => 1),
    largestRatio,
    medianDegree: 0,
  })

  /*
   * 선이 거의 없는 화면에 아무 말이 없으면 사용자는 고장인 줄 안다.
   * 실측에서 고립이 54%였다.
   */
  it('says the map is still filling up when most nodes stand alone', () => {
    expect(mapStatus(c(249, 135))).toContain('114')
  })

  /* 촘촘해지고 하나로 묶였으면 아무 말도 안 한다. 잘 될 때 알리는 것은 소음이다 */
  it('stays quiet once the graph is linked and whole', () => {
    expect(mapStatus(c(249, 20, 0.7, 3))).toBeNull()
  })

  /*
   * 고립이 적어도 조각나 있으면 말한다.
   *
   * 처음에는 고립률만 봐서 여기가 뚫려 있었다. 관계 330개 시점에 고립이 20%로
   * 떨어져 침묵했는데, 같은 시점의 덩어리는 79개였고 가장 큰 것이 17%였다.
   */
  it('speaks up when the graph splits into islands', () => {
    expect(mapStatus(c(249, 49, 0.17, 79))).toContain('79')
  })

  /* 고립이 많으면 그쪽을 먼저 말한다. 둘 다 말하면 한 줄에 안 들어간다 */
  it('leads with isolation when both are bad', () => {
    expect(mapStatus(c(249, 135, 0.06, 120))).toContain('114')
  })

  /* 빈 지도는 따로 안내한다. 여기서 "0개만 이어져 있어요"는 헛말이다 */
  it('says nothing for an empty map', () => {
    expect(mapStatus(c(0, 0))).toBeNull()
  })
})
