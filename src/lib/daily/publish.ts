import { getDb, type Tx } from '@/lib/db/client'
import { questionHash } from '@/lib/expand/hash'
import { NORMALIZER_VERSION } from '@/lib/llm/gate'
import type { StructuredCaller } from '@/lib/llm/client'
import { kstToday, kstDateKey, dailySlug } from '@/lib/daily/date'
import { claimSeed, unclaimSeed, countUnconsumedSeeds, type ClaimedSeed } from '@/lib/daily/seed'
import { generateDailyRoot, type DailyRootContent } from '@/lib/daily/generate'
import { findDailyTree, type DailyTree } from '@/lib/daily/today'

export type PublishOutcome =
  | { kind: 'published'; tree: DailyTree; seed: { term: string; category: string } }
  | { kind: 'already_published'; tree: DailyTree }
  | { kind: 'seed_exhausted' }
  | { kind: 'generation_failed'; detail: string }

export type PublishInput = {
  /** 발행일 'YYYY-MM-DD' (KST). 기본은 오늘 */
  date?: string
  call?: StructuredCaller
}

/**
 * 자문 잠금 네임스페이스.
 *
 * 다른 기능이 같은 정수를 잠그면 서로를 막는다. 발행 전용 번호를 둔다.
 */
const LOCK_NAMESPACE = 8601

type CommitResult =
  | { kind: 'inserted'; treeId: string; nodeId: string }
  | { kind: 'lost'; treeId: string }

/**
 * 노드·추천·별칭·트리·발자국을 한 트랜잭션에서 확정한다.
 *
 * 쪼개면 트리 삽입이 실패했을 때 루트 노드만 남는다. `origin='batch'`라
 * 홈 목록에 뜨는데 아무 트리에도 속하지 않는 유령이 된다.
 *
 * 들어오기 전에 날짜를 잠근다. 유니크 인덱스는 최후 방어선일 뿐이고
 * 거기까지 가면 이미 시드를 쓰고 LLM도 태운 뒤다.
 */
async function commitPublish(args: {
  date: string
  seed: ClaimedSeed
  content: DailyRootContent
}): Promise<CommitResult> {
  const db = await getDb()

  return db.transaction(async (tx: Tx) => {
    await tx.query('select pg_advisory_xact_lock($1::int, $2::int)', [
      LOCK_NAMESPACE,
      kstDateKey(args.date),
    ])

    const dup = await tx.query<{ id: string }>(
      `select id from tree where kind = 'daily' and publish_date = $1::date`,
      [args.date],
    )
    if (dup.length > 0) return { kind: 'lost', treeId: dup[0].id }

    const inserted = await tx.query<{ id: string }>(
      `insert into qnode
         (identity_scope, normalized_question, body, primary_category, status, origin)
       values ($1, $2, $3, $4, 'ready', 'batch')
       returning id`,
      [
        args.content.identityScope,
        args.content.question,
        args.content.body,
        args.seed.category,
      ],
    )
    const nodeId = inserted[0].id

    for (const [position, text] of args.content.suggestions.entries()) {
      await tx.query(
        `insert into qnode_suggestion (qnode_id, text, position, target_node_id)
         values ($1, $2, $3, null)
         on conflict (qnode_id, position) do nothing`,
        [nodeId, text, position],
      )
    }

    // 같은 질문이 자유 입력으로 들어왔을 때 보조 조회에 걸리게 한다.
    // 이미 같은 해시가 있으면 그쪽이 임자다. 덮어쓰지 않는다.
    await tx.query(
      `insert into qnode_alias (normalizer_version, normalized_hash, qnode_id)
       values ($1, $2, $3)
       on conflict (normalizer_version, normalized_hash) do nothing`,
      [
        NORMALIZER_VERSION,
        questionHash(args.content.identityScope, args.content.question),
        nodeId,
      ],
    )

    const tree = await tx.query<{ id: string }>(
      `insert into tree
         (slug, title, kind, category, root_node_id, seed_id, summary, publish_date)
       values ($1, $2, 'daily', $3, $4, $5, $6, $7::date)
       returning id`,
      [
        dailySlug(args.date),
        args.content.question,
        args.seed.category,
        nodeId,
        args.seed.id,
        args.content.summary,
        args.date,
      ],
    )
    const treeId = tree[0].id

    // 발행 시점의 트리는 루트 하나다. 꼬리질문은 아직 노드가 아니다(스펙 §4).
    await tx.query(
      `insert into tree_occurrence (tree_id, qnode_id, parent_occurrence_id, position)
       values ($1, $2, null, 0)`,
      [treeId, nodeId],
    )

    return { kind: 'inserted', treeId, nodeId }
  })
}

/**
 * 오늘의 질문을 발행한다.
 *
 * 순서가 곧 안전장치다.
 * 1. 이미 발행됐으면 곧장 돌려준다. 시드도 LLM도 건드리지 않는다
 * 2. 시드를 선점한다. 선택과 소비가 한 문장이다
 * 3. 생성한다. 트랜잭션 밖이다. LLM은 수 초 걸리고 그동안 행을 잡고 있으면 안 된다
 * 4. 확정한다. 여기서만 트랜잭션을 연다
 *
 * 실패하면 시드를 되돌린다. HTTP 응답만 유실돼도 워크플로가 재시도하는데
 * 그때마다 시드가 하나씩 사라지면 13개월치가 조용히 녹는다.
 */
export async function publishDaily(input: PublishInput = {}): Promise<PublishOutcome> {
  const date = input.date ?? kstToday()

  const already = await findDailyTree(date)
  if (already) return { kind: 'already_published', tree: already }

  const seed = await claimSeed()
  if (!seed) return { kind: 'seed_exhausted' }

  let content: DailyRootContent
  try {
    content = await generateDailyRoot({
      term: seed.term,
      category: seed.category,
      call: input.call,
    })
  } catch (e) {
    await unclaimSeed(seed.id)
    return { kind: 'generation_failed', detail: e instanceof Error ? e.message : String(e) }
  }

  let result: CommitResult
  try {
    result = await commitPublish({ date, seed, content })
  } catch (e) {
    await unclaimSeed(seed.id)
    return { kind: 'generation_failed', detail: e instanceof Error ? e.message : String(e) }
  }

  if (result.kind === 'lost') {
    // 다른 프로세스가 먼저 꽂았다. 내 시드는 안 쓴 것이므로 되돌린다.
    await unclaimSeed(seed.id)
    const tree = await findDailyTree(date)
    if (tree) return { kind: 'already_published', tree }
    return { kind: 'generation_failed', detail: '발행된 트리를 다시 읽지 못했다' }
  }

  const tree = await findDailyTree(date)
  if (!tree) return { kind: 'generation_failed', detail: '방금 발행한 트리를 다시 읽지 못했다' }

  return { kind: 'published', tree, seed: { term: seed.term, category: seed.category } }
}

/** 운영 확인용. 남은 시드가 며칠치인지 본다 */
export { countUnconsumedSeeds }
