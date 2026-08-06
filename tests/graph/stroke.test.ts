import { describe, it, expect } from 'vitest'
import { strokeWidthAt } from '@/lib/graph/stroke'

/**
 * 선 굵기.
 *
 * 실측에서 나왔다. 질문 249개를 한 화면에 넣으면 배율이 0.032가 되고, 그때
 * 굵기 1.5는 화면에서 0.048px이었다. 선 196개가 전부 그려지고 있는데 하나도
 * 안 보였다. 글자에는 같은 보정이 있었고 선만 빠져 있었다.
 */
const screen = (zoom: number, base: number) => strokeWidthAt(zoom, base) * zoom

describe('strokeWidthAt', () => {
  /* 실제로 겪은 배율. 여기서 안 보이면 지도가 점 무더기다 */
  it('keeps lines visible at the overview zoom', () => {
    expect(screen(0.0317, 1.5)).toBeGreaterThanOrEqual(1)
  })

  /* 가까이 갔을 때 굵어지면 관계선이 밧줄로 보인다 */
  it('does not let lines swell when zoomed in', () => {
    expect(screen(1.6, 2)).toBeLessThanOrEqual(2.5)
  })

  /* 적당한 배율에서는 원래 굵기를 그대로 쓴다. 굳이 건드릴 이유가 없다 */
  it('leaves a sensible zoom alone', () => {
    expect(strokeWidthAt(1, 2)).toBe(2)
  })

  /* 걸어간 길이 관계보다 굵다는 구분은 어느 배율에서도 유지돼야 한다 */
  it('keeps walked lines thicker than related ones', () => {
    for (const z of [0.03, 0.2, 1, 1.6]) {
      expect(strokeWidthAt(z, 2)).toBeGreaterThanOrEqual(strokeWidthAt(z, 1.5))
    }
  })

  /* 배율 0이 화면 전환 순간에 스쳐 지나간다. 나눗셈이 무너지면 안 된다 */
  it('survives a zero or broken zoom', () => {
    expect(Number.isFinite(strokeWidthAt(0, 2))).toBe(true)
    expect(Number.isFinite(strokeWidthAt(Number.NaN, 2))).toBe(true)
  })
})
