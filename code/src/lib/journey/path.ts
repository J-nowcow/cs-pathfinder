import type { JourneyState, Occurrence, VisitedNode } from '@/lib/journey/types'

/**
 * occurrence ID 생성기.
 *
 * crypto.randomUUID는 안전 컨텍스트에서만 있다. 로컬 HTTP 개발 중에도 돌아야 하므로
 * 없으면 시각과 난수를 섞은 값으로 떨어진다. 전역 고유성이 필요한 값이 아니라
 * 한 브라우저 세션 안에서만 구분되면 된다.
 */
function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `occ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function startJourney(node: VisitedNode): JourneyState {
  const root: Occurrence = {
    id: newId(),
    nodeId: node.id,
    parentId: null,
    question: node.question,
    category: node.category,
  }
  return { occurrences: [root], currentId: root.id }
}

/**
 * 부모 아래에 노드를 붙이고 그리로 이동한다.
 *
 * 같은 부모에서 같은 노드로 두 번 가면 기존 발자국을 재사용한다.
 * 새로 만들면 추천을 두 번 누른 것만으로 미니맵에 쌍둥이 노드가 생긴다.
 *
 * 반대로 부모가 다르면 반드시 새 발자국이다. 같은 개념이라도 다른 맥락에서
 * 지난 것이므로 경로가 다르다.
 */
export function visit(
  state: JourneyState,
  parentOccurrenceId: string,
  node: VisitedNode,
): { state: JourneyState; occurrenceId: string } {
  const parent = state.occurrences.find((o) => o.id === parentOccurrenceId)
  if (!parent) return { state, occurrenceId: state.currentId ?? '' }

  const existing = state.occurrences.find(
    (o) => o.parentId === parentOccurrenceId && o.nodeId === node.id,
  )
  if (existing) {
    return { state: { ...state, currentId: existing.id }, occurrenceId: existing.id }
  }

  const child: Occurrence = {
    id: newId(),
    nodeId: node.id,
    parentId: parentOccurrenceId,
    question: node.question,
    category: node.category,
  }

  return {
    state: { occurrences: [...state.occurrences, child], currentId: child.id },
    occurrenceId: child.id,
  }
}

/**
 * 루트부터 대상까지의 체인.
 *
 * 저장된 상태가 손상돼 부모 링크가 순환하면 화면이 멈춘다.
 * 방문 집합으로 잘라낸다. 잘린 경로가 멈춘 화면보다 낫다.
 */
export function pathTo(state: JourneyState, occurrenceId: string): Occurrence[] {
  const byId = new Map(state.occurrences.map((o) => [o.id, o]))
  const chain: Occurrence[] = []
  const seen = new Set<string>()

  let cursor: string | null = occurrenceId
  while (cursor && !seen.has(cursor)) {
    const node: Occurrence | undefined = byId.get(cursor)
    if (!node) break
    seen.add(cursor)
    chain.push(node)
    cursor = node.parentId
  }

  return chain.reverse()
}

/**
 * 서버에 보낼 조상 노드 ID.
 *
 * 대상 자신을 포함한다. 자기 자신으로 다시 뻗는 확장도 조상 중복으로 잡혀야 한다.
 */
export function ancestorNodeIds(state: JourneyState, occurrenceId: string): string[] {
  return pathTo(state, occurrenceId).map((o) => o.nodeId)
}

/** 조상 점프 응답을 받았을 때 어느 발자국으로 보낼지 찾는다 */
export function findOccurrenceByNode(
  state: JourneyState,
  fromOccurrenceId: string,
  nodeId: string,
): string | null {
  const hit = pathTo(state, fromOccurrenceId).find((o) => o.nodeId === nodeId)
  return hit?.id ?? null
}

/**
 * 저장된 여정에 없는 질문으로 들어왔을 때.
 *
 * **전에는 여기서 판 것이 통째로 날아갔다.** 그 노드가 저장된 여정에 없으면
 * 아무것도 안 하고 넘어갔는데, 화면이 이미 1개짜리 새 여정을 들고 있어서
 * 곧바로 그것이 저장소를 덮었다.
 *
 * 새 탭으로 질문을 열거나 공유 링크를 타고 들어오면 그렇게 된다. 홈이
 * "판 만큼 지도가 그려지고요"라고 약속하는데 그 자리에서 무너졌다.
 *
 * 버리지 않고 **새 뿌리로 붙인다.** 여정은 나무 하나가 아니라 숲이어도 된다 —
 * `layoutJourney`가 이미 뿌리를 전부 훑는다. 서로 안 이어진 갈래로 남는 것이
 * 맞다. 실제로 안 이어진 경로이고, 억지로 이으면 가지 않은 길을 그린 것이 된다.
 *
 * 이미 뿌리로 있는 질문이면 그리로 옮기기만 한다. 안 그러면 그 질문을 열
 * 때마다 쌍둥이 뿌리가 하나씩 늘어난다.
 */
export function enterAsRoot(
  state: JourneyState,
  node: VisitedNode,
): { state: JourneyState; occurrenceId: string } {
  const existing = state.occurrences.find((o) => o.parentId === null && o.nodeId === node.id)
  if (existing) {
    return { state: { ...state, currentId: existing.id }, occurrenceId: existing.id }
  }

  const root: Occurrence = {
    id: newId(),
    nodeId: node.id,
    parentId: null,
    question: node.question,
    category: node.category,
  }
  return {
    state: { occurrences: [...state.occurrences, root], currentId: root.id },
    occurrenceId: root.id,
  }
}

export function moveTo(state: JourneyState, occurrenceId: string): JourneyState {
  if (!state.occurrences.some((o) => o.id === occurrenceId)) return state
  return { ...state, currentId: occurrenceId }
}

export function currentOccurrence(state: JourneyState): Occurrence | null {
  if (!state.currentId) return null
  return state.occurrences.find((o) => o.id === state.currentId) ?? null
}

export function childrenOf(state: JourneyState, occurrenceId: string): Occurrence[] {
  return state.occurrences.filter((o) => o.parentId === occurrenceId)
}
