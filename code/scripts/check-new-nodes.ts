import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { contentIssues, questionIssues } from '../src/lib/llm/content-rules'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { flowShape } from '../src/lib/markdown/flow-shape'

/**
 * 방금 손으로 쓴 해설이 규칙을 지켰는지 본다.
 *
 * `find-below-bar`와 다르다. 그쪽은 **이미 나간 글 전체**에서 `block`만
 * 세고, 이쪽은 **끝에 붙인 몇 편**을 `note`까지 포함해 보여준다. 쓰는
 * 동안 쓰는 사람이 돌리는 도구다.
 *
 * `note`까지 보는 이유가 있다. 긴 문장·상투 표현은 막지 않으므로 배치
 * 게이트를 그냥 통과하는데, 손으로 쓸 때는 그 자리에서 고치는 편이 싸다.
 *
 * **flow가 받는 그림도 같이 찍는다.** 규칙을 다 지켜도 `other`로 떨어지면
 * 화면에서는 예전 목록 모양으로 그려진다. 실제로 새로 쓴 여덟 개가 전부
 * `other`였고 `flow-shape-coverage` 시험이 그것을 잡았다 — 규칙 검사만
 * 보고 있으면 시험이 울 때까지 모른다. `A -> B`, `A -> C`처럼 같은 데서
 * 두 번 출발하면 사슬이 아니다.
 *
 * 실행: node_modules/.bin/tsx scripts/check-new-nodes.ts [편수=10]
 */
const all = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]
const count = Number(process.argv[2] ?? 10)
const recent = AUTHORED_NODES.slice(-count)

/* 제목이 겹치면 접기 대상이 된다. 쓰기 전에 알아야 하는 것이라 같이 본다 */
const seen = new Map<string, number>()
for (const n of all) seen.set(n.question.trim(), (seen.get(n.question.trim()) ?? 0) + 1)

let issues = 0
for (const node of recent) {
  const found = [...questionIssues(node.question), ...contentIssues(node)]
  const shapes = parseBlocks(node.body)
    .filter((b) => b.type === 'flow')
    .map((b) => flowShape(b.steps))
  const dull = shapes.filter((s) => s === 'other').length
  const dup = (seen.get(node.question.trim()) ?? 0) > 1

  if (!found.length && !dull && !dup) continue
  issues += found.length + dull + (dup ? 1 : 0)
  console.log(`\n[${node.category}] ${node.question}`)
  if (dup) console.log('  ❌ 같은 제목이 이미 있다. 접기 대상이 된다')
  for (const i of found) console.log(`  ${i.severity === 'block' ? '❌' : '·'} ${i.rule} — ${i.detail}`)
  if (dull) console.log(`  · flow ${dull}개가 예전 목록 모양으로 그려진다`)
}

console.log(`\n최근 ${recent.length}편 · 지적 ${issues}건`)
if (issues > 0) process.exit(1)
