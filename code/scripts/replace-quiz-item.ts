import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { QuizItem } from '../data/quiz'

/**
 * 문항 하나를 통째로 갈아 끼운다.
 *
 * 정답 자리가 옮겨 가는 개편에 쓴다. 보기 하나만 고치는 것과 달리
 * `correct`와 `leadsTo`가 함께 움직이므로 문항 전체를 다시 쓴다.
 *
 * 실제로 쓴 자리는 그렇다/아니다 쏠림을 푸는 작업이었다. 오개념 문항은
 * "이 오해가 맞는가?"를 묻기 때문에 답이 늘 아니다가 된다 — 180문항 중
 * 179개가 그랬다. 질문을 뒤집으면 같은 것을 물으면서 답이 그렇다가 된다.
 *
 *   npx tsx scripts/replace-quiz-item.ts flips.json
 *   [{ "find": "지금 stem", "item": { kind, stem, choices, rationale } }]
 */
type Edit = { find: string; item: QuizItem }

const path = resolve(process.cwd(), 'data/quiz.ts')
const edits: Edit[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const lit = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

const render = (item: QuizItem) =>
  [
    '      {',
    `        kind: ${lit(item.kind)},`,
    `        stem: ${lit(item.stem)},`,
    '        choices: [',
    ...item.choices.map((c) => {
      const parts = [`text: ${lit(c.text)}`]
      if (c.correct) parts.push('correct: true')
      if (typeof c.leadsTo === 'number') parts.push(`leadsTo: ${c.leadsTo}`)
      return `          { ${parts.join(', ')} },`
    }),
    '        ],',
    '        rationale:',
    `          ${lit(item.rationale)},`,
    '      },',
  ].join('\n')

let src = readFileSync(path, 'utf8')
let done = 0
for (const edit of edits) {
  const at = src.indexOf(`        stem: ${lit(edit.find)},`)
  if (at < 0) {
    console.error('못 찾음:', edit.find)
    continue
  }
  const start = src.lastIndexOf('      {\n', at)
  const end = src.indexOf('      },', at) + '      },'.length
  if (start < 0 || end < start) {
    console.error('블록 경계 실패:', edit.find)
    continue
  }
  src = src.slice(0, start) + render(edit.item) + src.slice(end)
  done++
}
writeFileSync(path, src, 'utf8')
console.log(`${done}/${edits.length}문항 교체`)
