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
  /** 이 노드를 뿌리로 삼은 다른 트리. 노드를 지우면 그 트리가 통째로 사라진다 */
  rootOfOthers: number
  /** 이 노드를 품고 있는 다른 트리. 노드를 지우면 그 트리에 구멍이 난다 */
  insideOthers: number
}

/**
 * 지우기 전에 이 노드에 매달린 것을 전부 센다.
 *
 * 처음에는 자식 간선만 봤다. 그것으로는 부족했다 — 공유 트리의 root_node_id가
 * qnode를 on delete cascade로 참조해서, 누군가 이 질문을 뿌리로 공유했으면
 * 그 트리가 통째로 사라진다. 실제로 재발행 한 번에 공유 트리 두 개가 없어졌다.
 *
 * tree_occurrence도 같은 이유로 본다. 그쪽은 트리가 살아남는 대신 노드 하나가
 * 빠져서, 공유한 사람이 남긴 그때 그 모양이 아니게 된다.
 */
async function findExisting(tx: Tx, date: string): Promise<Existing | null> {
  const rows = await tx.query<Existing>(
    `select t.id as "treeId", t.seed_id as "seedId", n.id as "rootId",
            n.normalized_question as question,
            (select count(*)::int from qedge e where e.parent_id = n.id) as children,
            (select count(*)::int from tree o
              where o.root_node_id = n.id and o.id <> t.id) as "rootOfOthers",
            (select count(distinct o.tree_id)::int from tree_occurrence o
              where o.qnode_id = n.id and o.tree_id <> t.id) as "insideOthers"
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

  const existing = await db.transaction((tx) => findExisting(tx, date))

  if (existing) {
    const damage: string[] = []
    if (existing.children > 0) {
      damage.push(`아래로 뻗은 질문 ${existing.children}개의 연결이 끊어진다`)
    }
    if (existing.rootOfOthers > 0) {
      damage.push(`이 질문을 뿌리로 삼은 공유 트리 ${existing.rootOfOthers}개가 통째로 사라진다`)
    }
    if (existing.insideOthers > 0) {
      damage.push(`이 질문을 품은 공유 트리 ${existing.insideOthers}개에 구멍이 난다`)
    }

    console.log(`${date} 현재 발행분`)
    console.log(`  ${existing.question}\n`)

    if (damage.length > 0) {
      if (!force) {
        console.error('버리면 이런 일이 벌어진다.')
        for (const d of damage) console.error(`  - ${d}`)
        console.error('\n정말 버리려면 --force 를 붙인다.')
        process.exit(1)
      }
      // --force로 넘어가도 무엇을 부수는지는 적어둔다. 조용히 지우면
      // 나중에 왜 없어졌는지 아무도 모른다
      console.log('--force로 넘어간다. 함께 사라지는 것:')
      for (const d of damage) console.log(`  - ${d}`)
      console.log()
    }
  } else {
    console.log(`${date}에 발행분이 없다. 새로 발행한다.\n`)
  }

  /*
   * 지우는 것은 publishDaily 안에서, 생성이 끝난 뒤에 일어난다.
   *
   * 예전에는 이 스크립트가 먼저 지우고 그 다음에 발행을 불렀다. 생성이 한도에
   * 걸려 실패하자 그날 질문이 통째로 사라졌다. 새 내용을 손에 쥔 뒤에 옛것을
   * 지워야 실패해도 어제 것이 그대로 남는다.
   */
  const out = await publishDaily({ date, replace: true, call: resolveCaller() })

  if (out.kind !== 'published') {
    console.error(`재발행 실패: ${out.kind}`)
    if (out.kind === 'generation_failed') console.error(`  ${out.detail}`)
    console.error('기존 발행분은 그대로 남아 있다.')
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
