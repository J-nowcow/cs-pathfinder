import { loadEnvLocal } from '../src/lib/load-env'

/**
 * 게이트에 **후보가 몇 개나 가는지** 센다.
 *
 * 게이트 정확도는 이미 만점이다(튜닝 124/124 · 홀드아웃 60/60). 그런데
 * `qedge`가 12행이라 대부분의 노드에서 후보가 **0개**다. 후보가 0이면
 * 게이트가 아무리 정확해도 매칭이 일어날 수 없다.
 *
 * 그래서 재는 것은 정확도가 아니라 **기회**다. 후보 0개인 노드가 몇 개인가.
 *
 * **이것은 대리 지표다.** 진짜 보고 싶은 것은 실사용 매칭률인데 아직 홍보
 * 전이라 확장 이벤트가 거의 없다. 후보 분포는 지금 잴 수 있고 인과가
 * 직접적이라 대신 쓴다. 트래픽이 생기면 실제 매칭률로 갈아탄다.
 *
 * **진짜 `collectCandidates`를 부른다.** 여기서 같은 쿼리를 베껴 쓰면
 * 재는 것과 도는 것이 갈라진다. 실제로 그렇게 어긋난 적이 있다 --
 * `measure-flow-shape`가 자기 휴리스틱으로 재다가 값이 우연히 맞아서
 * 더 위험했다.
 *
 * 실행: npm run measure:candidates
 */
loadEnvLocal()

type Row = { id: string; number: number | null; question: string }

/** 오름차순 배열에서 분위수 */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[i]
}

function bar(n: number, max: number, width = 28): string {
  if (max === 0) return ''
  return '█'.repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / max) * width)))
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  /*
   * 앱과 같은 경로로 붙는다. `getDb()`는 DATABASE_URL이 있으면 Postgres를
   * 쓰고 마이그레이션을 다시 돌리지 않는다(client.ts가 `__csqtMigrated`를
   * 곧바로 세운다).
   */
  const { getDb } = await import('../src/lib/db/client')
  const { collectCandidates } = await import('../src/lib/expand/nodes')

  const db = await getDb()
  const rows = await db.query<Row>(
    `select id, number, normalized_question as question
       from qnode
      where status = 'ready'
      order by number asc nulls last, created_at asc`,
  )

  const counts: number[] = []
  const zero: Row[] = []

  for (const r of rows) {
    const c = await collectCandidates(r.id)
    counts.push(c.length)
    if (c.length === 0) zero.push(r)
  }

  const sorted = [...counts].sort((a, b) => a - b)
  const total = counts.length
  const sum = counts.reduce((a, b) => a + b, 0)

  console.log('\n=== 후보 분포 ===\n')
  console.log(`노드            ${total}`)
  console.log(`후보 0개        ${zero.length}  (${((zero.length / total) * 100).toFixed(1)}%)`)
  console.log(`평균            ${(sum / total).toFixed(1)}`)
  console.log(`중앙값          ${quantile(sorted, 0.5)}`)
  console.log(`75분위          ${quantile(sorted, 0.75)}`)
  console.log(`95분위          ${quantile(sorted, 0.95)}`)
  console.log(`최대            ${sorted[sorted.length - 1] ?? 0}`)

  /* 구간별 */
  const buckets: Array<[string, (n: number) => boolean]> = [
    ['0개    ', (n) => n === 0],
    ['1-4개  ', (n) => n >= 1 && n <= 4],
    ['5-14개 ', (n) => n >= 5 && n <= 14],
    ['15-49개', (n) => n >= 15 && n <= 49],
    ['50개   ', (n) => n >= 50],
  ]
  const tallies = buckets.map(([label, f]) => [label, counts.filter(f).length] as const)
  const max = Math.max(...tallies.map(([, n]) => n))

  console.log('\n--- 구간 ---')
  for (const [label, n] of tallies) {
    console.log(`${label}  ${String(n).padStart(4)}  ${bar(n, max)}`)
  }

  /*
   * 후보 0개인 노드를 몇 개 보여준다. 숫자만 보면 어떤 종류의 노드가
   * 고립됐는지 모른다. 고칠 때 무엇을 봐야 하는지 알려면 실물이 필요하다.
   */
  if (zero.length > 0) {
    console.log(`\n--- 후보 0개 노드 (앞 12개 / ${zero.length}) ---`)
    for (const r of zero.slice(0, 12)) {
      console.log(`  #${String(r.number ?? '?').padStart(3)}  ${r.question}`)
    }
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
