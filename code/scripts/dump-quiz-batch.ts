import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { NODE_QUIZZES } from '../data/quiz'

/**
 * 근거 감사를 맡길 만큼씩 잘라 낸다.
 *
 * 노드 순서는 `NODE_QUIZZES`의 저장 순서를 그대로 쓴다. 무작위로 뽑으면
 * 어디까지 봤는지 셀 수 없다 — 전수로 훑을 것이라 순서가 곧 진도다.
 *
 * 실행: npx tsx scripts/dump-quiz-batch.ts <시작> <편수>
 */
const nodes = new Map(
  [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES].map((n) => [
    n.question.trim(),
    n,
  ]),
)
const start = Number(process.argv[2] ?? 0)
const count = Number(process.argv[3] ?? 20)
const slice = NODE_QUIZZES.slice(start, start + count)

console.log(`# 근거 감사 묶음 (${start}번부터 ${slice.length}편 · ${slice.length * 3}문항)\n`)
for (const q of slice) {
  const n = nodes.get(q.question.trim())
  if (!n) continue
  console.log(`\n---\n\n## ${q.question}\n`)
  console.log('### 본문\n')
  console.log('```')
  console.log(n.body)
  console.log('```\n')
  console.log('### 문항\n')
  q.items.forEach((it, i) => {
    console.log(`**문제 ${i + 1} (${it.kind})** — ${it.stem}`)
    it.choices.forEach((c) => console.log(`  - ${c.text}${c.correct ? '   ← 정답' : ''}`))
    console.log(`  근거: ${it.rationale}`)
    console.log('')
  })
}
