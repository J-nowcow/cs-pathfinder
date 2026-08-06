/**
 * 전역 질문 그래프가 실제로 이어져 있는지 잰다.
 *
 * 지도를 만들기 전에 이 숫자를 봐야 한다. 선이 거의 없으면 화면은 지식망이
 * 아니라 흩어진 카드 무더기가 된다. 그런 그림은 만들고 나서야 알게 되는데,
 * 그때는 이미 지도를 위한 좌표 저장·LOD·바텀시트를 다 만든 뒤다.
 *
 * `qedge`는 순환을 허용하므로 방향을 무시하고 무향 그래프로 본다. "이어져
 * 보이는가"가 질문이지 "어느 쪽이 부모인가"가 아니다.
 */
export type Edge = { parentId: string; childId: string }

export type Connectivity = {
  nodes: number
  edges: number
  /** 간선이 하나도 없는 노드 수 */
  isolated: number
  /** 고립 비율 0~1. 높을수록 지도가 카드 무더기에 가깝다 */
  isolatedRatio: number
  /** 연결 요소 크기, 큰 것부터 */
  components: number[]
  /** 가장 큰 덩어리가 전체에서 차지하는 비율 0~1 */
  largestRatio: number
  /** 차수 중앙값. 1이면 사슬, 2 이상이면 갈래가 생긴다 */
  medianDegree: number
}

export function analyzeConnectivity(nodeIds: string[], edges: Edge[]): Connectivity {
  const degree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  for (const id of nodeIds) {
    degree.set(id, 0)
    adjacency.set(id, [])
  }

  for (const e of edges) {
    // 목록에 없는 노드를 가리키는 간선은 무시한다. status가 ready가 아닌
    // 노드로 이어진 간선이 여기 해당한다 — 화면에 안 나오는 것과 이어졌다고
    // 이어졌다 치면 숫자가 실제보다 좋아 보인다
    if (!degree.has(e.parentId) || !degree.has(e.childId)) continue
    degree.set(e.parentId, degree.get(e.parentId)! + 1)
    degree.set(e.childId, degree.get(e.childId)! + 1)
    adjacency.get(e.parentId)!.push(e.childId)
    adjacency.get(e.childId)!.push(e.parentId)
  }

  const seen = new Set<string>()
  const components: number[] = []
  for (const id of nodeIds) {
    if (seen.has(id)) continue
    let size = 0
    const stack = [id]
    seen.add(id)
    while (stack.length > 0) {
      const cur = stack.pop()!
      size += 1
      for (const next of adjacency.get(cur) ?? []) {
        if (seen.has(next)) continue
        seen.add(next)
        stack.push(next)
      }
    }
    components.push(size)
  }
  components.sort((a, b) => b - a)

  const degrees = [...degree.values()].sort((a, b) => a - b)
  const isolated = degrees.filter((d) => d === 0).length
  const n = nodeIds.length

  return {
    nodes: n,
    edges: edges.filter((e) => degree.has(e.parentId) && degree.has(e.childId)).length,
    isolated,
    isolatedRatio: n === 0 ? 0 : isolated / n,
    components,
    largestRatio: n === 0 ? 0 : (components[0] ?? 0) / n,
    medianDegree: degrees.length === 0 ? 0 : (degrees[Math.floor(degrees.length / 2)] ?? 0),
  }
}

/**
 * 지도를 만들 만한 상태인지에 대한 한 줄 판단.
 *
 * 기준은 손으로 정한 것이고 근거는 이렇다. 고립이 절반을 넘으면 화면 절반이
 * 선 없는 점이라 "그래프"라고 부를 수 없다. 가장 큰 덩어리가 3할에 못 미치면
 * 조망해도 전체 구조가 안 보인다. 둘 다 아니면 만들어볼 값이 있다.
 *
 * 숫자를 보고 사람이 정하는 것이 맞고, 이건 그 판단을 돕는 요약이다.
 */
/**
 * 지도 화면에 띄울 한 줄.
 *
 * `verdict`와 읽는 사람이 다르다. 그쪽은 "이걸 만들 값이 있나"를 정하려고
 * 내가 보는 숫자고, 이쪽은 지도를 연 사람이 읽는다. "흩어진 카드다" 같은 말을
 * 화면에 그대로 내보낼 수는 없다.
 *
 * 그렇다고 감출 것도 아니다. 지금 고립이 54%인데 아무 말이 없으면 사용자는
 * 선이 거의 없는 화면을 보고 고장인 줄 안다. 채우는 중이라고 말하는 편이 낫다.
 *
 * 촘촘해지면 아무 말도 안 한다. 잘 되고 있을 때 상태를 알리는 것은 소음이다.
 */
export function mapStatus(c: Connectivity): string | null {
  if (c.nodes === 0) return null
  if (c.isolatedRatio <= 0.25) return null

  const linked = c.nodes - c.isolated
  return `아직 ${linked}개만 이어져 있어요. 관계를 채우는 중이에요.`
}

export function verdict(c: Connectivity): { ready: boolean; reason: string } {
  if (c.nodes === 0) return { ready: false, reason: '노드가 없다' }
  if (c.isolatedRatio > 0.5) {
    return {
      ready: false,
      reason: `고립 노드가 ${Math.round(c.isolatedRatio * 100)}%다. 화면 절반이 선 없는 점이면 지도가 아니라 흩어진 카드다`,
    }
  }
  if (c.largestRatio < 0.3) {
    return {
      ready: false,
      reason: `가장 큰 덩어리가 ${Math.round(c.largestRatio * 100)}%뿐이다. 조망해도 전체 구조가 안 보인다`,
    }
  }
  return {
    ready: true,
    reason: `고립 ${Math.round(c.isolatedRatio * 100)}% · 가장 큰 덩어리 ${Math.round(c.largestRatio * 100)}%. 지도로 그릴 만하다`,
  }
}
