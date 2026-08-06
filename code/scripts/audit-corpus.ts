import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { contentIssues, blocking } from '../src/lib/llm/content-rules'

/**
 * 이미 나가 있는 해설이 지금 기준으로 어떤가.
 *
 * `measure:rules`는 정적 데이터 파일을, `measure:diagrams`는 **새로 만든** 여섯
 * 편을 본다. 둘 다 이미 사람이 읽고 있는 것을 안 본다. 검사기와 도식 어휘를
 * 계속 넓혀 왔는데, 정작 운영 중인 코퍼스가 그 기준에서 몇 점인지는 한 번도
 * 재지 않았다. 넓힌 규칙이 실제로 무엇을 잡는지는 여기서만 보인다.
 *
 * **읽기만 한다.** 고칠 것을 정하는 것은 사람의 몫이고, 이 스크립트는 어디가
 * 몇 개인지만 말한다.
 *
 * 실행: npx tsx scripts/audit-corpus.ts [--list <규칙이름>]
 */

type Row = { id: string; question: string; body: string; category: string; origin: string }

const db = await getDb()

const rows = await db.query<Row>(
  `select id, normalized_question as question, body,
          primary_category as category, origin
   from qnode
   where status = 'ready' and body is not null and body <> ''
   order by primary_category, normalized_question`,
)

/* 꼬리질문은 따로 있다. 검사기가 개수까지 보므로 같이 실어야 한다 */
const sugg = await db.query<{ qnode_id: string; text: string }>(
  `select qnode_id, text from qnode_suggestion order by position`,
)
const byNode = new Map<string, string[]>()
for (const s of sugg) byNode.set(s.qnode_id, [...(byNode.get(s.qnode_id) ?? []), s.text])

const want = process.argv.includes('--list')
  ? process.argv[process.argv.indexOf('--list') + 1]
  : null

const byRule = new Map<string, Row[]>()
const kinds = new Map<string, number>()
let blocked = 0
let noted = 0
let clean = 0
let diagramless = 0

for (const r of rows) {
  for (const b of parseBlocks(r.body)) {
    if (b.type !== 'paragraph') kinds.set(b.type, (kinds.get(b.type) ?? 0) + 1)
  }
  if (parseBlocks(r.body).every((b) => b.type === 'paragraph')) diagramless++

  const issues = contentIssues({ body: r.body, suggestions: byNode.get(r.id) ?? [] })
  for (const i of issues) byRule.set(i.rule, [...(byRule.get(i.rule) ?? []), r])

  if (blocking(issues).length > 0) blocked++
  else if (issues.length > 0) noted++
  else clean++
}

const pct = (x: number) => ((x / rows.length) * 100).toFixed(1)

console.log(`\n## 운영 중인 해설 ${rows.length}편`)
console.log(`  막을 것(block) : ${blocked}편 (${pct(blocked)}%)`)
console.log(`  적어둘 것(note): ${noted}편 (${pct(noted)}%)`)
console.log(`  깨끗           : ${clean}편 (${pct(clean)}%)`)
console.log(`  통짜 글        : ${diagramless}편 (${pct(diagramless)}%)`)

console.log('\n## 도식 종류별 (편이 아니라 도식 개수)')
const total = [...kinds.values()].reduce((a, b) => a + b, 0)
for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(9)} ${String(n).padStart(4)}개  ${((n / total) * 100).toFixed(1)}%`)
}
if (!kinds.has('timeline')) console.log('  timeline      0개  ← 어휘는 있는데 코퍼스에 하나도 없다')

console.log('\n## 규칙별 (많은 순)')
for (const [r, hits] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${r.padEnd(10)} ${String(hits.length).padStart(4)}편 (${pct(hits.length)}%)`)
}

if (want) {
  const hits = byRule.get(want) ?? []
  console.log(`\n## '${want}' 걸린 ${hits.length}편`)
  for (const h of hits) console.log(`  [${h.category}] ${h.question}  (${h.origin}) ${h.id}`)
}

process.exit(0)
