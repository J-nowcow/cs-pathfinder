import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { PENDING_NODES } from '../data/pending-nodes'

/**
 * 본문이 **어디에 사는지** 센다.
 *
 * batch 0의 교정 13건이 전부 "정적 파일에서 못 찾음"으로 떨어졌다. 고치는
 * 도구가 고장 난 것이 아니라 **거기 없는 것**이었다. 그 편들의 본문은 DB에만
 * 있다.
 *
 * 이것은 고치는 경로 문제만이 아니다. 오픈소스로 내건 저장소인데 글의 절반이
 * 버전 관리 밖에 있다는 뜻이다. `cs/explanations/`의 마크다운은 DB를 떠 놓은
 * 사본이라 거기서 고쳐도 다음 덤프에 덮인다. 남이 오탈자 하나 고쳐 보내려 해도
 * **고칠 파일이 없다.**
 *
 * 실행: node_modules/.bin/tsx scripts/where-are-bodies.ts
 */
const db = await getDb()

const rows = await db.query<{ q: string; origin: string; category: string }>(
  `select normalized_question q, origin, primary_category category
     from qnode
    where status = 'ready' and body is not null and body <> ''`,
)

const inFile = new Set(
  [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...PENDING_NODES].map((n) =>
    n.question.trim(),
  ),
)

const onlyDb = rows.filter((r) => !inFile.has(r.q.trim()))

console.log(`DB에 실린 글 ${rows.length}편`)
console.log(`  정적 파일에도 있는 것 ${rows.length - onlyDb.length}편`)
console.log(`  DB에만 있는 것 ${onlyDb.length}편`)

const byOrigin: Record<string, number> = {}
const byCategory: Record<string, number> = {}
for (const r of onlyDb) {
  byOrigin[r.origin] = (byOrigin[r.origin] ?? 0) + 1
  byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
}
console.log(`  DB 전용의 origin: ${JSON.stringify(byOrigin)}`)
console.log(`  DB 전용의 분야: ${JSON.stringify(byCategory)}`)

process.exit(0)
