import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb, type Tx } from '../src/lib/db/client'
import { publishDaily } from '../src/lib/daily/publish'
import { resolveCaller } from '../src/lib/llm/resolve'
import { kstToday } from '../src/lib/daily/date'

/**
 * 발행된 오늘의 질문을 버리고 다시 뽑는다.
 *
 * 하루 하나라는 제약 때문에 publishDaily는 이미 발행된 날짜에 아무것도 하지 않는다.
 * 그 방어가 옳지만, 생성 품질이 나빴을 때 빠져나갈 구멍이 없다. 발행분은 홈의
 * 주인공 자리에 하루 종일 걸리므로 잘못 뽑힌 걸 그대로 두면 손해가 크다.
 *
 * 시드는 되돌린다. 버린 주제어를 소비 처리로 남기면 하루치가 그냥 사라진다.
 * 되돌리면 다음 claimSeed가 같은 카테고리를 다시 고를 가능성이 높은데, 그게 의도다.
 * 주제어가 나빴던 게 아니라 그 주제어로 뽑은 문장이 나빴던 것이다.
 *
 * 누군가 이미 그 아래를 팠으면 멈춘다. 루트를 지우면 그 사람이 판 경로가
 * 통째로 날아간다. --force로만 넘어간다.
 *
 * 실행: npm run db:republish                    (오늘)
 *       npm run db:republish -- 2026-08-06      (날짜 지정)
 *       npm run db:republish -- 2026-08-06 --force
 */

type Existing = {
  treeId: string
  seedId: string | null
  rootId: string
  question: string
  children: number
}

async function findExisting(tx: Tx, date: string): Promise<Existing | null> {
  const rows = await tx.query<Existing>(
    `select t.id as "treeId", t.seed_id as "seedId", n.id as "rootId",
            n.normalized_question as question,
            (select count(*)::int from qedge e where e.parent_id = n.id) as children
     from tree t join qnode n on n.id = t.root_node_id
     where t.kind = 'daily' and t.publish_date = $1::date`,
    [date],
  )
  return rows[0] ?? null
}

async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const date = args.find((a) => !a.startsWith('--')) ?? kstToday()

  const db = await getDb()

  const removed = await db.transaction(async (tx) => {
    const existing = await findExisting(tx, date)
    if (!existing) return null

    if (existing.children > 0 && !force) {
      throw new Error(
        `${date} 루트 아래로 이미 ${existing.children}개가 뻗어 있다. ` +
          '지우면 그 경로도 함께 사라진다. 정말 버리려면 --force 를 붙인다.',
      )
    }

    // 시드 id를 먼저 읽어둔다. tree.seed_id는 on delete set null이라
    // 트리가 사라지는 순간 어느 주제어였는지 알 길이 없어진다.
    const seedId = existing.seedId

    // 루트를 지우면 tree가 on delete cascade로 함께 사라지고,
    // tree_occurrence·qnode_suggestion·qnode_alias도 따라 정리된다.
    await tx.query('delete from qnode where id = $1', [existing.rootId])

    if (seedId) {
      await tx.query('update topic_seed set consumed_at = null where id = $1', [seedId])
    }

    return existing
  })

  if (removed) {
    console.log(`${date} 발행분을 버렸다.`)
    console.log(`  질문 ${removed.question}`)
    console.log(`  시드 ${removed.seedId ? '되돌림' : '(연결된 시드 없음)'}\n`)
  } else {
    console.log(`${date}에 발행분이 없다. 새로 발행한다.\n`)
  }

  const out = await publishDaily({ date, call: resolveCaller() })

  if (out.kind !== 'published') {
    console.error(`재발행 실패: ${out.kind}`)
    if (out.kind === 'generation_failed') console.error(`  ${out.detail}`)
    process.exit(1)
    return
  }

  console.log('재발행됨')
  console.log(`  시드 [${out.seed.category}] ${out.seed.term}`)
  console.log(`  질문 ${out.tree.root.question}  (${out.tree.root.question.length}자)`)
  console.log(`  요약 ${out.tree.summary}`)
  console.log(`  해설 ${out.tree.root.body.length}자`)
  console.log('  꼬리질문')
  for (const s of out.tree.root.suggestions) console.log(`    - ${s.text}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
