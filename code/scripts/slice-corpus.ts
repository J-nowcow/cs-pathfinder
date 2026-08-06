import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { mkdirSync, writeFileSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'

/**
 * 코퍼스 전체를 사실 확인용 묶음으로 자른다.
 *
 * 표본 20편에서 8편만 깨끗했다. 그 숫자의 오차 범위가 넓어서 "40%"라는 말을
 * 그대로 쓸 수 없다. 전수로 세면 오차가 없어진다.
 *
 * 한 묶음이 30편쯤이다. 더 크게 자르면 대조하는 쪽이 뒤쪽을 대충 본다 —
 * 20편에서도 뒤 절반의 지적이 눈에 띄게 성겼다.
 *
 * **묶음마다 분류를 섞는다.** 분류순으로 자르면 한 묶음이 통째로
 * 데이터베이스가 되고, 그 묶음을 맡은 쪽이 "이 분야는 원래 이렇게 쓴다"는
 * 기준을 스스로 만들어 버린다.
 *
 * 실행: npx tsx scripts/slice-corpus.ts [묶음당편수]
 */
const PER_SLICE = Number(process.argv[2] ?? 30)
const DIR = '/tmp/corpus-slices'

const db = await getDb()

const rows = await db.query<{
  id: string
  question: string
  body: string
  category: string
}>(
  `select id, normalized_question as question, body, primary_category as category
   from qnode
   where status = 'ready' and body is not null and body <> ''
   order by primary_category, normalized_question`,
)

/* 분류순으로 정렬된 것을 라운드로빈으로 나누면 묶음마다 분류가 섞인다 */
const slices: (typeof rows)[] = []
const count = Math.ceil(rows.length / PER_SLICE)
for (let i = 0; i < count; i += 1) slices.push([])
rows.forEach((r, i) => slices[i % count].push(r))

mkdirSync(DIR, { recursive: true })

slices.forEach((slice, i) => {
  const doc = slice
    .map(
      (r, j) =>
        `## ${j + 1}. [${r.category}] ${r.question}\n\n` +
        `<!-- id: ${r.id} -->\n\n${r.body.trim()}\n`,
    )
    .join('\n---\n\n')
  const n = String(i + 1).padStart(2, '0')
  writeFileSync(`${DIR}/slice-${n}.md`, `# 묶음 ${n} — ${slice.length}편\n\n${doc}`)
})

console.error(`${rows.length}편 → ${slices.length}묶음 (묶음당 ~${PER_SLICE}편) → ${DIR}`)
process.exit(0)
