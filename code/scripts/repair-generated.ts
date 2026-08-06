import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { questionFormIssues } from '../src/lib/llm/question-form'

/**
 * 규칙에 걸린 생성물을 조각 파일에서 뺀다.
 *
 * 걸린 것 대부분은 꼬리질문이 35자를 두세 자 넘긴 것이다. 본문은 멀쩡한데
 * 통째로 버려진다. 규칙을 늦추는 대신 그 항목만 지워서 생성기가 다시 만들게
 * 한다 — 생성기는 조각 파일에 없는 주제를 다시 집는다.
 *
 * 규칙을 늦추지 않는 이유는 그 35자가 버튼 한 줄이기 때문이다. 두세 자를
 * 봐주기 시작하면 기준이 없어진다.
 *
 * 실행: npm run repair:generated
 */
type Made = {
  category: string
  topic: string
  question: string
  body: string
  suggestions: string[]
}

function broken(m: Made): boolean {
  if (questionFormIssues(m.question).length > 0 || m.question.length > 40) return true
  if (m.suggestions.length !== 5) return true
  if (m.suggestions.some((s) => s.length > 35 || questionFormIssues(s).length > 0)) return true

  const blocks = parseBlocks(m.body)
  const at = blocks.findIndex((b) => b.type !== 'paragraph')
  if (at < 0 || at >= 3) return true
  return blocks.some(
    (b) => b.type === 'paragraph' && (b.text.length > 150 || b.text.includes(':::')),
  )
}

let removed = 0
for (const f of readdirSync('/tmp/cs-harvest')) {
  if (!/^generated(-\d+)?\.json$/.test(f)) continue
  const path = `/tmp/cs-harvest/${f}`
  let rows: Made[]
  try {
    rows = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    continue
  }
  const kept = rows.filter((r) => !broken(r))
  if (kept.length === rows.length) continue
  removed += rows.length - kept.length
  writeFileSync(path, JSON.stringify(kept, null, 1))
  console.log(`${f}: ${rows.length - kept.length}개 빼냄`)
}

console.log(`\n총 ${removed}개를 다시 만들 수 있게 비웠다. 생성기를 다시 돌리면 집어간다.`)
