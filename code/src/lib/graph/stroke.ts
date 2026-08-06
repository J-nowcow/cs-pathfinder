/**
 * 배율이 바뀌어도 선이 보이게 굵기를 정한다.
 *
 * 좌표계가 통째로 축소되므로 SVG 굵기도 함께 줄어든다. 질문 249개를 한 화면에
 * 넣으면 배율이 0.032까지 내려가는데, 그때 굵기 1.5는 화면에서 **0.048px**이
 * 된다. 선 196개가 전부 그려지고 있어도 사람 눈에는 하나도 없다. 실제로 그랬다.
 *
 * 글자에는 이미 같은 보정이 들어가 있다(`17 / zoom`). 선만 빠져 있었다.
 *
 * 다만 글자와 달리 선은 화면상 굵기를 완전히 고정하면 안 된다. 가까이 다가갔을
 * 때도 2px이면 카드 사이 관계가 굵은 밧줄로 보인다. 멀리서는 보이는 것이,
 * 가까이서는 방해되지 않는 것이 목표라 상한과 하한만 잡는다.
 */

/** 이보다 얇으면 화면에서 사라진다. 안티에일리어싱으로 흐려지는 선까지 감안한 값 */
const MIN_SCREEN_PX = 1.1

/** 가까이 갔을 때 이보다 굵으면 관계선이 아니라 밧줄로 보인다 */
const MAX_SCREEN_PX = 2.4

/**
 * 지금 배율에서 쓸 좌표계 굵기.
 *
 * 화면상 굵기가 [1.1, 2.4]px 안에 들어오도록 좌표계 값을 되돌려 계산한다.
 * `base`는 배율 1일 때의 굵기다.
 */
export function strokeWidthAt(zoom: number, base: number): number {
  // 배율이 0이거나 음수면 계산이 무너진다. 화면 전환 순간에 0이 스쳐 지나간다
  if (!Number.isFinite(zoom) || zoom <= 0) return base

  const onScreen = base * zoom
  if (onScreen < MIN_SCREEN_PX) return MIN_SCREEN_PX / zoom
  if (onScreen > MAX_SCREEN_PX) return MAX_SCREEN_PX / zoom
  return base
}
