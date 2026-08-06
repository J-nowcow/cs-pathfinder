import { describe, it, expect } from 'vitest'
import { rankByCategory, quotaAt, pickVisible } from '@/lib/graph/representatives'

/**
 * 대표 뽑기.
 *
 * 지도가 두 상태뿐이었다 — 멀리서는 점, 가까이서는 전부. 재보니 폰 개요에서
 * 점 지름이 0.82px이고 확대해도 이름이 9px이라 둘 다 안 읽힌다. 그 사이를
 * 채우려고 배율마다 몇 개씩만 드러낸다.
 */
const N = (id: string, category: string) => ({ id, category })
const E = (parentId: string, childId: string) => ({ parentId, childId })

describe('rankByCategory', () => {
  /*
   * 선이 많이 닿은 질문이 그 구간의 입구다.
   *
   * 처음 쓴 시험은 셋을 삼각형으로 이어서 차수가 전부 2였다. 동점이라 id 순으로
   * 갈렸고 시험이 실패했다 — 시험이 재려던 것을 못 재고 있었다.
   */
  it('puts the most connected question first', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => N(id, '네트워크'))
    const edges = [E('b', 'a'), E('b', 'c'), E('b', 'd')] // b만 차수 3, 나머지 1
    const rank = rankByCategory(nodes, edges)
    expect(rank.get('b')).toBe(0)
  })

  /* 카테고리마다 따로 센다. 큰 분야가 작은 분야의 자리를 먹으면 안 된다 */
  it('ranks each category on its own', () => {
    const nodes = [N('n1', '네트워크'), N('n2', '네트워크'), N('d1', '데이터베이스')]
    const edges = [E('n1', 'n2')]
    const rank = rankByCategory(nodes, edges)
    // 선이 하나도 없어도 자기 분야에서는 1등이다
    expect(rank.get('d1')).toBe(0)
  })

  /* 동점이 흔들리면 확대할 때마다 다른 이름이 나타난다 */
  it('breaks ties the same way every time', () => {
    const nodes = [N('b', '네트워크'), N('a', '네트워크')]
    const first = rankByCategory(nodes, [])
    const second = rankByCategory(nodes.slice().reverse(), [])
    expect(first.get('a')).toBe(second.get('a'))
    expect(first.get('a')).toBe(0)
  })

  /* 모든 노드가 순위를 받는다. 빠지면 아무 배율에서도 안 보인다 */
  it('ranks every node', () => {
    const nodes = [N('a', '네트워크'), N('b', '데이터베이스'), N('c', '모바일')]
    const rank = rankByCategory(nodes, [])
    expect(rank.size).toBe(3)
  })

  /* 목록에 없는 노드로 뻗는 선은 무시한다. 화면 밖 노드가 순위를 흔들면 안 된다 */
  it('ignores edges that reach outside the list', () => {
    const nodes = [N('a', '네트워크'), N('b', '네트워크')]
    const rank = rankByCategory(nodes, [E('a', 'ghost'), E('b', 'ghost2')])
    expect(rank.size).toBe(2)
  })

  it('handles an empty map', () => {
    expect(rankByCategory([], []).size).toBe(0)
  })
})

describe('quotaAt', () => {
  /*
   * 멀리서는 이름을 안 보여준다.
   *
   * 처음엔 분야마다 하나씩 띄웠는데 만들고 재보니 안 들어갔다 — 카드가 168px,
   * 분야가 열이라 1,680px가 필요한데 폰은 390px다. 7쌍이 겹치고 분야 이름까지
   * 가렸다. 개요는 분야와 규모만 깨끗하게 보여준다.
   */
  it('shows no titles at the overview', () => {
    expect(quotaAt(0.03)).toBe(0)
  })

  /* 가까이 가면 전부 */
  it('shows everything up close', () => {
    expect(quotaAt(1)).toBe(Infinity)
  })

  /*
   * 배율이 오르면 개수도 오른다.
   *
   * 이게 뒤집히면 확대했는데 이름이 사라진다. 사용자가 가장 이상하게 느낄 동작이다.
   */
  it('never shows fewer as you zoom in', () => {
    const zooms = [0.03, 0.08, 0.12, 0.18, 0.3, 0.35, 0.5, 0.7, 1, 1.6]
    for (let i = 1; i < zooms.length; i += 1) {
      expect(quotaAt(zooms[i])).toBeGreaterThanOrEqual(quotaAt(zooms[i - 1]))
    }
  })
})

/**
 * 겹치는 자리는 건너뛴다.
 *
 * 순위만으로 뽑으면 겹친다. 선이 많이 닿은 질문끼리 가까이 모여 있는 일이
 * 흔하다 — 분야 안에서 대표 3개를 띄웠더니 6쌍이 겹쳤다.
 */
describe('pickVisible', () => {
  const P = (id: string, x: number, y: number, category = '네트워크') => ({ id, x, y, category })
  const rankOf = (...ids: string[]) => new Map(ids.map((id, i) => [id, i]))

  it('skips a card that would overlap one already picked', () => {
    const placed = [P('a', 0, 0), P('b', 10, 0), P('c', 500, 0)]
    const out = pickVisible(placed, rankOf('a', 'b', 'c'), 3, 100)
    expect([...out].sort()).toEqual(['a', 'c'])
  })

  /* 건너뛴 자리는 다음 순위가 받는다. 그래야 개수가 줄지 않는다 */
  it('lets a lower rank take the skipped slot', () => {
    const placed = [P('a', 0, 0), P('b', 10, 0), P('c', 500, 0), P('d', 1000, 0)]
    const out = pickVisible(placed, rankOf('a', 'b', 'c', 'd'), 3, 100)
    expect(out.size).toBe(3)
    expect(out.has('b')).toBe(false)
  })

  /* 배율이 오르면 문턱이 낮아져 더 들어간다 */
  it('fits more as the threshold shrinks', () => {
    const placed = [P('a', 0, 0), P('b', 50, 0), P('c', 100, 0)]
    expect(pickVisible(placed, rankOf('a', 'b', 'c'), 3, 80).size).toBe(2)
    expect(pickVisible(placed, rankOf('a', 'b', 'c'), 3, 10).size).toBe(3)
  })

  /* 카테고리마다 따로 센다. 큰 분야가 작은 분야 자리를 먹으면 안 된다 */
  it('counts the quota per category', () => {
    const placed = [
      P('n1', 0, 0, '네트워크'),
      P('n2', 500, 0, '네트워크'),
      P('d1', 0, 5000, '데이터베이스'),
    ]
    const rank = new Map([['n1', 0], ['n2', 1], ['d1', 0]])
    const out = pickVisible(placed, rank, 1, 100)
    expect([...out].sort()).toEqual(['d1', 'n1'])
  })

  /* 개요에서는 아무것도 안 뽑는다 */
  it('picks nothing when the quota is zero', () => {
    expect(pickVisible([P('a', 0, 0)], rankOf('a'), 0, 100).size).toBe(0)
  })

  /* 같은 조건이면 늘 같은 결과여야 한다. 흔들리면 확대할 때마다 달라진다 */
  it('is deterministic', () => {
    const placed = [P('a', 0, 0), P('b', 500, 0), P('c', 1000, 0)]
    const rank = rankOf('a', 'b', 'c')
    const first = [...pickVisible(placed, rank, 2, 100)].sort()
    const second = [...pickVisible([...placed].reverse(), rank, 2, 100)].sort()
    expect(first).toEqual(second)
  })
})

/**
 * 분야 이름 자리는 비운다.
 *
 * 카드끼리만 안 겹치게 했더니 분야 이름을 가렸다. 그 이름이 지도의 뼈대라
 * 카드보다 우선한다.
 */
describe('pickVisible · 피할 자리', () => {
  const P = (id: string, x: number, y: number) => ({ id, x, y, category: '네트워크' })

  it('keeps cards away from a reserved spot', () => {
    const placed = [P('a', 0, 0), P('b', 500, 0)]
    const rank = new Map([['a', 0], ['b', 1]])
    const out = pickVisible(placed, rank, 2, 100, [{ x: 0, y: 0 }], 60)
    expect(out.has('a')).toBe(false)
    expect(out.has('b')).toBe(true)
  })

  /* 피할 자리가 없으면 예전과 같이 동작한다 */
  it('behaves as before when nothing is reserved', () => {
    const placed = [P('a', 0, 0), P('b', 500, 0)]
    const rank = new Map([['a', 0], ['b', 1]])
    expect(pickVisible(placed, rank, 2, 100).size).toBe(2)
  })
})
