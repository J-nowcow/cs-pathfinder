import { EXAMPLE_NODES } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { NODE_QUIZZES } from '../data/quiz'

/**
 * 아직 문제가 안 붙은 노드를 본문째로 꺼낸다.
 *
 * 문제는 그 노드 본문에서만 나와야 한다. 본문 밖 사실을 끌어오면 해설과
 * 어긋나고, 어긋난 것은 `verify:quiz`가 잡아 주지도 않는다 — 형식은
 * 멀쩡하기 때문이다. 그래서 쓰기 전에 본문을 통째로 놓고 본다.
 *
 * 카테고리 이름은 가운뎃점 양옆에 공백이 있다. `자료구조 · 알고리즘`처럼
 * 정확히 적어야 한다. 틀리면 빈 목록이 나오는데 다 끝난 것처럼 보인다.
 *
 *   npx tsx scripts/dump-quiz-todo.ts 0 6 "인프라 · 보안"
 */
const done = new Set(NODE_QUIZZES.map((q) => `${q.identityScope}\n${q.question}`))
const all = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]

const from = Number(process.argv[2] ?? 0)
const count = Number(process.argv[3] ?? 6)
const category = process.argv[4] ?? '언어 · 런타임'

const todo = all
  .filter((n) => n.category === category)
  .filter((n) => !done.has(`${n.identityScope}\n${n.question}`))

for (const node of todo.slice(from, from + count)) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`scope: ${node.identityScope}`)
  console.log(`question: ${node.question}`)
  console.log('--- body ---')
  console.log(node.body)
  console.log('--- suggestions ---')
  node.suggestions.forEach((s, i) => console.log(`  [${i}] ${s}`))
}
console.log(`\n(${category}: ${from}~${from + count - 1} / 남은 ${todo.length})`)
