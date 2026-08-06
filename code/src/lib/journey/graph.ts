import type { JourneyState } from '@/lib/journey/types'
import { pathTo } from '@/lib/journey/path'

/** 설계 §7. 이 이상은 React Flow 렌더가 무너진다 */
export const MAP_NODE_LIMIT = 200

/** 깊이 한 칸의 가로 간격 */
export const COL_W = 150
/** 형제 한 칸의 세로 간격 */
export const ROW_H = 60

export type LayoutNode = {
  occurrenceId: string
  nodeId: string
  label: string
  category: string
  depth: number
  x: number
  y: number
  /** 현재 읽고 있는 경로 위에 있는가 */
  onPath: boolean
  isCurrent: boolean
}

export type LayoutEdge = {
  from: string
  to: string
  onPath: boolean
}

export type Layout = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  bounds: { width: number; height: number }
  /** 컬링으로 감춰진 노드 수 */
  hiddenCount: number
}

/**
 * 여정 트리를 좌표로 편다.
 *
 * 미니맵(SVG)과 지도 모드(React Flow)가 이 결과를 공유한다. 좌표 계산을 두 벌로 두면
 * 같은 여정이 두 화면에서 다르게 보인다.
 *
 * x는 깊이에 비례한다. y는 리프에 순번을 주고 내부 노드를 자식 평균에 놓는다.
 * 결정론적이라 다시 그려도 노드가 튀지 않는다.
 */
export function layoutJourney(state: JourneyState): Layout {
  const byParent = new Map<string | null, string[]>()
  for (const o of state.occurrences) {
    const list = byParent.get(o.parentId) ?? []
    list.push(o.id)
    byParent.set(o.parentId, list)
  }

  const byId = new Map(state.occurrences.map((o) => [o.id, o]))
  const onPath = new Set(
    state.currentId ? pathTo(state, state.currentId).map((o) => o.id) : [],
  )

  const depth = new Map<string, number>()
  const row = new Map<string, number>()
  let nextLeafRow = 0

  // 순환이 섞여 들어오면 재귀가 끝나지 않는다. 방문 집합으로 끊는다.
  const seen = new Set<string>()

  const place = (id: string, d: number): number => {
    if (seen.has(id)) return row.get(id) ?? 0
    seen.add(id)
    depth.set(id, d)

    const children = byParent.get(id) ?? []
    if (children.length === 0) {
      const r = nextLeafRow
      nextLeafRow += 1
      row.set(id, r)
      return r
    }

    const childRows = children.map((c) => place(c, d + 1))
    const r = (Math.min(...childRows) + Math.max(...childRows)) / 2
    row.set(id, r)
    return r
  }

  for (const rootId of byParent.get(null) ?? []) place(rootId, 0)

  // 부모가 사라진 고아 발자국도 그린다. 안 그리면 조용히 없는 셈이 된다.
  for (const o of state.occurrences) {
    if (!seen.has(o.id)) place(o.id, 0)
  }

  const nodes: LayoutNode[] = state.occurrences.map((o) => ({
    occurrenceId: o.id,
    nodeId: o.nodeId,
    label: o.question,
    category: o.category,
    depth: depth.get(o.id) ?? 0,
    x: (depth.get(o.id) ?? 0) * COL_W,
    y: (row.get(o.id) ?? 0) * ROW_H,
    onPath: onPath.has(o.id),
    isCurrent: o.id === state.currentId,
  }))

  const edges: LayoutEdge[] = state.occurrences
    .filter((o) => o.parentId !== null && byId.has(o.parentId))
    .map((o) => ({
      from: o.parentId as string,
      to: o.id,
      onPath: onPath.has(o.id) && onPath.has(o.parentId as string),
    }))

  return {
    nodes,
    edges,
    bounds: {
      width: nodes.length ? Math.max(...nodes.map((n) => n.x)) : 0,
      height: nodes.length ? Math.max(...nodes.map((n) => n.y)) : 0,
    },
    hiddenCount: 0,
  }
}

/**
 * 포커스 노드 주변만 남긴다.
 *
 * 간선을 무방향으로 보고 BFS를 돌아 가까운 순으로 채운다. 부모 쪽만 남기면
 * 자기가 방금 뻗은 형제 가지가 사라져 지도가 쓸모없어진다.
 *
 * 노드만 자르면 안 된다. 끊긴 간선이 남으면 React Flow가 경고를 뱉는다.
 */
export function cullAround(layout: Layout, focusId: string, limit: number): Layout {
  if (layout.nodes.length <= limit) return layout
  if (!layout.nodes.some((n) => n.occurrenceId === focusId)) return layout

  const neighbors = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const list = neighbors.get(a) ?? []
    list.push(b)
    neighbors.set(a, list)
  }
  for (const e of layout.edges) {
    link(e.from, e.to)
    link(e.to, e.from)
  }

  const kept = new Set<string>([focusId])
  let frontier = [focusId]

  while (frontier.length > 0 && kept.size < limit) {
    const next: string[] = []
    for (const id of frontier) {
      for (const n of neighbors.get(id) ?? []) {
        if (kept.has(n) || kept.size >= limit) continue
        kept.add(n)
        next.push(n)
      }
    }
    frontier = next
  }

  const nodes = layout.nodes.filter((n) => kept.has(n.occurrenceId))

  return {
    nodes,
    edges: layout.edges.filter((e) => kept.has(e.from) && kept.has(e.to)),
    bounds: layout.bounds,
    hiddenCount: layout.nodes.length - nodes.length,
  }
}
