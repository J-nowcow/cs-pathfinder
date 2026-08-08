import { loadEnvLocal } from '../src/lib/load-env'

/**
 * 저장된 해설 전부를 훑어 **지금 무엇이 있는지** 센다.
 *
 * `measure:diagrams`와 다른 것을 잰다. 그쪽은 Gemini로 몇 편을 새로 만들어
 * **프롬프트가 무엇을 내놓는지**를 보고, 이쪽은 이미 저장된 것을 읽어
 * **독자가 실제로 보는 것**을 본다. 둘은 갈라질 수 있고 실제로 갈라진다 --
 * 프롬프트를 고쳐도 저장된 본문은 다시 만들지 않기 때문이다.
 *
 * 표 비율을 지표로 쓰지 않는다. 2층짜리 stack이 표로 옮겨가면 표 비율이
 * 오히려 오른다. 여기서는 종류별 **건수**와 편수를 그대로 낸다.
 *
 * 실행: npm run measure:corpus
 */
loadEnvLocal()

/** `:::종류` 펜스를 연 줄에서 종류만 뽑는다 */
const FENCE = /^:::[ \t]*([a-z]+)/gm

/*
 * 표는 펜스로 안 온다.
 *
 * 파서에 `table` 종류가 있지만 저장된 본문은 대부분 그냥 마크다운 파이프
 * 표다. 펜스만 세면 "표가 0건"이라는 거짓 그림이 나온다 -- 정작 사용자
 * 불만이 "죄다 표"였는데.
 *
 * 구분선(`|---|---|`)이 있는 덩어리 하나를 표 하나로 센다. 헤더 줄만으로는
 * 본문 속 파이프 문자와 구분이 안 된다.
 */
const MD_TABLE = /^\|[^\n]*\|[ \t]*\n\|[ \t]*:?-{2,}/gm

type Row = { id: string; number: number | null; question: string; category: string; body: string }

function countBlocks(body: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const hit of body.matchAll(FENCE)) {
    const kind = hit[1]
    m.set(kind, (m.get(kind) ?? 0) + 1)
  }
  const tables = [...body.matchAll(MD_TABLE)].length
  if (tables > 0) m.set('(마크다운 표)', tables)
  return m
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const r = await pool.query<Row>(
    `select id, number, normalized_question as question,
            primary_category as category, coalesce(body, '') as body
       from qnode
      order by number asc nulls last, created_at asc`,
  )
  const rows = r.rows

  /* 분야별 편수 */
  const byCat = new Map<string, number>()
  /* 도식 종류별 총 건수와, 그것을 하나라도 가진 편수 */
  const blockCount = new Map<string, number>()
  const blockDocs = new Map<string, number>()
  let withAny = 0
  let empty = 0

  for (const row of rows) {
    byCat.set(row.category, (byCat.get(row.category) ?? 0) + 1)
    if (!row.body.trim()) {
      empty++
      continue
    }
    const m = countBlocks(row.body)
    if (m.size > 0) withAny++
    for (const [kind, n] of m) {
      blockCount.set(kind, (blockCount.get(kind) ?? 0) + n)
      blockDocs.set(kind, (blockDocs.get(kind) ?? 0) + 1)
    }
  }

  console.log(`해설 ${rows.length}편  (본문 없음 ${empty}편)`)
  console.log(`무엇이든 붙은 편  ${withAny}/${rows.length - empty}`)
  /*
   * 이것이 사용자가 지적한 그 숫자다 -- 표만 있고 그림은 없는 편.
   * 표는 도식이 아니다. 표로 그린 상태 기계는 상태 기계처럼 안 보인다.
   */
  const onlyTable = rows.filter((r) => {
    if (!r.body.trim()) return false
    const m = countBlocks(r.body)
    return m.size > 0 && [...m.keys()].every((k) => k === '(마크다운 표)' || k === 'table')
  }).length
  const nothing = rows.length - empty - withAny
  console.log(`표만 있는 편      ${onlyTable}`)
  console.log(`통짜 글인 편      ${nothing}`)

  console.log('\n도식 종류별  (건수 / 그것을 가진 편수)')
  const kinds = [...blockCount.entries()].sort((a, b) => b[1] - a[1])
  for (const [kind, n] of kinds) {
    console.log(`  ${pad(kind, 10)} ${String(n).padStart(4)}건  ${String(blockDocs.get(kind) ?? 0).padStart(3)}편`)
  }

  console.log('\n분야별 편수')
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  for (const [cat, n] of cats) {
    console.log(`  ${pad(cat, 22)} ${String(n).padStart(3)}편`)
  }

  /*
   * 분야가 통째로 비어 있는지 본다. 개별 누락과 다르다 -- 한 분야가 0이면
   * 그 주제로 검색해 들어온 사람이 빈손으로 나간다.
   */
  const GAPS = [
    '컨테이너', '쿠버네티스', '도커', '테스트', '빌드', '모니터링',
    'Raft', 'Paxos', '캐시', '메시지 큐', '로드밸런', 'CI/CD',
  ]
  console.log('\n빈 분야 점검  (질문 제목에 그 말이 들어간 편수)')
  for (const g of GAPS) {
    const n = rows.filter((x) => x.question.toLowerCase().includes(g.toLowerCase())).length
    console.log(`  ${pad(g, 12)} ${String(n).padStart(3)}편${n === 0 ? '   <- 0건' : ''}`)
  }

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
