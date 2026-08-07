import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'

/**
 * 사실 오류 교정안을 본문에 적용한다.
 *
 * 전수 대조에서 나온 하드 오류 80편을 병렬 에이전트 다섯이 하나씩 판정하고
 * **최소 수정**으로 고쳐 놓은 것이 `/tmp/fix-out/`에 있다. 여기서는 그 문장
 * 치환만 한다.
 *
 * **원래 문장이 정확히 있어야만 바꾼다.** 비슷한 것을 찾아 고치지 않는다 —
 * 교정안은 GitHub용으로 변환된 파일(`cs/explanations/`)을 보고 쓴 것이라
 * 도식 안의 문장은 원문과 모양이 다를 수 있다. 안 맞으면 건드리지 않고
 * 그대로 보고한다. 어림짐작으로 고치면 무엇이 바뀌었는지 아무도 모른다.
 *
 * **먼저 되돌릴 것을 남긴다.** 바꾸기 전 본문을 통째로 파일에 떠 놓는다.
 * 되돌리려면 그 파일로 다시 쓰면 된다.
 *
 * 실행:
 *   npx tsx scripts/apply-fixes.ts          # 마른 실행. 몇 건이 붙는지만 본다
 *   npx tsx scripts/apply-fixes.ts --write  # 실제로 쓴다
 */
const DIR = process.env.FIX_DIR ?? '/tmp/fix-out'
const BACKUP = 'docs/audit/_bodies-before-fix.json'
const WRITE = process.argv.includes('--write')

type Edit = { id: string; question: string; from: string; to: string }

/**
 * 교정안 파일을 읽는다.
 *
 * `## <id>` 로 편을 가르고 그 안의 `원래:` / `고침:` 쌍을 모은다. 한 편에
 * 여러 쌍이 있을 수 있다. `판정: 반려`인 편은 쌍이 없으므로 저절로 빠진다.
 */
function parseFixes(): Edit[] {
  const out: Edit[] = []

  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(`${DIR}/${file}`, 'utf8')
    let id = ''
    let question = ''
    let pending: string | null = null

    for (const line of text.split('\n')) {
      const head = /^##\s+([0-9a-f-]{36})/.exec(line)
      if (head) {
        id = head[1]
        question = ''
        pending = null
        continue
      }
      const q = /^질문:\s*(.+)$/.exec(line)
      if (q) {
        question = q[1].trim()
        continue
      }
      const from = /^원래:\s*(.+)$/.exec(line)
      if (from) {
        pending = from[1].trim()
        continue
      }
      const to = /^고침:\s*(.+)$/.exec(line)
      if (to && pending && id) {
        out.push({ id, question, from: pending, to: to[1].trim() })
        pending = null
      }
    }
  }

  return out
}

/**
 * 교정안의 문장을 **원문 모양으로 되돌린다.**
 *
 * 교정안은 GitHub용으로 변환된 파일(`cs/explanations/`)을 보고 썼다. 그 파일은
 * 도식을 표와 목록으로 바꿔 놓은 것이라 도식 안 문장은 원문과 모양이 다르다.
 * 그대로 찾으면 안 걸리고, 하필 **가장 중요한 오류들이 도식 안에 있다**
 * (TLS의 "프리마스터 시크릿 전달"이 그렇다).
 *
 * 변환은 되돌릴 수 있다. 셋만 되돌리면 대부분 걸린다.
 */
function candidates(s: string): string[] {
  const out = [s]

  /* 에이전트가 붙인 표시. `[지적 밖]`·`[도식 3단계]` 같은 것 */
  const bare = s.replace(/^\[[^\]]{1,16}\]\s*/, '')
  if (bare !== s) out.push(bare)

  for (const t of [...out]) {
    /* 순서 도식: `**A → B** — 라벨` 을 `A -> B: 라벨` 로 */
    const flow = /^\*\*(.+?)\s*→\s*(.+?)\*\*\s*—\s*(.+)$/.exec(t)
    if (flow) {
      out.push(`${flow[1]} -> ${flow[2]}: ${flow[3]}`)
      out.push(`${flow[1]} → ${flow[2]}: ${flow[3]}`)
      out.push(`${flow[1]} => ${flow[2]}: ${flow[3]}`)
    }

    /* 표 한 줄: `| a | b |` 를 `a | b` 로. 이스케이프한 파이프도 되돌린다 */
    if (/^\|.*\|$/.test(t)) {
      out.push(t.replace(/^\|\s*|\s*\|$/g, '').replace(/\\\|/g, '|').trim())
    }
  }

  return [...new Set(out)]
}

const edits = parseFixes()
const byNode = new Map<string, Edit[]>()
for (const e of edits) byNode.set(e.id, [...(byNode.get(e.id) ?? []), e])

const db = await getDb()
const rows = await db.query<{ id: string; body: string; normalized_question: string }>(
  `select id, body, normalized_question from qnode where id = any($1::uuid[])`,
  [[...byNode.keys()]],
)
const bodyOf = new Map(rows.map((r) => [r.id, r.body]))

const applied: Array<{ id: string; n: number; body: string }> = []
const missed: Edit[] = []
let notFound = 0

for (const [id, list] of byNode) {
  const before = bodyOf.get(id)
  if (before === undefined) {
    notFound += 1
    continue
  }

  let body = before
  let n = 0
  for (const e of list) {
    const hit = candidates(e.from).find((c) => body.includes(c))
    if (!hit) {
      missed.push(e)
      continue
    }
    /* 되돌린 모양으로 찾았으면 고침 문장도 같은 모양으로 되돌려 넣는다 */
    const to = hit === e.from ? e.to : (candidates(e.to).find((c) => c !== e.to) ?? e.to)
    body = body.replace(hit, to)
    n += 1
  }
  if (n > 0) applied.push({ id, n, body })
}

console.log(`교정안 ${edits.length}건 · ${byNode.size}편`)
console.log(`  붙는 것   ${applied.reduce((a, x) => a + x.n, 0)}건 / ${applied.length}편`)
console.log(`  안 붙는 것 ${missed.length}건  ← 원래 문장을 본문에서 못 찾았다`)
if (notFound > 0) console.log(`  DB에 없는 편 ${notFound}편`)

for (const m of missed.slice(0, 12)) {
  console.log(`\n  [${m.id.slice(0, 8)}] ${m.question.slice(0, 30)}`)
  console.log(`    찾던 것: ${m.from.slice(0, 72)}…`)
}
if (missed.length > 12) console.log(`\n  … 그리고 ${missed.length - 12}건 더`)

if (!WRITE) {
  console.log('\n마른 실행이다. 실제로 쓰려면 --write')
  process.exit(0)
}

/* 되돌릴 것을 먼저 남긴다 */
mkdirSync('docs/audit', { recursive: true })
writeFileSync(
  BACKUP,
  JSON.stringify(
    rows.filter((r) => applied.some((a) => a.id === r.id)).map((r) => ({ id: r.id, body: r.body })),
    null,
    2,
  ),
)
console.log(`\n되돌릴 것 ${BACKUP}에 남겼다`)

for (const a of applied) {
  await db.query(`update qnode set body = $2 where id = $1`, [a.id, a.body])
}
console.log(`${applied.length}편 갱신했다`)
process.exit(0)
