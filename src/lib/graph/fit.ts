/**
 * 처음 열었을 때 지도를 화면에 맞춘다.
 *
 * 어려운 점은 **삐져나오는 것들의 크기가 화면 고정**이라는 데 있다. 분야 이름은
 * 배율과 무관하게 17px이고 점도 7px이다. 그런데 노드 좌표는 배율을 타므로,
 * 좌표 단위로 여백을 잡으면 배율이 정해지기 전에는 얼마를 비워야 할지 모른다.
 *
 * 원래는 좌표 고정값(가로 210, 위 420·아래 120)을 썼다. 재보니 폰에서 가로가
 * **102%**로 넘치고 세로는 **46%**만 찼다. 위아래로 각각 188·178px이 비었다.
 * 고정값이 실제 삐져나오는 양과 무관했기 때문이다.
 *
 * 화면 기준으로 풀면 순환이 사라진다. 노드 범위만으로 쓸 수 있는 폭을 먼저
 * 빼두고 그 안에 맞추면 된다 — 이름이 몇 px인지는 배율과 상관없이 안다.
 */
export type FitInput = {
  xs: number[]
  ys: number[]
  paneWidth: number
  paneHeight: number
  /** 화면 기준으로 노드 바깥에 삐져나오는 양(px) */
  overhang: { left: number; right: number; top: number; bottom: number }
}

export type Fit = { centerX: number; centerY: number; zoom: number }

/** 너무 작은 화면에서 여백이 화면을 다 먹는 것을 막는다 */
const MIN_USABLE = 0.35

export function fitToPane({ xs, ys, paneWidth, paneHeight, overhang }: FitInput): Fit | null {
  if (xs.length === 0 || ys.length === 0) return null

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  /*
   * 삐져나오는 만큼을 화면에서 먼저 뺀다.
   *
   * 남은 자리에 노드 범위를 넣으면, 배율이 정해진 뒤 이름이 붙어도 화면 안에
   * 들어온다. 여백이 화면을 다 먹으면 배율이 0이나 음수가 되므로 하한을 둔다.
   */
  const usableW = Math.max(paneWidth * MIN_USABLE, paneWidth - overhang.left - overhang.right)
  const usableH = Math.max(paneHeight * MIN_USABLE, paneHeight - overhang.top - overhang.bottom)

  // 노드가 하나뿐이면 범위가 0이다. 나누기가 무너진다
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)

  const zoom = Math.min(usableW / spanX, usableH / spanY)

  /*
   * 가운데는 **노드 범위**가 아니라 삐져나온 것까지 포함한 자리다.
   *
   * 이름이 위쪽에만 붙으므로 노드 범위 가운데에 맞추면 그림이 아래로 쏠린다.
   * 위아래 여백 차이의 절반만큼 올려준다.
   */
  const shiftY = (overhang.top - overhang.bottom) / 2 / zoom
  const shiftX = (overhang.left - overhang.right) / 2 / zoom

  return {
    centerX: (minX + maxX) / 2 - shiftX,
    centerY: (minY + maxY) / 2 - shiftY,
    zoom,
  }
}
