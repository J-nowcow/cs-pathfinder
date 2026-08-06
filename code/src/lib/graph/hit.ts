/**
 * 누르는 자리가 옆 점을 삼키지 않게 한다.
 *
 * 손가락 크기(화면 44px)를 좌표로 바꾸면 개요 배율에서 1400 단위가 넘는다.
 * 점 사이가 그보다 촘촘하면 판정 영역이 서로 겹치고, **눈에 보이는 A를 눌렀는데
 * B가 열린다.** 실측에서 화면 안 259개 중 자기 자신이 최상단인 것이 15개뿐이었다.
 *
 * 겹치지 않게 하려면 판정 영역이 이웃까지 거리를 넘지 않으면 된다. 두 정사각형의
 * 중심이 `d`만큼 떨어져 있을 때 한 변을 `d`로 잡으면 서로 변에서 만나기만 한다.
 *
 * 다만 **점보다 작아지면 안 된다.** 보이는 것을 못 누르는 쪽이 더 나쁘다. 점끼리
 * 이미 겹칠 만큼 촘촘하면 거기서는 어차피 하나를 고를 수 없고, 그 자리는 확대해서
 * 푸는 것이 맞다.
 */

export type Placed = { id: string; x: number; y: number }

/**
 * 각 점에서 가장 가까운 다른 점까지의 거리.
 *
 * 자리는 배율과 무관하므로 한 번만 재면 된다. 249개면 62,001번 비교라 그냥
 * 전부 본다 — 공간 색인을 두면 코드가 늘고 이 규모에서는 이득이 없다.
 */
export function nearestGaps(placed: Placed[]): Map<string, number> {
  const out = new Map<string, number>()

  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]
    let best = Infinity
    for (let j = 0; j < placed.length; j++) {
      if (i === j) continue
      const b = placed[j]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < best) best = d
    }
    // 혼자면 좁힐 이유가 없다
    out.set(a.id, best)
  }
  return out
}

/**
 * 이 점이 가져도 되는 판정 영역의 한 변.
 *
 * @param gap    이웃까지 거리. 혼자면 Infinity
 * @param dotSize 보이는 점의 크기. 이보다 작아질 수 없다
 * @param wanted 손가락 기준으로 바라는 크기(화면 44px를 좌표로 옮긴 값)
 */
export function hitSizeFor(gap: number, dotSize: number, wanted: number): number {
  return Math.max(dotSize, Math.min(wanted, gap))
}
