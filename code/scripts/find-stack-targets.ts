import { loadEnvLocal } from '../src/lib/load-env'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * `:::stack` 64개가 각각 어디로 가야 하는지 훑는다.
 *
 * stack은 최대 도피처다 -- 무엇이든 받기 때문에 형태를 못 고른 것이 전부
 * 여기로 온다(A+B 오형 88%). 그런데 **가는 곳이 하나가 아니다.**
 *
 * - **메모리** -- 연속한 주소 공간. `코드/데이터/힙/스택`. 마주 자라는 것이
 *   뜻이라 `위로`·`아래로` 칸을 더해야 한다. 이름만 바꾸면 그 뜻이 안 산다
 * - **표** -- 2항 비교. `HTTPS | ... / HTTP | ...`처럼 위아래가 층이 아니다.
 *   층으로 그리면 없는 위계를 만든다
 * - **진짜 계층** -- OSI, 아키텍처 레이어. 그대로 둔다
 *
 * 자동으로 고치지 않는다. 신호만 붙여 사람이 한 편씩 판정하게 한다.
 * 논증자의 손분류(표 ~18 · memory ~6 · tree ~5)는 대조용으로만 쓴다.
 *
 * 실행: npm run find:stack
 */
loadEnvLocal()

/** 주소 공간을 이루는 이름들. 이게 여럿 보이면 메모리다 */
const ADDRESS_SPACE = ['코드', '데이터', '힙', '스택', 'heap', 'stack', 'text', 'bss']
/** 자라는 방향을 말하는 이름 */
const GROWS = ['힙', '스택', 'heap', 'stack']

type Row = { number: number | null; question: string; body: string }

function signals(layers: Array<{ name: string; note: string }>): string[] {
  const out: string[] = []
  const names = layers.map((l) => l.name.toLowerCase())

  const addr = names.filter((n) => ADDRESS_SPACE.some((a) => n.includes(a.toLowerCase()))).length
  if (addr >= 3) out.push('메모리?')
  if (names.some((n) => GROWS.some((g) => n.includes(g.toLowerCase()))) && addr >= 2) {
    out.push('자람방향필요')
  }

  /*
   * 두 층짜리는 거의 언제나 비교다. 층이 둘이면 "위아래"가 뜻을 못 만든다 --
   * 무엇이 위인지 말할 것이 없기 때문이다
   */
  if (layers.length === 2) out.push('2항비교?')

  /* 첫 칸이 열 이름처럼 생겼다 */
  if (layers.length > 0 && /^(기준|구분|항목|방식|종류|수준|계층|상태 코드)$/.test(layers[0].name)) {
    out.push('표머리?')
  }

  /* 설명이 비어 있으면 층 이름만 나열한 것 */
  if (layers.every((l) => l.note.length === 0)) out.push('설명없음')

  return out
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
    `select number, normalized_question as question, coalesce(body,'') as body
       from qnode where body like '%:::stack%' order by number asc nulls last`,
  )

  const found: Array<{ n: number | null; q: string; layers: number; why: string[]; names: string }> = []

  for (const row of r.rows) {
    for (const b of parseBlocks(row.body)) {
      if (b.type !== 'stack') continue
      const why = signals(b.layers)
      found.push({
        n: row.number,
        q: row.question,
        layers: b.layers.length,
        why,
        names: b.layers.map((l) => l.name).join(' / '),
      })
    }
  }

  const bucket = (w: string[]) =>
    w.includes('메모리?') ? '메모리' : w.includes('표머리?') ? '표' : w.includes('2항비교?') ? '표(2항)' : '계층'

  const groups = new Map<string, typeof found>()
  for (const f of found) {
    const k = bucket(f.why)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(f)
  }

  console.log(`:::stack 블록 ${found.length}개  (해설 ${r.rows.length}편)\n`)
  for (const [k, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n=== ${k}  ${list.length}개 ===`)
    for (const f of list) {
      console.log(`#${f.n} [층${f.layers}] ${f.q.slice(0, 34)}`)
      console.log(`     ${f.names.slice(0, 96)}`)
      if (f.why.length) console.log(`     (${f.why.join(' · ')})`)
    }
  }

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
