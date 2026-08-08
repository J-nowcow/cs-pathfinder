import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'

/**
 * 사실 검증을 **전수로** 돌리기 위해 말뭉치를 batch로 자른다.
 *
 * 표본 20편으로 잰 결과가 사실 오류 75%였다. 표본이 그렇다는 것은 나머지
 * 238편도 그렇다는 뜻이다. 표본을 더 떠 봐야 같은 숫자가 다시 나올 뿐이다.
 * **세는 단계는 끝났고 이제 고치는 단계다.**
 *
 * 그래서 무작위·층화가 아니라 **빠짐없이 한 번씩** 지나가는 순서가 필요하다.
 * 정렬을 `number`로 둔다 — 번호가 작을수록 주소가 짧고 사람이 먼저 본다.
 * 앞 batch부터 고치면 눈에 띄는 것부터 나아진다.
 *
 * 실행: npx tsx scripts/batch-corpus.ts <batch번호(0부터)> [크기=20]
 * 결과: /tmp/batch-<번호>.md
 */
const INDEX = Number(process.argv[2] ?? 0)
const SIZE = Number(process.argv[3] ?? 20)

const db = await getDb()

/*
 * 손으로 쓴 것을 뺀다. 이미 Codex가 훑고 고쳤으므로 다시 넣으면 같은 문장을
 * 두 번 판정받고 그만큼 모델이 쓴 것을 덜 본다.
 *
 * **`origin` 열로는 못 거른다.** 그 열의 값은 `batch`와 `on_demand`뿐이라
 * 누가 썼는지가 아니라 언제 만들었는지를 담는다. 손으로 쓴 것의 출처는
 * 정적 파일이므로 거기서 id를 가져온다.
 */
/*
 * **id로는 못 맞춘다.** 정적 파일은 id를 안 들고 있다 — 부팅 때 붙는다.
 * 남는 열쇠는 질문 문구뿐이라 그것으로 맞춘다. 문구가 겹치지 않는다는 것은
 * `does not collide with a hand-written example` 시험이 이미 걸어 뒀다.
 */
const handWritten = new Set([...EXAMPLE_NODES, ...AUTHORED_NODES].map((n) => n.question.trim()))

const all = await db.query<{
  id: string
  number: number
  question: string
  body: string
  category: string
}>(
  `select id, number, normalized_question as question, body, primary_category as category
     from qnode
    where status = 'ready' and body is not null and body <> ''
    order by number`,
)
const rows = all.filter((r) => !handWritten.has(r.question.trim()))

const total = Math.ceil(rows.length / SIZE)
const picked = rows.slice(INDEX * SIZE, (INDEX + 1) * SIZE)

if (picked.length === 0) {
  console.error(`batch ${INDEX}는 비었다. 전체 ${rows.length}편 · batch ${total}개`)
  process.exit(1)
}

const doc = picked
  .map(
    (r) =>
      `## #${r.number} [${r.category}] ${r.question}\n\n` +
      `<!-- id: ${r.id} -->\n\n${r.body.trim()}\n`,
  )
  .join('\n---\n\n')

const out = `/tmp/batch-${INDEX}.md`
writeFileSync(
  out,
  `# 사실 검증 batch ${INDEX + 1}/${total} — ${picked.length}편\n\n` +
    `전체 ${rows.length}편 중 ${INDEX * SIZE + 1}~${INDEX * SIZE + picked.length}번째.\n\n${doc}`,
)
console.error(`batch ${INDEX + 1}/${total} · ${picked.length}편 → ${out}`)
process.exit(0)
