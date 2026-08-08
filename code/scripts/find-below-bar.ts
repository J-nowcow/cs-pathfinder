import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { contentIssues } from '../src/lib/llm/content-rules'

/**
 * 기준에 못 미친 채 이미 나간 글을 찾는다.
 *
 * 생성기는 검사하고 한 번 다시 부른다. 두 번째도 어긋나면 **덜 어긋난 쪽을
 * 내보낸다.** 그 판단은 옳다 -- 문단이 170자인 해설은 읽기 불편할 뿐이지만
 * 거기서 예외를 던지면 사용자는 아무것도 못 받는다.
 *
 * 다만 그렇게 나간 글을 **되돌아와 고치는 절차가 없었다.** 어긋난 것이
 * 그대로 쌓인다. 26편을 파일로 꺼내 재 보니 14편이 걸렸다.
 *
 * 이 도구는 무엇이 얼마나 걸리는지만 센다. 고치는 것은 사람이 한다 --
 * 꼬리질문을 짧게 줄이는 일은 뜻을 골라야 해서 기계가 못 한다.
 *
 * 실행: node_modules/.bin/tsx scripts/find-below-bar.ts [--list]
 */
const SETS = [
  ['손으로 쓴 것', EXAMPLE_NODES],
  ['손으로 쓴 것(추가)', AUTHORED_NODES],
  ['모델이 쓴 것(배치)', GENERATED_NODES],
  ['모델이 쓴 것(물어봐서)', ON_DEMAND_NODES],
] as const

const wantList = process.argv.includes('--list')
const tally: Record<string, number> = {}
let totalNodes = 0
let totalBad = 0

for (const [label, nodes] of SETS) {
  let bad = 0
  for (const n of nodes) {
    const block = contentIssues({ body: n.body, suggestions: n.suggestions }).filter(
      (i) => i.severity === 'block',
    )
    if (block.length === 0) continue
    bad += 1
    for (const i of block) tally[i.rule] = (tally[i.rule] ?? 0) + 1
    if (wantList) {
      console.log(`\n[${label}] ${n.question}`)
      for (const i of block) console.log(`   ${i.rule} · ${i.detail}`)
    }
  }
  totalNodes += nodes.length
  totalBad += bad
  console.log(`${label}: ${bad}/${nodes.length} 걸림`)
}

console.log(`\n합계 ${totalBad}/${totalNodes} 걸림`)
console.log('규칙별 건수')
for (const [rule, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rule} ${n}`)
}
