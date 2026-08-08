import { EXAMPLE_NODES } from '../../data/example-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { parseBlocks } from '../../src/lib/markdown/blocks'

const KNOWN = ['flow', 'state', 'tree', 'memory', 'timeline', 'stack']
const ALL = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]

let unknownName = 0
let swallowed = 0
const names = new Map<string, number>()
const bad: string[] = []

for (const n of ALL) {
  /* 여는 울타리 줄만 센다. 닫는 `:::`는 이름이 없다 */
  const opens = [...n.body.matchAll(/^:::[ \t]*([A-Za-z가-힣_-]*)/gm)].map((m) => m[1])
  const named = opens.filter((o) => o.length > 0)
  for (const o of named) names.set(o, (names.get(o) ?? 0) + 1)

  const unknown = named.filter((o) => !KNOWN.includes(o))
  if (unknown.length) {
    unknownName += 1
    bad.push(`모르는 이름 [${unknown.join(',')}] · ${n.question}`)
  }

  /* 파싱된 울타리 도식 수와 여는 줄 수가 다르면 삼켜진 것이 있다 */
  const drawn = parseBlocks(n.body).filter((b) =>
    ['flow', 'state', 'tree', 'memory', 'timeline', 'stack'].includes(b.type),
  ).length
  if (named.length > drawn) {
    swallowed += 1
    bad.push(`삼켜짐 ${named.length}개 중 ${drawn}개만 그려짐 · ${n.question}`)
  }
}

console.log(`전체 ${ALL.length}편`)
console.log(`모르는 울타리 이름을 쓴 편  ${unknownName}`)
console.log(`울타리가 삼켜진 편          ${swallowed}`)
console.log(`쓰인 이름: ${[...names].map(([k, v]) => `${k}:${v}`).join(' ')}`)
for (const b of bad.slice(0, 12)) console.log('  ' + b)
