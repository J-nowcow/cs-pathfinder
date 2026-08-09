import { EMBED_DIM } from '@/lib/embed/model'

/**
 * 각도를 정해 만든 단위벡터. 시험 전용.
 *
 * 처음 두 축에만 값을 세워 코사인 유사도가 정확히 `cos(각도차)`가 되게
 * 한다 — 시험이 문턱·정렬을 각도로 서술할 수 있다. `EMBED_DIM`을 따르므로
 * 차원이 바뀌어도 시험이 같이 움직인다.
 */
export function axis(deg: number): number[] {
  const rad = (deg * Math.PI) / 180
  const v = new Array(EMBED_DIM).fill(0)
  v[0] = Math.cos(rad)
  v[1] = Math.sin(rad)
  return v
}
