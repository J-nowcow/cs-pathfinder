import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'

/**
 * 개발 스텁이 답한 노드를 지운다.
 *
 * 배포에 `GOOGLE_GENERATIVE_AI_API_KEY`가 없으면 확장이 실패하는 대신 스텁이
 * 그럴듯한 껍데기를 답한다. 화면은 멀쩡히 돌아가는데 내용이 가짜다. 그 상태로
 * 저장된 노드는 캐시에 걸려서, 키를 붙인 뒤에도 같은 질문에 계속 가짜를 돌려준다.
 *
 * 스텁 본문은 자기가 스텁이라고 첫 줄에 밝히므로 그 문장으로 찾는다.
 *
 * 실행: npm run db:purge-stubs        (보기만)
 *       npm run db:purge-stubs -- --yes  (삭제)
 */

/** dev-stub.ts가 본문 첫 줄에 박는 문장. 여기가 바뀌면 같이 바꿔야 한다 */
const STUB_MARKER = '개발용 예시 해설이다'

type Row = {
  id: string
  question: string
  origin: string
  children: number
}

async function main() {
  const apply = process.argv.includes('--yes')
  const db = await getDb()

  const rows = await db.query<Row>(
    `select n.id, n.normalized_question as question, n.origin,
            (select count(*)::int from qedge e where e.parent_id = n.id) as children
     from qnode n
     where n.body like $1
     order by n.created_at`,
    [`%${STUB_MARKER}%`],
  )

  if (rows.length === 0) {
    console.log('스텁 노드가 없다.')
    return
  }

  console.log(`스텁 노드 ${rows.length}개\n`)
  for (const r of rows) {
    console.log(`  [${r.origin}] ${r.question}`)
    console.log(`    ${r.id}  자식 ${r.children}개`)
  }

  // batch는 매일 발행분이다. 발행 경로가 스텁을 탔다는 뜻이라 노드만 지우면
  // 그날 트리가 통째로 사라진다. republish-daily로 날짜째 다시 뽑아야 한다.
  const batch = rows.filter((r) => r.origin === 'batch')
  if (batch.length > 0) {
    console.log(`\n발행분(batch)이 ${batch.length}개 섞여 있다. 여기서는 건드리지 않는다.`)
    console.log('   npm run db:republish -- YYYY-MM-DD 로 그날 것을 다시 뽑아야 한다.')
  }

  const targets = rows.filter((r) => r.origin !== 'batch')
  if (targets.length === 0) {
    console.log('\n지울 대상이 없다.')
    return
  }

  if (!apply) {
    console.log(`\n${targets.length}개가 삭제 대상이다. 실제로 지우려면 --yes 를 붙인다.`)
    return
  }

  // qedge·qnode_suggestion·qnode_alias는 on delete cascade라 함께 사라진다.
  // 자식이 있어도 지운다. 자식 역시 스텁에서 뻗어 나온 가짜다.
  await db.query(
    'delete from qnode where id = any($1)',
    [targets.map((t) => t.id)],
  )
  console.log(`\n${targets.length}개 삭제됨.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
