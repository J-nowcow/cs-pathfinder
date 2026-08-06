/**
 * 익명 사용자의 경로.
 *
 * 설계 §5의 journey_occurrence를 클라이언트에서 그대로 재현한다.
 * 계획 3에서 인증이 붙으면 같은 모양으로 서버에 flush한다.
 *
 * 방문을 노드 참조로만 기록하면 안 된다. 전역 간선이 A→C와 B→C일 때
 * 방문 집합 {A,B,C}에서 부분그래프를 유도하면 가본 적 없는 B→C가 그려진다.
 * 그래서 부모를 명시적으로 들고 있는 occurrence로 저장한다.
 */
export type Occurrence = {
  id: string
  nodeId: string
  /** 루트면 null */
  parentId: string | null
  /** 미니맵과 경로 칩의 라벨. 매번 서버를 다시 부르지 않으려고 들고 있는다 */
  question: string
  category: string
}

export type JourneyState = {
  occurrences: Occurrence[]
  currentId: string | null
}

/** 경로에 얹을 노드의 최소 정보. 해설 본문은 들고 다니지 않는다 */
export type VisitedNode = {
  id: string
  question: string
  category: string
}

export const EMPTY_JOURNEY: JourneyState = { occurrences: [], currentId: null }
