import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { NODE_QUIZZES } from '../data/quiz'

/**
 * 문항의 `근거:` 줄만 갈아 끼운다.
 *
 * **왜 근거만 따로 고치는 도구가 필요한가.** 표본 60문항을 검증관 둘에게
 * 따로 재게 했더니 25문항(42%)이 같은 결함이었다 — 근거가 정답이 아니라
 * 그 옆 문장을 가져온 것이다. 정답 문장 다음의 대책·결과 문장을 인용하거나,
 * 견주는 표의 반대쪽 행을 인용한 형태가 대부분이다. 형태는 멀쩡하고 본문에도
 * 있으니 `verify:quiz`가 그냥 통과시킨다.
 *
 * `replace-quiz-item`으로도 되지만 그것은 문항을 통째로 다시 쓴다. 근거만
 * 고치는 자리에 쓰면 보기와 정답까지 손댈 여지가 생긴다. 고칠 것만 고치는
 * 도구가 사고를 덜 낸다.
 *
 * **본문에 없는 말을 못 넣게 막는다.** 새 근거는 그 노드 본문과 열두 자
 * 이상을 이어서 공유해야 한다. 지어낸 문장은 이 검사에서 걸린다. 완전
 * 일치를 요구하지 않는 것은 문장을 잘라 쓰거나 조사를 다듬는 일이 정당하기
 * 때문이다.
 *
 * 실행:
 *   npx tsx scripts/fix-quiz-rationale.ts edits.json
 *   [{ "question": "노드 제목", "stem": "문항 물음", "rationale": "새 근거" }]
 */
type Edit = { question: string; stem: string; rationale: string }

const bodies = new Map(
  [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...ON_DEMAND_NODES].map((n) => [
    n.question.trim(),
    n.body,
  ]),
)

/** 이어진 공통 부분의 최대 길이. 지어낸 문장을 거르는 유일한 잣대다 */
function longestShared(a: string, b: string): number {
  const strip = (s: string) => s.replace(/[\s.,·"'`|]/g, '')
  const x = strip(a)
  const y = strip(b)
  let best = 0
  for (let i = 0; i < x.length; i++) {
    for (let j = i + best + 1; j <= x.length; j++) {
      if (!y.includes(x.slice(i, j))) break
      best = j - i
    }
  }
  return best
}

const MIN_SHARED = 12

const path = resolve(process.cwd(), 'data/quiz.ts')
const edits: Edit[] = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const lit = (s: string) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

let src = readFileSync(path, 'utf8')
let done = 0
const problems: string[] = []

for (const edit of edits) {
  const body = bodies.get(edit.question.trim())
  if (!body) {
    problems.push(`노드를 못 찾음: ${edit.question}`)
    continue
  }
  const quiz = NODE_QUIZZES.find((q) => q.question.trim() === edit.question.trim())
  const item = quiz?.items.find((i) => i.stem === edit.stem)
  if (!item) {
    problems.push(`문항을 못 찾음: ${edit.question} · ${edit.stem}`)
    continue
  }
  const shared = longestShared(edit.rationale, body)
  if (shared < MIN_SHARED) {
    problems.push(
      `본문에 없는 근거 (${shared}자만 겹침): ${edit.question} · ${edit.stem}\n    ${edit.rationale}`,
    )
    continue
  }

  /*
   * 문항을 stem으로 찾는다. 같은 stem이 여러 노드에 있으므로(여섯 편이
   * `둘을 가르는 기준은?`을 쓴다) 노드 제목 뒤에서만 찾는다.
   */
  const nodeAt = src.indexOf(`    question: ${lit(edit.question)},`)
  if (nodeAt < 0) {
    problems.push(`파일에서 노드를 못 찾음: ${edit.question}`)
    continue
  }
  const stemAt = src.indexOf(`        stem: ${lit(edit.stem)},`, nodeAt)
  if (stemAt < 0) {
    problems.push(`파일에서 문항을 못 찾음: ${edit.question} · ${edit.stem}`)
    continue
  }
  const ratAt = src.indexOf('        rationale:', stemAt)
  const ratEnd = src.indexOf("',\n", ratAt)
  if (ratAt < 0 || ratEnd < 0) {
    problems.push(`근거 줄을 못 찾음: ${edit.stem}`)
    continue
  }
  src =
    src.slice(0, ratAt) +
    `        rationale:\n          ${lit(edit.rationale)},` +
    src.slice(ratEnd + 2)
  done++
}

if (problems.length) {
  console.log(`\n막힌 것 ${problems.length}건:`)
  for (const p of problems) console.log(`  ${p}`)
}
if (done) writeFileSync(path, src)
console.log(`\n${done}/${edits.length}건 반영`)
if (problems.length) process.exit(1)
