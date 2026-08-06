import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'

/**
 * 사실 확인용 표본을 뜬다.
 *
 * 정확도를 "좋다/나쁘다"로 말하면 아무것도 아니다. **몇 편 중 몇 편이 틀렸는지**
 * 세야 한다. 손으로 쓴 다섯 편은 Codex 대조에서 0/5가 깨끗했다 — 그 숫자가
 * 생성분에서도 비슷한지 모르는 채로 "정확하다"고 말할 수 없다.
 *
 * 분류마다 고르게 뽑는다. 한 분류에 몰리면 그 분류의 사정을 전체로 읽는다.
 *
 * 무작위를 안 쓴다 — `Math.random()`이면 돌릴 때마다 표본이 달라져 지난번
 * 결과와 견줄 수 없다. 분류 안에서 이름순 n번째를 집는다.
 *
 * 실행: npx tsx scripts/sample-corpus.ts [분류당개수] > /dev/null
 */
const PER_CATEGORY = Number(process.argv[2] ?? 2)
const OUT = '/tmp/corpus-sample.md'

const db = await getDb()

const rows = await db.query<{
  id: string
  question: string
  body: string
  category: string
  origin: string
}>(
  `select id, normalized_question as question, body,
          primary_category as category, origin
   from qnode
   where status = 'ready' and body is not null and body <> ''
   order by primary_category, normalized_question`,
)

const byCategory = new Map<string, typeof rows>()
for (const r of rows) byCategory.set(r.category, [...(byCategory.get(r.category) ?? []), r])

const picked: typeof rows = []
for (const [, list] of byCategory) {
  /* 가운데에서 고르게 집는다. 앞쪽만 집으면 이름이 기호로 시작하는 것만 나온다 */
  for (let i = 0; i < PER_CATEGORY && i < list.length; i += 1) {
    picked.push(list[Math.floor(((i + 0.5) * list.length) / PER_CATEGORY)])
  }
}

const doc = picked
  .map(
    (r, i) =>
      `## ${i + 1}. [${r.category}] ${r.question}\n\n` +
      `<!-- id: ${r.id} · origin: ${r.origin} -->\n\n${r.body.trim()}\n`,
  )
  .join('\n---\n\n')

writeFileSync(OUT, `# 사실 확인 표본 ${picked.length}편\n\n${doc}`)
console.error(`${picked.length}편 → ${OUT}`)
process.exit(0)
