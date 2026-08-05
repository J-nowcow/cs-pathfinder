import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { seedExampleNodes, rootNodeId } from '../src/lib/db/bootstrap'
import { TOPIC_SEEDS, CATEGORIES } from '../data/topic-seeds'
import { EXAMPLE_NODES } from '../data/example-nodes'

/**
 * 주제어 시드와 예시 루트를 넣는다.
 *
 * 루트 삽입은 앱 부팅 경로(seedExampleNodes)를 그대로 쓴다. 예전에는 이 스크립트가
 * 따로 랜덤 UUID로 넣었는데, 그러면 부팅 시드가 파생 UUID로 같은 질문을 또 만들어
 * 노드가 두 벌이 됐다. Neon에서 8개가 16개로 늘어나는 것을 실제로 확인했다.
 *
 * 실행: npm run seed
 */
async function main() {
  const db = await getDb()

  // 한 건씩 넣으면 시드 수만큼 왕복한다. 400개가 넘어가면 원격 DB에서 체감된다.
  // unnest로 배열 두 개를 행으로 펴서 한 문장에 끝낸다.
  const before = await db.query<{ n: string }>('select count(*) as n from topic_seed')
  await db.query(
    `insert into topic_seed (term, category)
     select * from unnest($1::text[], $2::text[])
     on conflict (term, category) do nothing`,
    [TOPIC_SEEDS.map((s) => s.term), TOPIC_SEEDS.map((s) => s.category)],
  )
  const after = await db.query<{ n: string }>('select count(*) as n from topic_seed')
  console.log(
    `주제어 시드: 신규 ${Number(after[0].n) - Number(before[0].n)}개 / 정의 ${TOPIC_SEEDS.length}개`,
  )

  const { inserted } = await seedExampleNodes()
  console.log(`루트 노드: 신규 ${inserted}개 / 전체 ${EXAMPLE_NODES.length}개`)
  for (const ex of EXAMPLE_NODES) {
    console.log(`  ${ex.category.padEnd(16)} ${rootNodeId(ex)}  ${ex.question}`)
  }

  console.log('\n주제어 시드 분포')
  for (const category of CATEGORIES) {
    const rows = await db.query<{ n: string }>(
      'select count(*) as n from topic_seed where category = $1',
      [category],
    )
    console.log(`  ${category.padEnd(18)} ${String(rows[0].n).padStart(3)}개`)
  }

  const total = await db.query<{ n: string }>('select count(*) as n from topic_seed')
  console.log(`  ${'합계'.padEnd(18)} ${String(total[0].n).padStart(3)}개`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
