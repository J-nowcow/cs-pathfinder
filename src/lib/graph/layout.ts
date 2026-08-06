import { CATEGORIES } from '@/lib/tree/categories'

/**
 * 전역 질문 지도의 좌표를 만든다.
 *
 * 두 가지가 이 배치의 목적이다.
 *
 * 하나, **같은 질문은 항상 같은 자리에 있어야 한다.** 어제 왼쪽 위에서 본 것이
 * 오늘 오른쪽 아래에 있으면 지도를 외울 수 없고, 외울 수 없으면 목록보다 나을
 * 것이 없다. 그래서 힘 기반 배치(force-directed)를 쓰지 않는다 — 그건 노드가
 * 하나 늘 때마다 전체가 흔들린다.
 *
 * 둘, **선이 적어도 그림이 성립해야 한다.** qedge는 사람이 실제로 판 경로에서만
 * 생기므로 초기에는 거의 비어 있다. 연결만으로 배치하면 화면이 흩어진 점이 된다.
 * 카테고리를 자리의 근거로 삼으면 선이 없어도 "무엇이 어디에 있는지"는 보인다.
 *
 * 좌표는 순서(index)에서 결정론적으로 나온다. 뒤에 붙는 질문은 뒤 자리를 받고
 * 앞 자리는 그대로다.
 */
export type LayoutInput = {
  id: string
  category: string
}

export type Placed<T extends LayoutInput = LayoutInput> = T & { x: number; y: number }

/** 카테고리 원의 반지름. 열 개를 이 위에 고르게 세운다 */
const RING = 1400

/** 카테고리 안에서 질문이 도는 나선의 첫 반지름 */
const INNER = 190

/** 나선 한 바퀴에 놓는 질문 수. 늘리면 촘촘해지고 줄이면 넓게 퍼진다 */
const PER_TURN = 7

/** 한 바퀴 돌 때마다 반지름이 이만큼 는다 */
const TURN_GAP = 165

/**
 * 카테고리 중심.
 *
 * CATEGORIES 순서를 각도로 쓴다. 목록 순서가 곧 시계 방향 순서라 "데이터베이스는
 * 오른쪽"처럼 외울 수 있다. 목록에 없는 카테고리는 원 밖 아래에 모은다 —
 * 화면에서 지우면 있는 것이 안 보이고, 원 안에 섞으면 순서가 틀어진다.
 */
export function categoryCenter(category: string): { x: number; y: number } {
  const i = CATEGORIES.indexOf(category as (typeof CATEGORIES)[number])
  if (i < 0) return { x: 0, y: RING * 1.7 }

  const angle = (i / CATEGORIES.length) * Math.PI * 2 - Math.PI / 2
  return {
    x: Math.round(Math.cos(angle) * RING),
    // 세로를 눌러 타원으로 만든다. 폰은 세로로 긴데 배치가 정원이면
    // 위아래로만 길어져서 한 화면에 덜 들어온다
    y: Math.round(Math.sin(angle) * RING * 0.72),
  }
}

/**
 * 카테고리 안에서의 자리.
 *
 * 나선으로 돈다. 격자로 깔면 어느 방향이 "다음"인지 안 보이고, 무작위로 뿌리면
 * 겹친다. 나선은 순서가 눈에 남고 개수가 늘어도 바깥으로만 자란다.
 */
function offsetInCategory(index: number): { x: number; y: number } {
  const turn = Math.floor(index / PER_TURN)
  const step = index % PER_TURN
  const radius = INNER + turn * TURN_GAP

  // 바퀴마다 반 칸씩 돌려 안팎이 일직선으로 겹치는 것을 피한다
  const angle = ((step + (turn % 2) * 0.5) / PER_TURN) * Math.PI * 2
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius * 0.82),
  }
}

/**
 * 좌표를 붙인다.
 *
 * 들어온 순서를 그대로 쓴다. 호출부가 `created_at` 순으로 넘기면 먼저 만들어진
 * 질문이 안쪽에 남고 새 질문이 바깥에 붙는다.
 */
export function layoutGlobal<T extends LayoutInput>(items: T[]): Array<Placed<T>> {
  const seen = new Map<string, number>()

  return items.map((item) => {
    const n = seen.get(item.category) ?? 0
    seen.set(item.category, n + 1)

    const center = categoryCenter(item.category)
    const offset = offsetInCategory(n)
    return { ...item, x: center.x + offset.x, y: center.y + offset.y }
  })
}

/**
 * 카테고리별 개수.
 *
 * 멀리서 볼 때는 질문 하나하나가 아니라 "어느 쪽에 얼마나 있는지"만 보여준다.
 * 저배율에서 제목을 그려봐야 읽히지도 않고 그리는 값만 든다.
 */
export function categorySummary(
  items: LayoutInput[],
): Array<{ category: string; count: number; x: number; y: number }> {
  const count = new Map<string, number>()
  for (const it of items) count.set(it.category, (count.get(it.category) ?? 0) + 1)

  return [...count]
    .sort((a, b) => CATEGORIES.indexOf(a[0] as never) - CATEGORIES.indexOf(b[0] as never))
    .map(([category, n]) => ({ category, count: n, ...categoryCenter(category) }))
}
