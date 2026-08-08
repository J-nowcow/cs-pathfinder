import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync } from 'node:fs'
import { getDb } from '../src/lib/db/client'

/**
 * 같은 질문이 두 행으로 갈라진 것을 하나로 되돌린다.
 *
 * 부팅 시드는 id를 질문 해시에서 만든다. 사용자가 물어봐서 생긴 행은 그
 * 경로가 아니라 임의의 uuid를 갖는다. 같은 질문인데 id가 달라
 * `on conflict (id)`가 안 걸리고 **행이 하나 더 생겼다.** 291행이 317행이 됐다.
 *
 * 시드는 고쳤다(질문으로 먼저 찾는다). 그래도 **이미 갈라진 26행은 남는다.**
 * 목록에 같은 질문이 두 번 뜨고, 짧은 주소는 옛 글을 가리킨다.
 *
 * 남길 쪽은 **번호가 작은 행**이다. 먼저 생겼고 주소가 짧고 이미 링크가
 * 걸려 있다. 늦게 생긴 쪽을 지운다.
 *
 * 기본은 **아무것도 안 지운다.** 무엇을 지울지 찍고 백업 파일을 남긴다.
 * 정말 지우려면 `--apply`를 준다.
 *
 * 실행: node_modules/.bin/tsx scripts/dedupe-questions.ts [--apply]
 */
const apply = process.argv.includes('--apply')
const BACKUP = '/tmp/dedupe-backup.json'

const db = await getDb()

const rows = await db.query<{
  id: string
  number: number
  q: string
  body: string
  category: string
  scope: string
  origin: string
}>(
  `select id, number, normalized_question q, body, primary_category category,
          identity_scope scope, origin
     from qnode
    where normalized_question in (
      select normalized_question from qnode group by normalized_question having count(*) > 1
    )
    order by normalized_question, number`,
)

const byQuestion = new Map<string, typeof rows>()
for (const r of rows) byQuestion.set(r.q, [...(byQuestion.get(r.q) ?? []), r])

const doomed: typeof rows = []
for (const [, list] of byQuestion) {
  /* 번호가 없는 행이 있으면 손대지 않는다. 어느 쪽이 먼저인지 못 정한다 */
  if (list.some((r) => r.number == null)) {
    console.log(`건너뜀(번호 없음): ${list[0].q}`)
    continue
  }
  const keep = list[0]
  for (const r of list.slice(1)) {
    console.log(`  #${keep.number} 남기고 #${r.number} 지움 · ${r.q.slice(0, 40)}…`)
    doomed.push(r)
  }
}

console.log(`\n겹친 질문 ${byQuestion.size}개 · 지울 행 ${doomed.length}개`)

if (doomed.length === 0) process.exit(0)

writeFileSync(BACKUP, JSON.stringify(doomed, null, 1))
console.log(`지울 행을 통째로 ${BACKUP}에 남겼다`)

if (!apply) {
  console.log('아무것도 안 지웠다. 정말 지우려면 --apply')
  process.exit(0)
}

/*
 * **id를 하나씩 지정해 지운다.** 조건으로 지우면 조건이 틀렸을 때 범위를
 * 모른다. 위에서 찍은 그 행들만 지운다.
 */
const ids = doomed.map((r) => r.id)
const res = await db.query<{ id: string }>(`delete from qnode where id = any($1) returning id`, [
  ids,
])
console.log(`${res.length}행 지웠다`)

const left = await db.query<{ c: number }>(
  `select count(*)::int c from qnode where status = 'ready' and body <> ''`,
)
console.log(`남은 글 ${left[0].c}편`)
process.exit(0)
