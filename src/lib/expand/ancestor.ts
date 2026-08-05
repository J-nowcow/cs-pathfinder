/**
 * 전역 그래프는 순환을 허용한다. 지식 관계에서는 순환이 자연스럽다.
 * TCP → 3-way handshake 도 맞고 3-way handshake → TCP 연결 수립 도 맞다.
 *
 * 대신 경로에서 막는다. 이미 지나온 질문을 자식으로 붙이지 않고 그 지점으로 점프시킨다.
 * 조상 검사는 현재 경로만 훑으므로 깊이에 비례한다.
 */
export function findAncestorHit(
  ancestorNodeIds: string[],
  candidateNodeId: string,
): number | null {
  const index = ancestorNodeIds.indexOf(candidateNodeId)
  return index === -1 ? null : index
}
