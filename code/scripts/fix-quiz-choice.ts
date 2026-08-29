import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 특정 문항의 보기 하나를 정확히 바꾼다.
 *
 * 보기 문구는 짧아서 다른 문항에도 같은 말이 흔히 있다. 파일 전체에서
 * 치환하면 엉뚱한 문항이 함께 바뀌는데, 형식은 멀쩡해서 검사에 안 걸린다.
 * 그래서 stem으로 문항 블록을 먼저 찾고 그 안에서만 바꾼다.
 *
 * 보기 줄의 나머지(`correct`, `leadsTo`)는 그대로 둔다. 정답 자리가 옮겨
 * 가는 개편에는 `replace-quiz-item.ts`를 쓴다.
 *
 *   npx tsx scripts/fix-quiz-choice.ts edits.json
 *   [{ "stem": "...", "from": "지금 보기", "to": "바꿀 보기" }]
 */
type Edit = { stem: string; from: string; to: string }

const path = resolve(process.cwd(), 'data/quiz.ts')
const edits: Edit[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const lit = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

let src = readFileSync(path, 'utf8')
let done = 0
for (const edit of edits) {
  const at = src.indexOf(`        stem: ${lit(edit.stem)},`)
  if (at < 0) {
    console.error('stem 못 찾음:', edit.stem)
    continue
  }
  const end = src.indexOf('      },', at)
  const block = src.slice(at, end)
  if (!block.includes(lit(edit.from))) {
    console.error('보기 못 찾음:', edit.stem, '|', edit.from)
    continue
  }
  src = src.slice(0, at) + block.replace(lit(edit.from), lit(edit.to)) + src.slice(end)
  done++
}
writeFileSync(path, src, 'utf8')
console.log(`${done}/${edits.length}건 반영`)
