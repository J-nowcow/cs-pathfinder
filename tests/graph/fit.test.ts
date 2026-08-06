import { describe, it, expect } from 'vitest'
import { fitToPane } from '@/lib/graph/fit'

/**
 * 처음 열었을 때의 화면 맞춤.
 *
 * 좌표 고정 여백을 쓰던 시절에 폰에서 가로가 102%로 넘치고 세로는 46%만 찼다.
 * 삐져나오는 것(분야 이름·점)의 크기가 화면 고정인데 여백은 좌표 고정이라
 * 둘이 서로를 몰랐다.
 */
const none = { left: 0, right: 0, top: 0, bottom: 0 }

describe('fitToPane', () => {
  it('fits the node span into the pane', () => {
    const fit = fitToPane({
      xs: [0, 1000],
      ys: [0, 500],
      paneWidth: 400,
      paneHeight: 400,
      overhang: none,
    })!
    // 가로가 더 빡빡하므로 가로가 배율을 정한다. 3% 물러선 값이다
    expect(fit.zoom).toBeCloseTo(0.4 * 0.97, 5)
    expect(fit.centerX).toBe(500)
    expect(fit.centerY).toBe(250)
  })

  /*
   * 삐져나오는 만큼을 화면에서 뺀다. 그래야 이름이 붙어도 안 잘린다.
   */
  it('leaves room for what sticks out', () => {
    const fit = fitToPane({
      xs: [0, 1000],
      ys: [0, 1000],
      paneWidth: 400,
      paneHeight: 400,
      overhang: { left: 50, right: 50, top: 0, bottom: 0 },
    })!
    // 400 - 100 = 300 이 쓸 수 있는 폭이다. 여기서 3% 물러선다
    expect(fit.zoom).toBeCloseTo(0.3 * 0.97, 5)
  })

  /*
   * 이름이 위쪽에만 붙으면 그림이 아래로 쏠린다. 그만큼 올려준다.
   */
  it('shifts the camera up when things stick out above', () => {
    const fit = fitToPane({
      xs: [0, 1000],
      ys: [0, 1000],
      paneWidth: 400,
      paneHeight: 400,
      overhang: { left: 0, right: 0, top: 100, bottom: 0 },
    })!
    expect(fit.centerY).toBeLessThan(500)
  })

  /* 위아래가 같으면 안 옮긴다 */
  it('keeps the camera centered when overhang is even', () => {
    const fit = fitToPane({
      xs: [0, 1000],
      ys: [0, 1000],
      paneWidth: 400,
      paneHeight: 400,
      overhang: { left: 20, right: 20, top: 20, bottom: 20 },
    })!
    expect(fit.centerX).toBe(500)
    expect(fit.centerY).toBe(500)
  })

  /*
   * 여백이 화면을 다 먹으면 배율이 0이나 음수가 된다. 지도가 사라진다.
   */
  it('survives an overhang bigger than the pane', () => {
    const fit = fitToPane({
      xs: [0, 1000],
      ys: [0, 1000],
      paneWidth: 400,
      paneHeight: 400,
      overhang: { left: 500, right: 500, top: 500, bottom: 500 },
    })!
    expect(fit.zoom).toBeGreaterThan(0)
    expect(Number.isFinite(fit.zoom)).toBe(true)
  })

  /* 노드가 하나면 범위가 0이다. 나누기가 무너지면 안 된다 */
  it('survives a single node', () => {
    const fit = fitToPane({ xs: [7], ys: [7], paneWidth: 400, paneHeight: 400, overhang: none })!
    expect(Number.isFinite(fit.zoom)).toBe(true)
    expect(fit.centerX).toBe(7)
  })

  it('returns nothing for an empty map', () => {
    expect(fitToPane({ xs: [], ys: [], paneWidth: 400, paneHeight: 400, overhang: none })).toBeNull()
  })
})

/**
 * 3% 물러서기.
 *
 * 여백을 정확히 맞추면 삐져나오는 양을 1px 덜 잡았을 때 바로 잘린다. 실제로
 * 데스크톱에서 위를 맞추니 아래가 10px 잘렸다.
 */
describe('fitToPane · 안전 여유', () => {
  it('stops a little short of a perfect fit', () => {
    const fit = fitToPane({
      xs: [0, 100],
      ys: [0, 100],
      paneWidth: 100,
      paneHeight: 100,
      overhang: { left: 0, right: 0, top: 0, bottom: 0 },
    })!
    expect(fit.zoom).toBeLessThan(1)
    expect(fit.zoom).toBeGreaterThan(0.9)
  })
})
