import { loadEnvLocal } from '../src/lib/load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { patchDataFiles } from './lib/patch-data'

/**
 * 두 쪽을 견주는 질문인데 도식이 한쪽만 그리는 것들을 고친다.
 *
 * 셋 다 같은 결함이었다.
 *
 * - `#210` 블로킹 대 논블로킹 — 두 경우를 **한 라벨에 슬래시로** 욱여넣었다
 * - `#211` 경쟁 상태 — **스레드가 하나뿐이다.** 하나로는 경쟁이 성립하지 않는다.
 *   게다가 그린 것이 문제가 아니라 해법(락)이었다
 * - `#220` 인터럽트 대 폴링 — **인터럽트만 그렸다.** 폴링이 없다
 *
 * `timeline`이 정확히 이 자리다. 한 줄이 한 주체, 칸이 시간이고 **빈 칸이
 * 기다림**이다. 순서 도식으로 그리면 둘이 시간 순서로 눕혀져 "같은 시간에"가
 * 사라진다. 렌더러는 이미 있는데 저장분에 한 편도 안 쓰고 있었다.
 *
 * 울타리만 바꾸지 않는다. 도식이 말을 바꾸면 그것을 가리키는 문장도 같이
 * 바뀌어야 한다 -- `#211`의 "위 흐름처럼 락을 걸어"는 이제 그림과 안 맞는다.
 *
 * 실행: npm run fix:timeline          (미리보기)
 *       npm run fix:timeline -- --apply
 */
loadEnvLocal()

type Edit = { before: string; after: string }
type Fix = { number: number; why: string; fence: string; edits?: Edit[] }

const FIXES: Fix[] = [
  {
    number: 210,
    why: '두 경우를 한 라벨에 슬래시로 넣었다. 빈 칸으로 기다림을 보인다',
    fence: `:::timeline
블로킹 호출자 | 읽기를 부른다 |  |  | 데이터를 받는다
논블로킹 호출자 | 읽기를 부른다 | \`EAGAIN\`으로 바로 돌아온다 | 다른 일을 한다 | 데이터를 받는다
:::`,
    edits: [
      {
        before: '블로킹 방식은 코드가 직관적이다. 하지만 I/O가 끝날 때까지 쓰레드가 멈춰 자원을 낭비한다.',
        after:
          '위 그림에서 블로킹 호출자의 빈 칸이 멈춰 있는 시간이다. 코드는 직관적이지만 그동안 스레드가 아무것도 못 한다.',
      },
    ],
  },
  {
    number: 211,
    why: '경쟁 상태인데 스레드가 하나다. 게다가 문제가 아니라 해법을 그렸다',
    fence: `:::timeline
스레드 A | 잔액 100을 읽는다 |  | 150을 쓴다 |
스레드 B |  | 잔액 100을 읽는다 |  | 130을 쓴다
:::`,
    edits: [
      {
        before:
          '위 흐름처럼 임계 구역에 진입하기 전 락을 걸어 다른 스레드의 진입을 막는다. 이는 데이터 정합성을 보장하는 가장 확실한 방법이다.',
        after:
          '위 그림에서 A가 쓴 150을 B가 130으로 덮는다. 둘 다 100을 읽은 뒤에 각자 계산했기 때문에 A가 더한 50이 사라진다. 그래서 임계 구역에 들어가기 전에 락을 걸어 다른 스레드의 진입을 막는다.',
      },
    ],
  },
  {
    number: 220,
    why: '인터럽트만 그렸다. 질문은 폴링과의 차이인데 폴링이 없다',
    fence: `:::timeline
폴링 | 준비됐나 묻는다 | 아직이다 | 아직이다 | 준비됐다. 처리한다
인터럽트 | 다른 일을 한다 | 다른 일을 한다 | 다른 일을 한다 | 신호를 받고 처리한다
:::`,
    edits: [
      {
        before: '이 흐름은 현대 운영체제의 멀티태스킹을 가능하게 하는 핵심 기제다.',
        after: '인터럽트는 현대 운영체제의 멀티태스킹을 가능하게 하는 핵심 기제다.',
      },
    ],
  },
]

const GEN = 'data/generated-nodes.ts'
const BACKUP = 'docs/audit/_bodies-before-timeline.json'
const escaped = (s: string) => s.replace(/\n/g, '\\n')

/** 첫 `:::` 덩어리를 통째로 갈아 끼운다. 닫는 줄의 뒤 공백까지 함께 먹는다 */
function swapFence(body: string, fence: string): { before: string; next: string } | { error: string } {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => /^:::/.test(l))
  if (start < 0) return { error: '울타리가 없다' }
  const end = lines.findIndex((l, i) => i > start && /^:::[ \t]*(end)?[ \t]*$/.test(l))
  if (end < 0) return { error: '닫는 울타리가 없다' }
  const before = lines.slice(start, end + 1).join('\n')
  return { before, next: body.replace(before, fence) }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const ok: Array<{ id: string; number: number; question: string; body: string; next: string; fenceBefore: string; edits: Edit[] }> = []

  for (const fix of FIXES) {
    const r = await pool.query<{ id: string; question: string; body: string }>(
      `select id, normalized_question as question, coalesce(body,'') as body from qnode where number = $1`,
      [fix.number],
    )
    if (r.rows.length === 0) {
      console.error(`#${fix.number} 없다.`)
      process.exit(1)
    }
    const row = r.rows[0]

    const swapped = swapFence(row.body, fix.fence)
    if ('error' in swapped) {
      console.error(`#${fix.number} ${swapped.error}`)
      process.exit(1)
    }
    let next = swapped.next

    for (const e of fix.edits ?? []) {
      const hits = next.split(e.before).length - 1
      if (hits !== 1) {
        console.error(`#${fix.number} 문장이 ${hits}번 맞았다. 1이어야 한다. 중단.`)
        process.exit(1)
      }
      next = next.replace(e.before, e.after)
    }

    const kinds = parseBlocks(next).map((b) => b.type)
    if (!kinds.includes('timeline')) {
      console.error(`#${fix.number} 바꿔도 timeline으로 안 읽힌다: ${kinds.join(',')}. 중단.`)
      process.exit(1)
    }

    console.log(`#${fix.number} ${row.question}`)
    console.log(`  ${fix.why}`)
    console.log(`  ${kinds.join(' · ')}`)
    ok.push({ ...row, number: fix.number, next, fenceBefore: swapped.before, edits: fix.edits ?? [] })
  }

  if (!apply) {
    console.log('\n미리보기다. 실제로 쓰려면 --apply')
    await pool.end()
    return
  }

  mkdirSync('docs/audit', { recursive: true })
  let backup: Record<string, { question: string; body: string }> = {}
  try {
    backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  } catch {
    /* 처음이면 없다 */
  }

  for (const o of ok) {
    if (!backup[o.id]) backup[o.id] = { question: o.question, body: o.body }
    await pool.query(`update qnode set body = $1 where id = $2`, [o.next, o.id])

    /*
     * **정적 파일을 반드시 같이 고친다.** `bootstrap`이 거기서 본문을
     * 덮어쓰므로 DB만 고치면 요청 하나에 되돌아간다.
     */
    const fix = FIXES.find((f) => f.number === o.number)!
    const r = patchDataFiles(o.fenceBefore, fix.fence)
    if (!r.ok) console.error(`  #${o.number} 울타리: 정적 파일 ${r.reason} — 되돌아간다!`)
    for (const e of o.edits) {
      const r2 = patchDataFiles(e.before, e.after)
      if (!r2.ok) console.error(`  #${o.number} 문장: 정적 파일 ${r2.reason} — 되돌아간다!`)
    }
  }

  writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  console.log(`\n${ok.length}편 적용. 되돌리려면 ${BACKUP}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
