import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync } from 'node:fs'
import { runGate } from '../src/lib/llm/gate'
import { questionFormIssues, type FormIssue } from '../src/lib/llm/question-form'
import {
  MATCH_CLUSTERS,
  HELDOUT_CLUSTERS,
  type MatchCase,
  type MatchCluster,
} from '../data/match-cases'

/**
 * 매칭 게이트 정확도 측정.
 *
 * **실제 runGate를 부른다.** 예전 verify 스크립트는 프롬프트를 복사해 두고 쟀는데,
 * 그러면 프로덕션이 아니라 사본을 재는 것이라 게이트를 고쳐도 숫자가 안 움직인다.
 *
 * 스펙 §12의 기준이 비대칭이라 지표도 둘로 나눈다.
 * - precision: 게이트가 고른 것 중 맞은 비율. 잘못 고르면 되돌릴 수 없어 100%가 목표다
 * - recall: 골랐어야 할 것 중 실제로 고른 비율. 90%가 목표다
 *
 * 같은 입력에도 모델 출력이 흔들린다. --runs로 여러 번 돌려 흔들림의 폭까지 본다.
 * 한 번 돌린 숫자를 단정적으로 쓰면 안 된다.
 *
 * 세트가 둘이다. tuning은 프롬프트를 고치면서 본 세트고, heldout은 한 번도 안 본
 * 세트다. 같은 세트를 보며 세 번 고친 뒤 나온 만점은 일반화가 아니다.
 * **heldout 숫자를 보고 프롬프트를 고치면 그 순간 heldout도 튜닝 세트가 된다.**
 *
 * 실행: npm run measure:match
 *       npm run measure:match -- --runs 3
 *       npm run measure:match -- --set heldout
 *       npm run measure:match -- --set all --runs 2
 *       npm run measure:match -- --cluster jwt
 */

type Outcome =
  | { kind: 'match'; candidateId: string }
  | { kind: 'new'; question: string }
  | { kind: 'reject'; reason: string }
  | { kind: 'error'; detail: string }

type Row = {
  caseId: string
  cluster: string
  input: string
  expected: string
  got: Outcome
  /** 게이트가 매칭을 만들었나. precision 분모다 */
  producedMatch: boolean
  correct: boolean
  /** 새로 만든 문장의 어투 위반. 매칭·거절이면 빈 배열이다 */
  formIssues: FormIssue[]
}

function label(o: Outcome): string {
  switch (o.kind) {
    case 'match':
      return `match:${o.candidateId}`
    case 'new':
      return 'new'
    case 'reject':
      return 'reject'
    case 'error':
      return `error(${o.detail})`
  }
}

function expectedLabel(c: MatchCase): string {
  return c.expect.kind === 'match' ? `match:${c.expect.candidateId}` : c.expect.kind
}

async function runOne(cluster: MatchCluster, c: MatchCase): Promise<Row> {
  let got: Outcome
  try {
    const result = await runGate({
      parentQuestion: cluster.parentQuestion,
      candidates: cluster.candidates.map((x) => ({ id: x.id, question: x.question })),
      rawInput: c.input,
    })

    // null 비교로 좁힌다. 참/거짓으로 보면 matchedId가 빈 문자열일 여지가 남아
    // 두 갈래가 안 갈린다
    if (!result.relevant) got = { kind: 'reject', reason: result.reason }
    else if (result.matchedId !== null) got = { kind: 'match', candidateId: result.matchedId }
    else got = { kind: 'new', question: result.normalizedQuestion }
  } catch (e) {
    // 한 건이 죽어도 나머지는 재야 한다. 46건을 다시 도는 건 비용이다
    got = { kind: 'error', detail: e instanceof Error ? e.message : String(e) }
  }

  return {
    caseId: c.id,
    cluster: cluster.id,
    input: c.input,
    expected: expectedLabel(c),
    got,
    producedMatch: got.kind === 'match',
    correct: label(got) === expectedLabel(c),
    // 새 문장을 만든 경우에만 어투를 본다. 후보를 고른 경우 문장은 이미 우리 것이다
    formIssues: got.kind === 'new' ? questionFormIssues(got.question) : [],
  }
}

type Summary = {
  run: number
  matchesMade: number
  matchesCorrect: number
  shouldMatch: number
  recalled: number
  rejectTotal: number
  rejectHit: number
  /** 거절하면 안 되는 케이스 수 */
  keepTotal: number
  /** 그중 거절당한 것 */
  falseRejects: Row[]
  errors: number
  falseMerges: Row[]
  missed: Row[]
  /** 새로 만든 문장 수와 그중 어투가 어긋난 것 */
  newQuestions: number
  malformed: Row[]
}

function summarize(rows: Row[], run: number): Summary {
  const matchesMade = rows.filter((r) => r.producedMatch)
  const shouldMatch = rows.filter((r) => r.expected.startsWith('match:'))
  const rejects = rows.filter((r) => r.expected === 'reject')

  /**
   * 거절하면 안 되는 케이스.
   *
   * precision은 매칭한 것만 보고 recall은 매칭했어야 할 것만 본다. 멀쩡한 질문을
   * 거절하는 실패는 두 분모 어디에도 없어서, 이 줄을 넣기 전까지 지표에 안 잡혔다.
   * 사용자 입장에서는 제일 나쁜 실패다 — 질문을 던졌는데 문전에서 막힌다.
   */
  const keep = rows.filter((r) => r.expected !== 'reject')

  return {
    run,
    matchesMade: matchesMade.length,
    matchesCorrect: matchesMade.filter((r) => r.correct).length,
    shouldMatch: shouldMatch.length,
    recalled: shouldMatch.filter((r) => r.correct).length,
    rejectTotal: rejects.length,
    rejectHit: rejects.filter((r) => r.correct).length,
    keepTotal: keep.length,
    falseRejects: keep.filter((r) => r.got.kind === 'reject'),
    errors: rows.filter((r) => r.got.kind === 'error').length,
    // 있어서는 안 되는 실패다. 고르지 말았어야 할 것을 골랐거나 엉뚱한 것을 골랐다
    falseMerges: matchesMade.filter((r) => !r.correct),
    missed: shouldMatch.filter((r) => !r.correct),
    newQuestions: rows.filter((r) => r.got.kind === 'new').length,
    malformed: rows.filter((r) => r.formIssues.length > 0),
  }
}

function pct(n: number, d: number): string {
  return d === 0 ? '  -  ' : `${((n / d) * 100).toFixed(1)}%`
}

async function main() {
  const args = process.argv.slice(2)
  const runsArg = args.indexOf('--runs')
  const runs = runsArg >= 0 ? Number(args[runsArg + 1]) : 1
  const clusterArg = args.indexOf('--cluster')
  const only = clusterArg >= 0 ? args[clusterArg + 1] : null

  const setArg = args.indexOf('--set')
  const setName = setArg >= 0 ? args[setArg + 1] : 'tuning'

  const pool =
    setName === 'heldout'
      ? HELDOUT_CLUSTERS
      : setName === 'all'
        ? [...MATCH_CLUSTERS, ...HELDOUT_CLUSTERS]
        : MATCH_CLUSTERS

  const clusters = only ? pool.filter((c) => c.id === only) : pool
  if (clusters.length === 0) {
    console.error(only ? `그런 군집이 없다: ${only}` : `그런 세트가 없다: ${setName}`)
    process.exit(1)
  }

  const total = clusters.reduce((n, c) => n + c.cases.length, 0)
  console.log(
    `세트 ${setName} · 군집 ${clusters.length}개 · 케이스 ${total}건 · ${runs}회 반복 = 호출 ${total * runs}건`,
  )
  if (setName === 'heldout') {
    console.log('(이 숫자를 보고 프롬프트를 고치면 홀드아웃이 아니게 된다)')
  }
  console.log()

  const summaries: Summary[] = []
  const allRows: Row[][] = []

  for (let run = 1; run <= runs; run += 1) {
    const rows: Row[] = []
    for (const cluster of clusters) {
      for (const c of cluster.cases) {
        const row = await runOne(cluster, c)
        rows.push(row)
        const mark = row.correct ? '·' : row.producedMatch ? '✗' : '△'
        process.stdout.write(mark)
      }
    }
    process.stdout.write('\n')

    allRows.push(rows)
    summaries.push(summarize(rows, run))
  }

  console.log('\n(· 정답  △ 놓침  ✗ 잘못 골랐음)\n')

  console.log('회차별')
  console.log('  run  precision       recall          거절 적중  잘못 거절  어투 위반  오류')
  for (const s of summaries) {
    console.log(
      `  ${String(s.run).padStart(3)}  ` +
        `${String(s.matchesCorrect).padStart(2)}/${String(s.matchesMade).padEnd(2)} ${pct(s.matchesCorrect, s.matchesMade)}  ` +
        `${String(s.recalled).padStart(2)}/${String(s.shouldMatch).padEnd(2)} ${pct(s.recalled, s.shouldMatch)}  ` +
        `${s.rejectHit}/${s.rejectTotal}       ` +
        `${String(s.falseRejects.length).padStart(2)}/${String(s.keepTotal).padEnd(2)}      ` +
        `${String(s.malformed.length).padStart(2)}/${String(s.newQuestions).padEnd(2)}      ${s.errors}`,
    )
  }

  /**
   * 새로 만든 문장의 어투.
   *
   * 판정은 맞았는데 문장이 "~인가요?"로 나오는 경우다. 매칭 정확도와는 다른 축이고
   * 화면에 그대로 나가므로 따로 본다. 노드는 여러 경로에서 도달하는데 한 트리 안에서
   * 어투가 갈리면 같은 서비스가 쓴 문장으로 안 읽힌다.
   */
  const malformed = summaries.flatMap((s) => s.malformed)
  if (malformed.length > 0) {
    console.log('\n어투가 어긋난 새 문장')
    for (const r of malformed) {
      const q = r.got.kind === 'new' ? r.got.question : ''
      console.log(`  [${r.cluster}] ${r.formIssues.join(', ')}`)
      console.log(`    "${q}"`)
    }
  } else {
    console.log('\n어투가 어긋난 새 문장 없음')
  }

  // 멀쩡한 질문을 문전에서 막은 것. 사용자가 겪는 실패 중 가장 나쁘다
  const rejected = summaries.flatMap((s) => s.falseRejects)
  if (rejected.length > 0) {
    console.log('\n잘못 거절한 것')
    for (const r of rejected) {
      const reason = r.got.kind === 'reject' ? r.got.reason : ''
      console.log(`  [${r.cluster}] "${r.input}"`)
      console.log(`    → ${reason}`)
    }
  } else {
    console.log('\n잘못 거절한 것 없음')
  }

  // 잘못 고른 것은 전부 보여준다. 이건 개수가 아니라 내용을 봐야 하는 실패다.
  const merges = summaries.flatMap((s) => s.falseMerges)
  if (merges.length > 0) {
    console.log('\n잘못 고른 것 (되돌릴 수 없는 실패)')
    for (const r of merges) {
      console.log(`  [${r.cluster}] "${r.input}"`)
      console.log(`    기대 ${r.expected} / 실제 ${label(r.got)}`)
    }
  } else {
    console.log('\n잘못 고른 것 없음')
  }

  // 놓친 것은 개수만 봐도 된다. 노드가 하나 더 생길 뿐이다.
  const missedIds = new Map<string, number>()
  for (const s of summaries) for (const r of s.missed) missedIds.set(r.caseId, (missedIds.get(r.caseId) ?? 0) + 1)
  if (missedIds.size > 0) {
    console.log(`\n놓친 케이스 (${runs}회 중 몇 번)`)
    for (const [id, n] of [...missedIds].sort((a, b) => b[1] - a[1])) {
      const row = allRows.flat().find((r) => r.caseId === id)
      console.log(`  ${String(n).padStart(2)}/${runs}  ${id}  "${row?.input ?? ''}"`)
    }
  }

  // 같은 케이스가 회차마다 다르게 나오는지. 재현성은 캐시 적중률의 상한이다.
  if (runs > 1) {
    const flip = new Set<string>()
    const byCase = new Map<string, Set<string>>()
    for (const rows of allRows) {
      for (const r of rows) {
        const set = byCase.get(r.caseId) ?? new Set<string>()
        set.add(label(r.got))
        byCase.set(r.caseId, set)
      }
    }
    for (const [id, set] of byCase) if (set.size > 1) flip.add(id)
    console.log(`\n회차 간 판정이 흔들린 케이스: ${flip.size}/${byCase.size}`)
    for (const id of flip) {
      console.log(`  ${id} → ${[...(byCase.get(id) ?? [])].join(' | ')}`)
    }
  }

  const out = { set: setName, runs, clusters: clusters.map((c) => c.id), summaries, rows: allRows }
  writeFileSync('/tmp/match-measure.json', JSON.stringify(out, null, 2))
  console.log('\n전체 결과: /tmp/match-measure.json')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
