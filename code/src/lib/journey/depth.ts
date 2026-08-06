/**
 * 깊이를 색으로 인코딩한다.
 *
 * 이 서비스의 동사는 파고들기다. 얼마나 깊이 팠는지가 화면에서 읽혀야 한다.
 * 램프는 얕은 곳이 서늘하고 깊을수록 뜨겁다.
 *
 * 확장은 무한하지만 색은 5단에서 멈춘다. 더 늘리면 인접 단계가 구별되지 않아
 * 정보를 잃는다.
 */
export const DEPTH_LEVELS = 6

export function depthColor(depth: number): string {
  const level = Math.min(Math.max(depth, 0), DEPTH_LEVELS - 1)
  return `var(--d${level})`
}
