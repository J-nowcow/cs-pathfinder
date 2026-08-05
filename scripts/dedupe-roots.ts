import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { rootNodeId } from '../src/lib/db/bootstrap'
import { EXAMPLE_NODES } from '../data/example-nodes'

/**
 * 시드 경로가 둘이던 시절에 생긴 중복 루트를 지운다.
 *
 * 예전 seed 스크립트가 랜덤 UUID로, 부팅 시드가 파생 UUID로 같은 질문을 각각 만들어
 * 노드가 두 벌이 됐다. 파생 ID 쪽만 남긴다. 그쪽이 멱등이고 URL이 재시작 후에도 산다.
 *
 * 안전장치를 둔다.
 * - origin='batch'이면서 예시 질문과 문장이 정확히 같은 것만 본다
 * - 파생 ID는 절대 건드리지 않는다
 * - 사용자가 판 노드(on_demand)와 그 간선은 손대지 않는다
 * - 지우려는 노드에 자식 간선이 있으면 남긴다. 누군가 이미 그 밑을 팠다는 뜻이다
 *
 * 실행: npm run db:dedupe
 */
async function main() {
  const db = await getDb()
  const keep = new Set(EXAMPLE_NODES.map((e) => rootNodeId(e)))
  const questions = EXAMPLE_NODES.map((e) => e.question)

  const dupes = await db.query<{ id: string; normalized_question: string; children: number }>(
    `select n.id, n.normalized_question,
            (select count(*)::int from qedge e where e.parent_id = n.id) as children
     from qnode n
     where n.origin = 'batch' and n.normalized_question = any($1)
     order by n.created_at`,
    [questions],
  )

  const removable = dupes.filter((d) => !keep.has(d.id) && d.children === 0)
  const skipped = dupes.filter((d) => !keep.has(d.id) && d.children > 0)

  console.log(`예시 질문과 일치하는 batch 노드: ${dupes.length}개`)
  console.log(`  유지(파생 ID): ${dupes.filter((d) => keep.has(d.id)).length}개`)
  console.log(`  삭제 대상: ${removable.length}개`)
  console.log(`  건너뜀(자식 있음): ${skipped.length}개`)

  for (const d of skipped) {
    console.log(`    남김 ${d.id} — 자식 ${d.children}개`)
  }

  if (removable.length === 0) {
    console.log('\n지울 것이 없다.')
    return
  }

  const ids = removable.map((d) => d.id)
  // qnode_suggestion·qnode_alias는 on delete cascade라 함께 사라진다
  await db.query('delete from qnode where id = any($1)', [ids])
  console.log(`\n${removable.length}개 삭제됨.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
