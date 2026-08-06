import { describe, it, expect } from 'vitest'
import { layoutGlobal, categoryCenter, categorySummary } from '@/lib/graph/layout'
import { CATEGORIES } from '@/lib/tree/categories'

/**
 * 지도의 자리.
 *
 * 지켜야 하는 것은 하나다 — **같은 질문은 항상 같은 자리에 있어야 한다.**
 * 어제 왼쪽 위에서 본 것이 오늘 오른쪽 아래에 있으면 지도를 외울 수 없고,
 * 외울 수 없으면 목록보다 나을 것이 없다.
 */
const item = (id: string, category = '네트워크') => ({ id, category })

describe('layoutGlobal', () => {
  it('gives every item a coordinate', () => {
    const out = layoutGlobal([item('a'), item('b')])
    expect(out.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })

  /** 힘 기반 배치를 안 쓰는 이유가 이것이다. 노드가 늘어도 앞자리는 그대로다 */
  it('does not move existing items when a new one is added', () => {
    const before = layoutGlobal([item('a'), item('b')])
    const after = layoutGlobal([item('a'), item('b'), item('c')])

    for (const p of before) {
      const same = after.find((q) => q.id === p.id)!
      expect([same.x, same.y]).toEqual([p.x, p.y])
    }
  })

  it('is deterministic across calls', () => {
    const a = layoutGlobal([item('x', '데이터베이스'), item('y', '모바일')])
    const b = layoutGlobal([item('x', '데이터베이스'), item('y', '모바일')])
    expect(a).toEqual(b)
  })

  /** 카테고리가 자리의 근거다. 선이 없어도 무엇이 어디 있는지는 보여야 한다 */
  it('keeps a category together', () => {
    const out = layoutGlobal([
      item('a', '네트워크'),
      item('b', '모바일'),
      item('c', '네트워크'),
    ])
    const net = out.filter((p) => p.category === '네트워크')
    const center = categoryCenter('네트워크')

    for (const p of net) {
      const d = Math.hypot(p.x - center.x, p.y - center.y)
      expect(d).toBeLessThan(800)
    }
  })

  it('puts different categories apart', () => {
    const a = categoryCenter(CATEGORIES[0])
    const b = categoryCenter(CATEGORIES[5])
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1000)
  })

  /** 겹치면 어느 것이 어느 것인지 못 읽는다 */
  it('does not stack two items on the same spot', () => {
    const out = layoutGlobal(Array.from({ length: 30 }, (_, i) => item(`n${i}`)))
    const spots = new Set(out.map((p) => `${p.x},${p.y}`))
    expect(spots.size).toBe(out.length)
  })

  /** 목록에 없는 카테고리도 사라지면 안 된다 */
  it('still places an unknown category somewhere', () => {
    const [p] = layoutGlobal([item('a', '알 수 없는 분류')])
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
  })
})

describe('categorySummary', () => {
  it('counts per category in the list order', () => {
    const out = categorySummary([
      item('a', '모바일'),
      item('b', '데이터베이스'),
      item('c', '데이터베이스'),
    ])
    expect(out.map((g) => g.category)).toEqual(['데이터베이스', '모바일'])
    expect(out.map((g) => g.count)).toEqual([2, 1])
  })

  it('sits each summary on its category center', () => {
    const [g] = categorySummary([item('a', '네트워크')])
    expect([g.x, g.y]).toEqual([categoryCenter('네트워크').x, categoryCenter('네트워크').y])
  })
})
