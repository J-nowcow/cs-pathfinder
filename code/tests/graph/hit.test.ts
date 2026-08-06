import { describe, it, expect } from 'vitest'
import { nearestGaps, hitSizeFor } from '@/lib/graph/hit'

/**
 * 눌러야 할 점과 실제로 눌리는 점이 같은가.
 *
 * 판정 영역을 손가락 크기(화면 44px)로만 잡았더니 개요 배율에서 좌표
 * 1400 단위가 넘었다. 점 사이가 그보다 촘촘한 자리에서는 앞 점이 뒷 점을
 * 통째로 덮어, 보이는 A를 눌러도 B가 열렸다. 실측에서 화면 안 259개 중
 * 자기 자신이 최상단인 것이 15개뿐이었다.
 */
describe('nearestGaps', () => {
  it('가장 가까운 이웃까지 거리를 잰다', () => {
    const g = nearestGaps([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 30, y: 0 },
      { id: 'c', x: 0, y: 100 },
    ])
    expect(g.get('a')).toBe(30)
    expect(g.get('b')).toBe(30)
    expect(g.get('c')).toBe(100)
  })

  /* 혼자면 좁힐 이유가 없다. 0을 주면 누를 수 없게 된다 */
  it('혼자면 무한이다', () => {
    expect(nearestGaps([{ id: 'a', x: 0, y: 0 }]).get('a')).toBe(Infinity)
  })

  it('빈 지도에서 터지지 않는다', () => {
    expect(nearestGaps([]).size).toBe(0)
  })
})

describe('hitSizeFor', () => {
  /* 넉넉한 자리에서는 손가락 크기를 그대로 쓴다 */
  it('이웃이 멀면 바라는 크기를 준다', () => {
    expect(hitSizeFor(5000, 7, 1400)).toBe(1400)
  })

  /* 여기가 요점이다. 이웃보다 커지면 옆 점을 삼킨다 */
  it('이웃보다 커지지 않는다', () => {
    expect(hitSizeFor(300, 7, 1400)).toBe(300)
  })

  /*
   * **보이는 것을 못 누르는 쪽이 더 나쁘다.**
   *
   * 점끼리 이미 겹칠 만큼 촘촘하면 거기서는 어차피 하나를 고를 수 없다.
   * 그 자리는 확대해서 푸는 것이 맞고, 판정 영역을 0으로 만들면 안 된다.
   */
  it('점보다 작아지지 않는다', () => {
    expect(hitSizeFor(2, 7, 1400)).toBe(7)
  })

  it('혼자여도 바라는 크기를 넘지 않는다', () => {
    expect(hitSizeFor(Infinity, 7, 1400)).toBe(1400)
  })
})

/**
 * 실제 배치에 걸어 본다.
 *
 * 단위 시험만으로는 "겹침이 실제로 사라지는가"를 못 본다. 촘촘한 격자를
 * 만들어 이웃끼리 판정 영역이 실제로 안 겹치는지 센다.
 */
describe('겹침이 사라지는가', () => {
  it('촘촘한 격자에서 어떤 두 판정 영역도 겹치지 않는다', () => {
    const placed = []
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) placed.push({ id: `${i}-${j}`, x: i * 120, y: j * 120 })
    }
    const gaps = nearestGaps(placed)
    const size = new Map(placed.map((p) => [p.id, hitSizeFor(gaps.get(p.id)!, 7, 1400)]))

    let overlaps = 0
    for (const a of placed) {
      for (const b of placed) {
        if (a.id === b.id) continue
        const half = (size.get(a.id)! + size.get(b.id)!) / 2
        // 정사각형끼리는 x·y 양쪽이 겹쳐야 실제로 겹친다
        if (Math.abs(a.x - b.x) < half && Math.abs(a.y - b.y) < half) overlaps++
      }
    }
    expect(overlaps).toBe(0)
  })
})
