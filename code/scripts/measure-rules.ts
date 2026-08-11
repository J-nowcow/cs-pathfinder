import { EXAMPLE_NODES } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { contentIssues, rewriteNeeded } from '../src/lib/llm/content-rules'

/**
 * 규칙 검사기를 실제 코퍼스에 돌려 본다.
 *
 * 운영 경로에 검사를 붙이면 어긋난 해설을 한 번 다시 부르게 된다. 그
 * **재시도율이 얼마인지 모른 채 붙이면** 사용자 대기 시간이 얼마나 늘지도
 * 모르는 것이다. 확장 한 번이 14초라 두 번이면 28초다.
 *
 * 손으로 쓴 30개는 기준선이다. 여기가 걸리면 검사기가 틀린 것이다 —
 * 사람이 쓴 좋은 글을 버리게 만드는 검사기는 없느니만 못하다.
 *
 * 실행: npx tsx scripts/measure-rules.ts
 */
function run(name: string, nodes: { question: string; body: string; suggestions: string[] }[]) {
  const byRule = new Map<string, number>()
  let blocked = 0
  let noted = 0

  for (const n of nodes) {
    const issues = contentIssues(n)
    for (const i of issues) byRule.set(i.rule, (byRule.get(i.rule) ?? 0) + 1)
    if (rewriteNeeded(issues).length > 0) blocked++
    else if (issues.length > 0) noted++
  }

  const pct = (x: number) => ((x / nodes.length) * 100).toFixed(1)
  console.log(`\n## ${name} — ${nodes.length}개`)
  console.log(`  다시 부를 것(block) : ${blocked}개 (${pct(blocked)}%)`)
  console.log(`  적어만 둘 것(note)  : ${noted}개 (${pct(noted)}%)`)
  console.log(`  깨끗                : ${nodes.length - blocked - noted}개`)
  if (byRule.size > 0) {
    console.log('  규칙별:')
    for (const [r, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`    ${r}: ${n}`)
  }
  return blocked
}

run('손으로 쓴 것 (기준선)', EXAMPLE_NODES)
run('생성된 것', GENERATED_NODES)
