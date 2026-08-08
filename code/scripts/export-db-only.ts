import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { PENDING_NODES } from '../data/pending-nodes'

/**
 * DB에만 있는 글을 정적 파일로 꺼낸다.
 *
 * 사용자가 물어보다 만들어진 글(`origin='on_demand'`)은 DB에 바로 쓰이고
 * 정적 파일에는 안 들어간다. 26편이 그 상태였다. 그래서 이런 일이 벌어진다.
 *
 * - 고칠 파일이 없다. 교정 13건이 전부 "못 찾음"으로 떨어졌다.
 * - `cs/explanations/`의 마크다운은 DB를 떠 놓은 사본이라 거기서 고쳐도
 *   다음 덤프에 덮인다. **남이 오탈자 하나 고쳐 보낼 곳이 없다.**
 * - 오픈소스를 내걸었는데 글의 일부가 버전 관리 밖에 있다.
 *
 * 꺼낸 뒤에는 부팅 시드가 이 파일도 읽으므로 파일이 진짜 출처가 된다.
 *
 * 실행: node_modules/.bin/tsx scripts/export-db-only.ts
 */
const OUT = 'data/on-demand-nodes.ts'

const db = await getDb()

const rows = await db.query<{
  q: string
  body: string
  category: string
  scope: string
  suggestions: string[] | null
}>(
  /*
   * 꼬리질문은 `qnode`의 열이 아니라 `qnode_suggestion` 표에 순서를 달고
   * 따로 산다. 순서를 잃으면 화면의 단추 차례가 바뀌므로 `position`으로
   * 정렬해 모은다.
   */
  `select n.normalized_question q, n.body, n.primary_category category,
          n.identity_scope scope,
          coalesce(
            (select array_agg(s.text order by s.position)
               from qnode_suggestion s where s.qnode_id = n.id),
            '{}'
          ) suggestions
     from qnode n
    where n.status = 'ready' and n.body is not null and n.body <> ''
    order by n.number`,
)

const inFile = new Set(
  [...EXAMPLE_NODES, ...AUTHORED_NODES, ...GENERATED_NODES, ...PENDING_NODES].map((n) =>
    n.question.trim(),
  ),
)
const onlyDb = rows.filter((r) => !inFile.has(r.q.trim()))

if (onlyDb.length === 0) {
  console.log('DB에만 있는 글이 없다. 꺼낼 것이 없다')
  process.exit(0)
}

/** 본문에 줄바꿈과 따옴표가 들어 있어 JSON.stringify에 맡긴다 */
const j = (v: unknown) => JSON.stringify(v)

const body = onlyDb
  .map(
    (r) =>
      `  {\n` +
      `    identityScope: ${j(r.scope)},\n` +
      `    category: ${j(r.category)},\n` +
      `    question: ${j(r.q)},\n` +
      `    body: ${j(r.body)},\n` +
      `    suggestions: [\n` +
      (r.suggestions ?? []).map((s) => `      ${j(s)},\n`).join('') +
      `    ],\n` +
      `  },\n`,
  )
  .join('')

writeFileSync(
  OUT,
  `/**\n` +
    ` * 사용자가 물어보다 만들어진 글.\n` +
    ` *\n` +
    ` * 이 글들은 한동안 DB에만 있었다. 고칠 파일이 없어 교정이 통째로 떨어졌고,\n` +
    ` * 남이 고쳐 보낼 곳도 없었다. scripts/export-db-only.ts로 꺼내 왔다.\n` +
    ` *\n` +
    ` * **여기 있는 것이 진짜다.** 부팅 시드가 이 파일로 DB를 덮는다.\n` +
    ` * DB에서만 고치면 다음 요청에 되돌아간다.\n` +
    ` *\n` +
    ` * 모델이 쓴 초안이라 사실 오류가 섞여 있다. 검증 진행은\n` +
    ` * docs/audit/2026-08-08-factcheck-strict.md에 적는다.\n` +
    ` */\n` +
    `import type { ExampleNode } from './example-nodes'\n\n` +
    `export const ON_DEMAND_NODES: ExampleNode[] = [\n${body}]\n`,
)

console.log(`DB 전용 ${onlyDb.length}편 → ${OUT}`)
process.exit(0)
