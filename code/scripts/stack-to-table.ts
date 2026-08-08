import { loadEnvLocal } from '../src/lib/load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * `:::stack`으로 쓰인 비교표를 진짜 표로 되돌린다.
 *
 * 층으로 그리면 **없는 위계가 생긴다.** `트라이 | ... / 해시 맵 | ...`을
 * 위아래로 쌓으면 트라이가 해시 맵보다 상위라는 말이 되는데, 글은 그런
 * 말을 한 적이 없다.
 *
 * 손으로 앞뒤를 적지 않는다. 옮겨 적다 오타가 나면 원문이 안 맞아 멈추고,
 * 열세 편을 그렇게 다루면 반드시 하나는 틀린다. 그래서 **머리 이름만 받고
 * 변환은 기계가 한다.**
 *
 * 아래 목록은 두 분류자가 **각각 따로 판정해 일치한 것만** 담았다. 한쪽만
 * 표라고 한 것은 넣지 않았다 -- 이미 잘 맞는 것을 건드리면 손해다.
 *
 * 실행: npm run stack:table          (미리보기)
 *       npm run stack:table -- --apply
 */
loadEnvLocal()

/**
 * 첫 줄이 이미 머리줄인 것.
 *
 * `#199`는 `저장소 | 데이터`로 시작한다 -- 모델이 표를 쓰려다 울타리를 잘못
 * 골랐고, 구분줄이 없어 파서가 그 머리줄까지 **층 하나로** 그리고 있었다.
 * 그대로 옮기면 머리가 두 번 들어간다.
 */
const FIRST_LINE_IS_HEAD = new Set([199])

/** 질문 번호 → 표 머리 두 칸 */
const HEADS: Record<number, [string, string]> = {
  9: ['항목', '내용'],
  42: ['실행 형태', '터미널 관계'],
  47: ['효과 영역', '최소화 효과'],
  48: ['의존성 배열', '실행 시점'],
  52: ['속성', '분단 시 의미'],
  56: ['범위', '순서 보장'],
  61: ['게이트웨이 기능', '효과'],
  161: ['방식', '스택 메모리 특성'],
  163: ['자료구조', '저장 방식'],
  182: ['성능 요소', '영향'],
  187: ['실행 방식', '실행 조건·특성'],
  193: ['스케줄러', '역할'],
  199: ['저장소', '노출 데이터'],
}

const GEN = 'data/generated-nodes.ts'
const BACKUP = 'docs/audit/_bodies-before-stack-table.json'

/** 소스 파일에는 본문이 한 줄짜리 JSON 문자열로 들어 있다 */
const escaped = (s: string) => s.replace(/\n/g, '\\n')

/** 표 칸 안의 파이프는 막아 준다. 안 그러면 칸이 하나 더 생긴다 */
const cell = (s: string) => s.replace(/\|/g, '\\|').trim()

type Built = { number: number; before: string; after: string; rows: number }

function build(body: string, heads: [string, string], dropFirst: boolean) {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => /^:::[ \t]*stack\b/.test(l))
  if (start < 0) return { error: ':::stack이 없다' }
  const end = lines.findIndex((l, i) => i > start && /^:::[ \t]*(end)?[ \t]*$/.test(l))
  if (end < 0) return { error: '닫는 울타리가 없다' }

  let inner = lines.slice(start + 1, end).filter((l) => l.trim().length > 0)
  if (dropFirst) inner = inner.slice(1)
  if (inner.length < 2) return { error: `줄이 ${inner.length}개다` }

  const rows: Array<[string, string]> = []
  for (const l of inner) {
    const parts = l.split('|')
    /* 칸이 둘이 아니면 손대지 않는다. 셋이면 뜻이 하나 더 있다는 말이다 */
    if (parts.length !== 2) return { error: `칸이 ${parts.length}개인 줄이 있다: ${l.trim().slice(0, 30)}` }
    rows.push([cell(parts[0]), cell(parts[1])])
  }

  const table = [
    `| ${heads[0]} | ${heads[1]} |`,
    '| --- | --- |',
    ...rows.map(([a, b]) => `| ${a} | ${b} |`),
  ].join('\n')

  return { before: lines.slice(start, end + 1).join('\n'), after: table, rows: rows.length }
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
  const nums = Object.keys(HEADS).map(Number)
  const r = await pool.query<{ id: string; number: number; question: string; body: string }>(
    `select id, number, normalized_question as question, coalesce(body,'') as body
       from qnode where number = any($1::int[]) order by number`,
    [nums],
  )

  const ok: Array<{ id: string; number: number; question: string; body: string; next: string; before: string; after: string; rows: number }> = []
  const skipped: string[] = []

  for (const row of r.rows) {
    const built = build(row.body, HEADS[row.number], FIRST_LINE_IS_HEAD.has(row.number))
    if ('error' in built) {
      skipped.push(`#${row.number} ${built.error}`)
      continue
    }
    const hits = row.body.split(built.before).length - 1
    if (hits !== 1) {
      skipped.push(`#${row.number} 원문이 ${hits}번 맞았다`)
      continue
    }
    const next = row.body.replace(built.before, built.after)
    const kinds = parseBlocks(next).map((b) => b.type)
    if (!kinds.includes('table')) {
      skipped.push(`#${row.number} 바꿔도 표로 안 읽힌다: ${kinds.join(',')}`)
      continue
    }
    ok.push({ ...row, next, ...built })
  }

  for (const o of ok) console.log(`#${o.number} ${o.rows}줄  ${o.question.slice(0, 40)}`)
  if (skipped.length) {
    console.log('\n건너뛴 것')
    for (const s of skipped) console.log(`  ${s}`)
  }
  console.log(`\n바꿀 것 ${ok.length} · 건너뜀 ${skipped.length} · 찾은 것 ${r.rows.length}/${nums.length}`)

  if (!apply) {
    console.log('미리보기다. 실제로 쓰려면 --apply')
    await pool.end()
    return
  }

  const gen = readFileSync(GEN, 'utf8')
  let nextGen = gen
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
    const from = escaped(o.before)
    if (nextGen.includes(from)) nextGen = nextGen.replace(from, escaped(o.after))
  }

  writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  if (nextGen !== gen) writeFileSync(GEN, nextGen)
  console.log(`\n${ok.length}편 적용. 되돌리려면 ${BACKUP}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
