import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'

/**
 * 이미 판 꼬리질문을 결과 노드와 잇는다.
 *
 * 확장이 끝나도 qnode_suggestion.target_node_id를 채우지 않던 시절의 데이터가
 * 남아 있다. 그 상태로는 이미 판 꼬리를 다시 눌러도 매칭 게이트를 또 태우고,
 * 화면은 어디를 팠는지 표시하지 못한다.
 *
 * 단서는 expansion_event에 있다. 꼬리질문에서 출발한 확장은 raw_input에
 * 꼬리질문 원문이 그대로 남는다. 부모와 문장이 둘 다 맞고 결과 노드가 있는
 * 사건을 찾으면 그 꼬리가 어디로 갔는지 복원된다.
 *
 * 같은 꼬리에 사건이 여럿이면 가장 이른 것을 쓴다. 코드도 먼저 닿은 노드를
 * 임자로 삼으므로 규칙이 같다.
 *
 * 실행: npm run db:backfill-links        (보기만)
 *       npm run db:backfill-links -- --yes
 */

type Row = {
  suggestion_id: string
  suggestion_text: string
  parent_question: string
  target_id: string
  target_question: string
}

async function main() {
  const apply = process.argv.includes('--yes')
  const db = await getDb()

  const rows = await db.query<Row>(
    `select distinct on (s.id)
            s.id            as suggestion_id,
            s.text          as suggestion_text,
            p.normalized_question as parent_question,
            e.resulting_qnode_id  as target_id,
            r.normalized_question as target_question
     from qnode_suggestion s
     join qnode p on p.id = s.qnode_id
     join expansion_event e
       on e.parent_qnode_id = s.qnode_id
      and e.raw_input = s.text
      and e.resulting_qnode_id is not null
     join qnode r on r.id = e.resulting_qnode_id
     where s.target_node_id is null
     order by s.id, e.created_at asc`,
  )

  if (rows.length === 0) {
    console.log('이을 것이 없다.')
    return
  }

  console.log(`이을 수 있는 꼬리질문 ${rows.length}개\n`)
  for (const r of rows) {
    console.log(`  부모  ${r.parent_question.slice(0, 46)}`)
    console.log(`  꼬리  ${r.suggestion_text.slice(0, 60)}`)
    console.log(`   →    ${r.target_question.slice(0, 60)}`)
    console.log()
  }

  if (!apply) {
    console.log('실제로 이으려면 --yes 를 붙인다.')
    return
  }

  // is null 조건을 다시 건다. 조회와 갱신 사이에 누군가 팠을 수 있다
  let linked = 0
  for (const r of rows) {
    const done = await db.query<{ id: string }>(
      `update qnode_suggestion set target_node_id = $2
       where id = $1 and target_node_id is null
       returning id`,
      [r.suggestion_id, r.target_id],
    )
    if (done.length > 0) linked += 1
  }

  console.log(`${linked}개 이었다.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
