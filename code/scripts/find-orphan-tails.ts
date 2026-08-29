import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'

/**
 * 꼬리질문이 가리키는데 노드가 없는 자리를 찾는다.
 *
 * **다음에 쓸 해설을 여기서 고른다.** 주제를 새로 지어내면 두 번 진다 —
 * 이미 있는 것과 겹치거나, 아무도 안 누르는 자리에 글을 쓰게 된다. 실제로
 * 제목 키워드로 "쿠버네티스 0편·테스트 0편"을 재고 그대로 믿을 뻔했는데,
 * 목록을 열어 보니 `단위 시험과 통합 시험은 무엇으로 가르는가?`가 있었다.
 * 키워드가 "테스트"가 아니라 "시험"이었을 뿐이다.
 *
 * 꼬리질문은 그 함정이 없다. 이미 그 해설을 쓴 사람이 "여기서 다음은
 * 이것"이라고 적어 둔 자리이고, 사용자가 실제로 누르는 동선이다. 노드가
 * 없으면 눌렀을 때 그 자리에서 새로 생성된다.
 *
 * **다만 그대로 쓰면 안 된다.** `measure:coverage`가 표본 90개로 재 보니
 * 54%는 이미 있는 다른 질문이 답하고 있었다. 여기 나온 목록은 후보이지
 * 작업 목록이 아니다 — 부모 본문을 열어 이미 답했는지 보고 걸러야 한다.
 *
 * 여럿이 같이 가리키는 것을 먼저 본다. 서로 다른 해설이 독립적으로 그쪽을
 * 가리켰다면 그만큼 수요가 확인된 자리다.
 *
 * 실행:
 *   node_modules/.bin/tsx scripts/find-orphan-tails.ts            -- 전부
 *   node_modules/.bin/tsx scripts/find-orphan-tails.ts 시험 컨테이너 -- 걸러서
 */
const all = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]

/* 공백과 물음표만 턴다. 조사까지 털면 다른 질문이 같은 것으로 뭉개진다 */
const norm = (s: string) => s.replace(/[?\s·]/g, '')
const titles = new Set(all.map((n) => norm(n.question)))

const orphan = new Map<string, { from: string[]; category: string }>()
for (const node of all) {
  for (const raw of node.suggestions) {
    const tail = raw.trim()
    if (titles.has(norm(tail))) continue
    if (!orphan.has(tail)) orphan.set(tail, { from: [], category: node.category })
    orphan.get(tail)!.from.push(node.question)
  }
}

const rows = [...orphan].sort((a, b) => b[1].from.length - a[1].from.length)
const tails = all.reduce((n, x) => n + x.suggestions.length, 0)
console.log(`꼬리질문 ${tails}개 · 노드 없는 것 ${rows.length}개`)
console.log(`둘 이상이 같이 가리키는 것 ${rows.filter((r) => r[1].from.length > 1).length}개\n`)

const want = process.argv.slice(2)
for (const [tail, v] of rows) {
  if (want.length && !want.some((w) => tail.includes(w) || v.category.includes(w))) continue
  console.log(`${v.from.length}회 [${v.category}] ${tail}`)
  if (v.from.length > 1) for (const parent of v.from) console.log(`       ← ${parent}`)
}
