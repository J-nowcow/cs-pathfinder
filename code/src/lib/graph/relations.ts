import type { MapData, MapEdge, MapNode } from '@/lib/db/graph'
import type { RelationKind } from '@/lib/db/relations'
import type { RelationDirection } from '@/lib/graph/reviewed-relations'

export type GraphNeighbor = MapNode & {
  kind: MapEdge['kind']
  relationKind?: RelationKind
  relationDirection?: RelationDirection
  /** Relative to the selected node, never a claim about causality or mastery. */
  direction: 'outgoing' | 'incoming' | 'undirected'
  reason?: string
}

function semanticKind(edge: MapEdge): RelationKind | undefined {
  if (edge.kind !== 'related') return undefined
  switch (edge.relationKind) {
    case 'shares_concept':
    case 'prerequisite':
    case 'alternative':
    case 'instance_of':
      return edge.relationKind
    default:
      // Older or unknown metadata must not acquire a made-up learning direction.
      return undefined
  }
}

function directionOf(
  edge: MapEdge,
  kind: RelationKind | undefined,
  outgoing: boolean,
): GraphNeighbor['direction'] {
  if (edge.kind === 'walked') {
    return outgoing ? 'outgoing' : 'incoming'
  }
  if (kind === 'prerequisite' || kind === 'instance_of') {
    if (edge.relationDirection !== 'forward' && edge.relationDirection !== 'reverse') return 'undirected'
    const forward = edge.relationDirection === 'forward' ? outgoing : !outgoing
    return forward ? 'outgoing' : 'incoming'
  }
  return 'undirected'
}

function preferred(candidate: GraphNeighbor, current: GraphNeighbor, selectedId: string): boolean {
  const rank = (n: GraphNeighbor) => n.relationKind
    ? n.relationDirection === 'unreviewed' ? 1 : 0
    : n.kind === 'walked' ? 2 : 3
  const difference = rank(candidate) - rank(current)
  if (difference !== 0) return difference < 0

  // One question card per neighbor. The tie-break is stable metadata order, not
  // a confidence score or a claim that one relation is educationally stronger.
  const key = (n: GraphNeighbor) => [
    n.relationKind ?? '',
    // Use stored endpoints rather than viewer-relative direction so reciprocal
    // rows choose the same representative when either endpoint is selected.
    n.direction === 'undirected' ? '' : n.direction === 'incoming' ? n.id : selectedId,
    n.reason ? '0' : '1',
    n.reason ?? '',
  ].join('\u0000')
  return key(candidate) < key(current)
}

/**
 * Index both ends once. Only reviewed directional rows can imply reading order
 * or concept/example orientation. Unreviewed kinds are retained but undirected.
 * Symmetric and legacy edges stay neutral; traversal is not a semantic claim.
 */
export function buildGraphNeighborIndex(data: MapData): Map<string, GraphNeighbor[]> {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]))
  const index = new Map<string, Map<string, GraphNeighbor>>()

  const add = (from: string, to: string, edge: MapEdge, outgoing: boolean) => {
    const node = nodes.get(to)
    if (!nodes.has(from) || !node || from === to) return

    const relationKind = semanticKind(edge)
    const directional = relationKind === 'prerequisite' || relationKind === 'instance_of'
    const relationDirection = edge.relationDirection === 'forward' || edge.relationDirection === 'reverse'
      ? edge.relationDirection : 'unreviewed'
    const neighbor: GraphNeighbor = {
      ...node,
      kind: edge.kind,
      direction: directionOf(edge, relationKind, outgoing),
      ...(relationKind ? { relationKind } : {}),
      ...(directional ? { relationDirection } : {}),
      ...(edge.reason ? { reason: edge.reason } : {}),
    }
    let neighbors = index.get(from)
    if (!neighbors) {
      neighbors = new Map()
      index.set(from, neighbors)
    }
    const current = neighbors.get(to)
    if (!current || preferred(neighbor, current, from)) neighbors.set(to, neighbor)
  }

  for (const edge of data.edges) {
    add(edge.parentId, edge.childId, edge, true)
    add(edge.childId, edge.parentId, edge, false)
  }

  return new Map([...index].map(([id, neighbors]) => [id, [...neighbors.values()]]))
}

export function getGraphNeighbors(data: MapData, nodeId: string): GraphNeighbor[] {
  return buildGraphNeighborIndex(data).get(nodeId) ?? []
}
