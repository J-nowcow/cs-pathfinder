import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { insertNode } from '../src/lib/expand/nodes'
import { createSharedTree } from '../src/lib/db/trees'
import { toggleVote } from '../src/lib/db/votes'
import { reserveQuota, getQuota } from '../src/lib/quota'
import { acquireLease, completeLease } from '../src/lib/expand/singleflight'
import { publishDaily } from '../src/lib/daily/publish'
import { kstToday } from '../src/lib/daily/date'
import type { StructuredCaller } from '../src/lib/llm/client'
import type { Snapshot } from '../src/lib/tree/snapshot'

/**
 * 실제 Postgres에서 동시성을 확인한다.
 *
 * 테스트는 PGlite로 돈다. Postgres를 WASM으로 컴파일한 것이라 의미론은 같지만
 * **연결이 하나뿐이라 진짜 경합이 재현되지 않는다.** `for update` 행 잠금,
 * `on conflict` 경합, 자문 잠금은 전부 순차 정합성만 증명된 상태였다.
 * README에도 검증 안 됐다고 적어 뒀던 항목이다.
 *
 * 여기서는 Neon에 실제로 동시 요청을 던진다. 커넥션 풀이 여러 연결을 쥐고
 * 있으므로 같은 행을 여러 연결이 동시에 노린다.
 *
 * **프로덕션 DB에 쓴다.** 그래서 셋을 지킨다.
 * - 흔적은 전부 만든 자리에서 지운다. 실패해도 finally에서 지운다
 * - 발행 검사는 2099년 날짜를 쓴다. 실제 발행일과 겹칠 수 없다
 * - 남은 것이 있으면 --cleanup 으로 따로 지울 수 있다
 *
 * 실행: npm run verify:concurrency
 *       npm run verify:concurrency -- --cleanup
 */

const SCRATCH_TITLE = '__동시성 검사용 트리__'
const SCRATCH_QUESTION = '__동시성 검사용 질문은?__'
const SCRATCH_QUOTA_KEY = '__concurrency-check__'
const SCRATCH_HASH = '__concurrency-check-hash__'
/** 실제 발행일과 겹칠 수 없는 날짜 */
const FAR_FUTURE = '2099-12-31'

type Check = { name: string; ok: boolean; detail: string }
const checks: Check[] = []

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail })
  console.log(`  ${ok ? '통과' : '실패'}  ${name}`)
  console.log(`        ${detail}`)
}

async function cleanup() {
  const db = await getDb()
  // tree는 루트 노드에 on delete cascade로 매달려 있다
  await db.query(`delete from qnode where normalized_question = $1`, [SCRATCH_QUESTION])
  await db.query(`delete from tree where title = $1`, [SCRATCH_TITLE])
  await db.query(`delete from usage_quota where key = $1`, [SCRATCH_QUOTA_KEY])
  await db.query(`delete from generation_job where normalized_hash = $1`, [SCRATCH_HASH])

  // 2099 발행분은 시드를 되돌린 뒤 지운다. 순서가 바뀌면 어느 시드였는지 잃는다
  const rows = await db.query<{ id: string; seed_id: string | null; root_node_id: string }>(
    `select id, seed_id, root_node_id from tree where kind = 'daily' and publish_date = $1::date`,
    [FAR_FUTURE],
  )
  for (const r of rows) {
    if (r.seed_id) {
      await db.query('update topic_seed set consumed_at = null where id = $1', [r.seed_id])
    }
    await db.query('delete from qnode where id = $1', [r.root_node_id])
  }
}

/**
 * 할당량 예약.
 *
 * 한도가 5인데 20개가 동시에 달려들면 정확히 5개만 통과해야 한다. 더 통과하면
 * 무료 티어를 넘겨 쓰게 되고, 덜 통과하면 쓸 수 있는 몫을 못 쓴다.
 */
async function checkQuota() {
  const LIMIT = 5
  const ATTEMPTS = 20

  const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, () => reserveQuota(SCRATCH_QUOTA_KEY, LIMIT)),
  )
  const granted = results.filter(Boolean).length
  const after = await getQuota(SCRATCH_QUOTA_KEY)

  record(
    '할당량 예약',
    granted === LIMIT && after.reserved === LIMIT,
    `동시 ${ATTEMPTS}건 시도 → ${granted}건 승인 (기대 ${LIMIT}) · 예약 ${after.reserved}`,
  )
}

/**
 * 추천 카운터.
 *
 * 서로 다른 20명이 같은 트리를 동시에 누르면 정확히 20이 되어야 한다.
 * 트리 행을 잠그지 않으면 read-modify-write가 겹쳐 카운터가 덜 오른다.
 * 이게 어긋나면 사용자가 자기 표를 잃는다.
 */
async function checkVotes() {
  const VOTERS = 20
  const db = await getDb()

  const nodeId = await insertNode({
    identityScope: 'generic',
    normalizedQuestion: SCRATCH_QUESTION,
    body: '동시성 검사용',
    primaryCategory: '네트워크',
    status: 'ready',
    origin: 'on_demand',
  })

  const snapshot: Snapshot = {
    rootNodeId: nodeId,
    rows: [{ tempId: 't0', nodeId, parentTempId: null, position: 0 }],
  }
  const created = await createSharedTree({ snapshot, title: SCRATCH_TITLE })
  if (!created.ok) throw new Error(`검사용 트리 생성 실패: ${created.reason}`)

  await Promise.all(
    Array.from({ length: VOTERS }, (_, i) => toggleVote(created.slug, `anon:concurrency-${i}`)),
  )

  const counter = await db.query<{ upvotes: number }>(
    'select upvotes from tree where slug = $1',
    [created.slug],
  )
  const rows = await db.query<{ n: string }>(
    `select count(*) as n from tree_vote v join tree t on t.id = v.tree_id where t.slug = $1`,
    [created.slug],
  )

  const upvotes = Number(counter[0]?.upvotes ?? -1)
  const voteRows = Number(rows[0]?.n ?? -1)

  record(
    '추천 카운터',
    upvotes === VOTERS && voteRows === VOTERS,
    `서로 다른 ${VOTERS}명 동시 추천 → 카운터 ${upvotes} · 표 행 ${voteRows}`,
  )

  // 같은 사람이 동시에 두 번 누르는 경우. 카운터와 표 행이 서로 맞기만 하면 된다
  await Promise.all([
    toggleVote(created.slug, 'anon:double-tap'),
    toggleVote(created.slug, 'anon:double-tap'),
  ])
  const after = await db.query<{ upvotes: number }>(
    'select upvotes from tree where slug = $1',
    [created.slug],
  )
  const afterRows = await db.query<{ n: string }>(
    `select count(*) as n from tree_vote v join tree t on t.id = v.tree_id where t.slug = $1`,
    [created.slug],
  )
  const a = Number(after[0]?.upvotes ?? -1)
  const b = Number(afterRows[0]?.n ?? -1)

  record(
    '같은 사람 연타',
    a === b,
    `한 사람이 동시에 두 번 → 카운터 ${a} · 표 행 ${b} (둘이 같아야 한다)`,
  )
}

/**
 * 생성 리스.
 *
 * 같은 질문에 동시에 몰리면 한 명만 생성하고 나머지는 기다려야 한다.
 * 여럿이 acquired를 받으면 그 수만큼 LLM을 태운다. 비용 모델의 전제다.
 */
async function checkSingleFlight() {
  const RACERS = 12
  const results = await Promise.all(
    Array.from({ length: RACERS }, () => acquireLease(SCRATCH_HASH, 60)),
  )
  const acquired = results.filter((r) => r.result === 'acquired').length
  const busy = results.filter((r) => r.result === 'busy').length

  record(
    '생성 리스(single-flight)',
    acquired === 1,
    `동시 ${RACERS}건 → acquired ${acquired} (기대 1) · busy ${busy}`,
  )

  // 뒤처리. 완료로 닫지 않으면 리스가 남아 다음 검사가 busy를 받는다
  const nodeRows = await (await getDb()).query<{ id: string }>(
    'select id from qnode limit 1',
  )
  if (nodeRows[0]) await completeLease(SCRATCH_HASH, nodeRows[0].id)
}

/**
 * 하루 하나 보장.
 *
 * 같은 날짜로 동시에 발행을 시도하면 하나만 만들어져야 한다. 자문 잠금이
 * 진입을 직렬화하고 유니크 인덱스가 최후에 막는다. 둘 다 안 걸리면 같은 날짜에
 * 트리가 둘 생기고 홈이 어느 쪽을 주인공으로 세울지 모르게 된다.
 *
 * 시드도 하나만 소비돼야 한다. 밀린 것들은 되돌아가야 400개가 안 녹는다.
 */
async function checkDailyPublish() {
  const RACERS = 4
  const db = await getDb()

  // LLM을 태우지 않는다. 잠금이 목적이라 생성은 즉시 답하는 가짜로 대신한다
  const fake: StructuredCaller = async <T,>() =>
    ({
      question: '__동시성 검사 발행 질문은?__',
      identity_scope: 'generic',
      body: '동시성 검사용 본문이다.',
      summary: '동시성 검사용 요약이다.',
      suggestions: [{ text: '꼬리 하나는?' }],
    }) as T

  const before = await db.query<{ n: string }>(
    'select count(*) as n from topic_seed where consumed_at is null',
  )

  const results = await Promise.all(
    Array.from({ length: RACERS }, () => publishDaily({ date: FAR_FUTURE, call: fake })),
  )

  const published = results.filter((r) => r.kind === 'published').length
  const already = results.filter((r) => r.kind === 'already_published').length
  const failed = results.filter((r) => r.kind === 'generation_failed')

  const trees = await db.query<{ n: string }>(
    `select count(*) as n from tree where kind = 'daily' and publish_date = $1::date`,
    [FAR_FUTURE],
  )
  const after = await db.query<{ n: string }>(
    'select count(*) as n from topic_seed where consumed_at is null',
  )
  const consumed = Number(before[0].n) - Number(after[0].n)

  record(
    '하루 하나 보장',
    Number(trees[0].n) === 1 && published === 1,
    `동시 ${RACERS}건 → published ${published} · already ${already} · 실패 ${failed.length} · 트리 ${trees[0].n}개`,
  )
  record(
    '시드 소비',
    consumed === 1,
    `${consumed}개 소비 (기대 1). 밀린 시도는 시드를 되돌려야 한다`,
  )
  if (failed.length > 0) {
    for (const f of failed) {
      if (f.kind === 'generation_failed') console.log(`        실패 사유: ${f.detail}`)
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL이 없다. PGlite는 단일 연결이라 이 검사를 못 한다.')
    process.exit(1)
  }

  if (process.argv.includes('--cleanup')) {
    await cleanup()
    console.log('검사용 흔적을 지웠다.')
    return
  }

  console.log(`실제 Postgres 동시성 검사 (오늘 ${kstToday()} KST)\n`)

  try {
    await cleanup()
    await checkQuota()
    await checkVotes()
    await checkSingleFlight()
    await checkDailyPublish()
  } finally {
    await cleanup()
  }

  const failedChecks = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failedChecks.length}/${checks.length} 통과`)
  if (failedChecks.length > 0) process.exit(1)
}

main()
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e)
    await cleanup().catch(() => undefined)
    process.exit(1)
  })
