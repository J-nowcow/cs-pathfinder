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
 *
 * **문턱 0.14는 재서 정했다.** 분야에 들어갔을 때의 배율을 다섯 곳에서 쟀더니
 * 0.155~0.195였다(질문이 많은 분야일수록 낮다). 처음에 0.18로 뒀더니 그 사이를
 * 갈라서 네트워크·운영체제·프론트엔드는 들어가도 카드가 하나도 안 떴다.
 * 분야에 들어간 이상 대표는 보여야 한다.
 */
const STEPS: Array<{ minZoom: number; perCategory: number }> = [
  { minZoom: 0.7, perCategory: Infinity },
  { minZoom: 0.35, perCategory: 6 },
  { minZoom: 0.14, perCategory: 3 },
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
/**
 * 순위대로 뽑되 서로 겹치는 자리는 건너뛴다.
 *
 * 순위만으로 뽑으면 겹친다. 선이 많이 닿은 질문끼리 가까이 모여 있는 일이
 * 흔하기 때문이다 — 분야 안에서 대표 3개를 띄웠더니 6쌍이 겹쳤다.
 *
 * 건너뛰는 것이 밀어내는 것보다 낫다. 카드를 옮기면 어느 점의 카드인지 알 수
 * 없어지고, 그러면 카드와 점을 잇는 선을 또 그려야 한다.
 *
 * `minDist`는 좌표 단위다. 화면상 카드 폭을 배율로 되돌린 값을 넣으면, 배율이
 * 오를수록 문턱이 낮아져 카드가 더 많이 들어간다 — 확대할수록 드러난다는
 * 성질이 자연히 따라온다.
 *
 * 순위 순으로 보므로 결과가 흔들리지 않는다. 같은 배율에서는 늘 같은 것이 뜬다.
 */
export function pickVisible<T extends { id: string; x: number; y: number }>(
  placed: T[],
  rank: Map<string, number>,
  quota: number,
  minDist: number,
  /**
   * 카드가 비켜야 할 자리.
   *
   * 분야 이름이 여기 든다. 카드끼리만 안 겹치게 했더니 분야 이름을 가렸다 —
   * 그 이름이 지도의 뼈대라 카드보다 우선한다.
   */
  avoid: Array<{ x: number; y: number }> = [],
  /**
   * 피할 자리의 반경. 기본은 카드 간격의 0.8배다.
   *
   * 카드 간격을 그대로 쓰면 안 된다. 카드는 폭이 있어 서로 그만큼 떨어져야
   * 하지만 분야 이름은 점 하나다. 같은 반경(1.08배)을 쓰면 이름 하나가 무리
   * 전체를 덮어 그 분야의 카드가 하나도 안 떴다. 반대로 0.5배로 줄이니 카드
   * 오른쪽 끝이 이름 왼쪽 끝에 걸쳤다 — 이름이 가로로 길어서다. 0.8배가
   * 둘 사이다.
   */
  avoidDist = minDist * 0.8,
): Set<string> {
  const out = new Set<string>()
  if (quota <= 0) return out

  // 카테고리마다 quota를 따로 센다. 큰 분야가 작은 분야의 자리를 먹으면 안 된다
  const taken = new Map<string, number>()
  const gap2 = minDist * minDist
  const avoid2 = avoidDist * avoidDist
  const chosen: Array<{ x: number; y: number }> = []

  /*
   * 순위는 **순서만** 정한다. 개수는 아래에서 세어 막는다.
   *
   * 처음에는 `rank >= quota`로 잘랐는데 그게 틀렸다. 앞선 카드와 겹쳐 건너뛴
   * 자리를 다음 순위가 받아야 하는데, 그 다음 순위도 문턱에 걸려 아예 후보에서
   * 빠졌다. 자리가 남는데 아무도 못 들어오는 상태가 된다.
   */
  for (const p of [...placed].sort(
    (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.id.localeCompare(b.id),
  )) {
    const cat = (p as unknown as { category?: string }).category ?? ''
    if ((taken.get(cat) ?? 0) >= quota) continue

    // 이미 뽑힌 카드와 겹치면 건너뛴다. 다음 순위가 그 자리를 대신 받는다
    if (chosen.some((c) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < gap2)) continue
    if (avoid.some((c) => (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < avoid2)) continue

    out.add(p.id)
    chosen.push(p)
    taken.set(cat, (taken.get(cat) ?? 0) + 1)
  }
  return out
}

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
