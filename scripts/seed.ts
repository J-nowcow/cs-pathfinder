import { getDb } from '../src/lib/db/client'
import { insertNode, insertSuggestions, bindAlias } from '../src/lib/expand/nodes'
import { questionHash } from '../src/lib/expand/hash'
import { NORMALIZER_VERSION } from '../src/lib/llm/gate'
import { TOPIC_SEEDS, CATEGORIES } from '../data/topic-seeds'
import { EXAMPLE_NODES } from '../data/example-nodes'

/**
 * 주제어 시드와 예시 루트 노드를 넣는다.
 *
 * 실행: npm run seed
 *
 * PGlite는 인메모리라 프로세스가 끝나면 사라진다.
 * 지금은 시드 내용과 카테고리 분포를 확인하는 용도다.
 * 영속 DB가 붙으면 그대로 재사용한다.
 */
async function main() {
  const db = await getDb()

  for (const seed of TOPIC_SEEDS) {
    await db.query(
      `insert into topic_seed (term, category) values ($1, $2)
       on conflict (term, category) do nothing`,
      [seed.term, seed.category],
    )
  }

  for (const ex of EXAMPLE_NODES) {
    const id = await insertNode({
      identityScope: ex.identityScope,
      normalizedQuestion: ex.question,
      body: ex.body,
      primaryCategory: ex.category,
      status: 'ready',
      origin: 'batch',
    })
    await insertSuggestions(id, ex.suggestions)
    await bindAlias(NORMALIZER_VERSION, questionHash(ex.identityScope, ex.question), id)
    console.log(`  root  ${ex.category.padEnd(16)} ${id}  ${ex.question}`)
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

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
