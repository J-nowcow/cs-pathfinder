import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { patchDataFiles } from './lib/patch-data'

/**
 * 한 편의 문단 차례를 바꾼다.
 *
 * 도식은 답 바로 뒤에 있어야 한다. 그런데 **긴 문단을 나누면 그만큼 도식이
 * 뒤로 밀린다.** 사실을 고치다가 도식 위치 규칙을 깨는 일이 반복됐다.
 *
 * 손으로 문단을 통째로 옮겨 적으면 한 글자만 틀려도 조용히 어긋난다. 그래서
 * **차례만 숫자로 주고 글은 건드리지 않는다.**
 *
 * 실행: node_modules/.bin/tsx scripts/reorder-blocks.ts "<질문>" 0 3 1 2 4
 *       (차례를 안 주면 지금 차례만 보여준다)
 */
const ALL = [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES]

const question = process.argv[2]
if (!question) {
  console.error('쓰기: reorder-blocks.ts "<질문>" [새 차례...]')
  process.exit(2)
}

const node = ALL.find((n) => n.question.trim() === question.trim())
if (!node) {
  console.error(`그런 질문이 없다: ${question}`)
  process.exit(1)
}

const blocks = node.body.split('\n\n')
const order = process.argv.slice(3).map(Number)

if (order.length === 0) {
  blocks.forEach((b, i) => console.log(`[${i}] ${b.slice(0, 70).replace(/\n/g, ' / ')}`))
  process.exit(0)
}

/*
 * **빠뜨리거나 겹치면 글이 사라진다.** 차례를 정렬해 0..n-1과 같은지 본다.
 * 이 검사가 없으면 `0 3 1 2`처럼 하나를 빠뜨려도 그냥 지나간다.
 */
const sorted = [...order].sort((a, b) => a - b)
const expected = blocks.map((_, i) => i)
if (order.length !== blocks.length || sorted.some((v, i) => v !== expected[i])) {
  console.error(`차례가 0..${blocks.length - 1}을 한 번씩 담아야 한다. 받은 것: ${order.join(' ')}`)
  process.exit(1)
}

const next = order.map((i) => blocks[i]).join('\n\n')
if (next === node.body) {
  console.log('차례가 그대로다. 바꿀 것이 없다')
  process.exit(0)
}

const r = patchDataFiles(node.body, next)
if (!r.ok) {
  console.error(`못 바꿨다(${r.reason})`)
  process.exit(1)
}
console.log(`${r.file.replace('data/', '')} · ${order.join(' ')} 로 옮겼다`)
process.exit(0)
