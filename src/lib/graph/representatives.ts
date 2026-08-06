/**
 * 배율에 따라 어느 질문을 이름으로 보여줄지 고른다.
 *
 * 지금은 두 상태뿐이다. 멀리서는 점, 가까이서는 전부. 그 사이가 없다.
 * 재보니 폰 개요에서 점 지름이 **0.82px**이고 확대해도 질문 이름이 **9px**이다.
 * 둘 다 물리적으로 안 읽히므로, 지도가 "무엇이 있는지"를 알려주는 일을 아예
 * 못 하고 있었다.
 *
 * 대신 배율이 오를수록 이름을 더 드러낸다. 멀리서는 각 분야의 대표 몇 개만,
 * 다가가면 그 주변이 차례로 붙는다.
 *
 * **대표는 선이 많이 닿은 질문이다.** 여러 갈래가 모이는 자리가 그 구간의
 * 입구다 — "커넥션 풀"이 먼저 보이고 확대하면 거기서 뻗은 것들이 드러난다.
 * 먼저 만들어진 순서로 고르면 아무 뜻이 없고, 발행분으로 고르면 카테고리당
 * 0~2개뿐이라 빈 분야가 생긴다.
 */
export type RepInput = { id: string; category: string }

/**
 * 배율별로 카테고리마다 몇 개를 이름으로 보여줄지.
 *
 * **개요에서는 0이다.** 처음에는 분야마다 하나씩 띄웠는데 만들고 재보니 안
 * 들어갔다 — 읽히는 카드가 168px이고 분야가 열이라 1,680px가 필요한데 폰은
 * 390px다. 실제로 7쌍이 겹쳤고 분야 이름까지 가렸다.
 *
 * 그래서 2단으로 나눈다. 개요는 분야 이름·규모·점만 보여주고, 분야를 눌러
 * 들어가면 그때부터 대표가 뜬다. 개요에서 질문 문장을 보여주는 것보다 "어느
 * 분야가 얼마나 있는지"를 깨끗하게 보여주는 편이 낫다는 판단이다.
 */
const STEPS: Array<{ minZoom: number; perCategory: number }> = [
  { minZoom: 0.7, perCategory: Infinity },
  { minZoom: 0.35, perCategory: 6 },
  { minZoom: 0.18, perCategory: 3 },
  { minZoom: 0, perCategory: 0 },
]

/** 이 배율에서 카테고리마다 보여줄 개수 */
export function quotaAt(zoom: number): number {
  for (const s of STEPS) if (zoom >= s.minZoom) return s.perCategory
  return 0
}

/**
 * 카테고리마다 대표를 뽑아 순위를 매긴다.
 *
 * 배율이 바뀔 때마다 다시 계산하지 않도록 **순위만 한 번 매겨 둔다.** 그 뒤에는
 * `quotaAt(zoom)` 이하의 순위만 그리면 된다. 배율이 오를 때 이미 보이던 이름이
 * 사라지지 않는 것도 이 방식이라야 보장된다 — 순위가 고정이니 문턱만 내려간다.
 *
 * 동점은 id 순이다. 순위가 흔들리면 확대할 때마다 다른 이름이 나타난다.
 */
export function rankByCategory(nodes: RepInput[], edges: Array<{ parentId: string; childId: string }>): Map<string, number> {
  const degree = new Map<string, number>()
  for (const n of nodes) degree.set(n.id, 0)
  for (const e of edges) {
    if (degree.has(e.parentId)) degree.set(e.parentId, degree.get(e.parentId)! + 1)
    if (degree.has(e.childId)) degree.set(e.childId, degree.get(e.childId)! + 1)
  }

  const byCategory = new Map<string, RepInput[]>()
  for (const n of nodes) {
    const list = byCategory.get(n.category) ?? []
    list.push(n)
    byCategory.set(n.category, list)
  }

  const rank = new Map<string, number>()
  for (const list of byCategory.values()) {
    list
      .slice()
      .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.id.localeCompare(b.id))
      .forEach((n, i) => rank.set(n.id, i))
  }
  return rank
}
