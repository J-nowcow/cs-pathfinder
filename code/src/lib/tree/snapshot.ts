import type { JourneyState } from '@/lib/journey/types'

/**
 * 익명 경로를 공유 트리로 박제한다.
 *
 * 설계 §5가 못 박은 것부터. **노드 id 배열로 저장하지 않는다.** 배열은 스냅샷이 아니다.
 * 공유한 뒤 그 안의 두 노드 사이에 새 qedge가 생기면 과거에 공유한 트리의 모양이
 * 저절로 바뀐다. 살아있는 유도 부분그래프이지 박제가 아니다.
 *
 * 그래서 부모를 명시적으로 들고 나간다. 여기서 만드는 행이 tree_occurrence에
 * 그대로 들어간다.
 *
 * 입력은 sessionStorage에서 온다. 사용자가 언제든 손댈 수 있는 값이라
 * 전부 의심하고 시작한다.
 */

/**
 * 한 트리에 담을 수 있는 발자국 수.
 *
 * 지도 렌더 상한(MAP_NODE_LIMIT)과 같은 값이다. 그보다 크게 잡으면 심을 수는 있어도
 * 여는 순간 화면이 무너지는 트리가 생긴다. 열 수 없는 공유 링크는 없느니만 못하다.
 */
export const MAX_SNAPSHOT_NODES = 200

export type SnapshotRow = {
  /** 클라이언트 발자국 id. 서버 UUID로 갈아끼울 때 매핑 키로만 쓰고 저장하지 않는다 */
  tempId: string
  nodeId: string
  parentTempId: string | null
  position: number
}

export type Snapshot = {
  rootNodeId: string
  /** 부모가 항상 자식보다 앞이다. 순차 insert가 부모 UUID를 이미 알고 있게 된다 */
  rows: SnapshotRow[]
}

export type SnapshotReason =
  | 'empty'
  | 'no_current'
  | 'no_root'
  | 'duplicate_id'
  | 'invalid_node_id'
  | 'too_large'

export type SnapshotResult = { ok: true; snapshot: Snapshot } | { ok: false; reason: SnapshotReason }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildSnapshot(state: JourneyState): SnapshotResult {
  const { occurrences, currentId } = state

  if (occurrences.length === 0) return { ok: false, reason: 'empty' }
  if (occurrences.length > MAX_SNAPSHOT_NODES) return { ok: false, reason: 'too_large' }

  const byId = new Map<string, (typeof occurrences)[number]>()
  for (const o of occurrences) {
    if (byId.has(o.id)) return { ok: false, reason: 'duplicate_id' }
    if (!UUID_RE.test(o.nodeId)) return { ok: false, reason: 'invalid_node_id' }
    byId.set(o.id, o)
  }

  if (!currentId || !byId.has(currentId)) return { ok: false, reason: 'no_current' }

  // 읽던 자리에서 위로 올라가 뿌리를 찾는다.
  //
  // 세션 하나에 여정이 여럿일 수 있다. 홈으로 돌아가 다른 질문에서 새로 시작하면
  // 저장된 발자국이 숲이 된다. tree.root_node_id는 하나뿐이라 지금 서 있는 나무만 뜯어간다.
  //
  // 손으로 고친 저장소가 부모 순환을 만들면 이 루프가 안 끝난다. 방문 집합으로 끊는다.
  let rootId = currentId
  const climbed = new Set<string>()
  for (;;) {
    if (climbed.has(rootId)) return { ok: false, reason: 'no_root' }
    climbed.add(rootId)

    const parentId = byId.get(rootId)!.parentId
    // 부모를 가리키는데 그 부모가 없으면 어느 트리 소속인지 알 수 없다
    if (parentId === null || !byId.has(parentId)) break
    rootId = parentId
  }
  if (byId.get(rootId)!.parentId !== null) return { ok: false, reason: 'no_root' }

  // 자식 목록은 저장 순서를 그대로 쓴다. 사용자가 판 순서가 position이 된다.
  const childrenOf = new Map<string, string[]>()
  for (const o of occurrences) {
    if (o.parentId === null) continue
    const list = childrenOf.get(o.parentId) ?? []
    list.push(o.id)
    childrenOf.set(o.parentId, list)
  }

  // 너비 우선으로 편다. 부모가 반드시 먼저 나오므로 삽입 측이 위상 정렬을 또 할 필요가 없다.
  // 뿌리에서 못 닿는 발자국(다른 나무, 부모가 사라진 고아)은 자연히 빠진다.
  const rows: SnapshotRow[] = [{ tempId: rootId, nodeId: byId.get(rootId)!.nodeId, parentTempId: null, position: 0 }]
  const queue = [rootId]
  const placed = new Set<string>([rootId])

  while (queue.length > 0) {
    const parentTempId = queue.shift()!
    let position = 0

    for (const childId of childrenOf.get(parentTempId) ?? []) {
      if (placed.has(childId)) continue
      placed.add(childId)

      rows.push({ tempId: childId, nodeId: byId.get(childId)!.nodeId, parentTempId, position })
      position += 1
      queue.push(childId)
    }
  }

  return { ok: true, snapshot: { rootNodeId: byId.get(rootId)!.nodeId, rows } }
}
