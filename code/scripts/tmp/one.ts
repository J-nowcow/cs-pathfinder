import { GENERATED_NODES } from '../../data/generated-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { parseBlocks } from '../../src/lib/markdown/blocks'
const n = [...GENERATED_NODES, ...ON_DEMAND_NODES].find((x) => x.question.includes('스레드 세이프한 코드를 작성'))!
console.log(n.body)
console.log('\n--- 파싱된 블록 ---')
for (const b of parseBlocks(n.body)) console.log(b.type)
