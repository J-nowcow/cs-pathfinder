import { readFileSync, writeFileSync } from 'node:fs'
import { loadEnvLocal } from '../src/lib/load-env'

/**
 * B5 — 분야 재분류. **파일이 원본이라 파일을 고친다.**
 *
 * `인프라 · 보안`이 미분류 수용소가 됐다(31편 중 13편이 다른 분야 CS
 * 기초의 재등재). audit(2026-08-07)의 "19개 중 9개"는 낡은 숫자였다 —
 * 시작 전에 다시 재니 31개 중 13개였다.
 *
 * DB만 고치면 부팅 시드가 되돌린다. 그리고 upsert가 분야를 안 갱신하던
 * 결함도 같이 고쳤다(bootstrap.ts) — 안 고쳤으면 이 파일 수정이
 * 조용히 무시됐다.
 *
 * 실행: npx tsx scripts/retag-category.ts          (미리보기)
 *       npx tsx scripts/retag-category.ts --apply
 */
loadEnvLocal()

/** 번호 → 새 분야. 판정 근거는 커밋 메시지와 계획 문서에 */
const MOVES: Record<number, string> = {
  173: '언어 · 런타임', // 고정/부동 소수점 — 수 표현
  264: '언어 · 런타임', // 함수형 프로그래밍
  174: '자료구조 · 알고리즘', // 배열 vs 연결 리스트
  232: '자료구조 · 알고리즘', // 트라이
  205: '운영체제', // 패리티/해밍 — 하드웨어 인접
  210: '운영체제', // 블로킹/논블로킹 I/O
  211: '운영체제', // 경쟁 상태
  234: '운영체제', // 컨텍스트 스위칭
  235: '운영체제', // 뮤텍스/세마포어
  258: '운영체제', // CPU/메모리 병목
  263: '운영체제', // 페이징/세그멘테이션
  212: '아키텍처 · 분산시스템', // 리팩토링과 기능 추가 분리
  236: '아키텍처 · 분산시스템', // 객체 지향 5원칙
}

const FILES = [
  'data/generated-nodes.ts',
  'data/example-nodes.ts',
  'data/authored-nodes.ts',
  'data/on-demand-nodes.ts',
]

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const r = await pool.query<{ number: number; q: string }>(
    'select number, normalized_question as q from qnode where number = any($1)',
    [Object.keys(MOVES).map(Number)],
  )
  await pool.end()

  const texts = new Map(FILES.map((f) => [f, readFileSync(f, 'utf8')]))
  const misses: number[] = []
  let fixed = 0

  for (const row of r.rows) {
    const to = MOVES[row.number]
    let done = false
    for (const f of FILES) {
      let t = texts.get(f)!
      /*
       * **category가 question보다 앞에 온다** — 처음에 question 뒤를 뒤져
       * 13건 전부 못 찾았다. 필드 순서는 파일을 열어 확인한 사실이다.
       * 데이터 파일마다 따옴표가 다르다('·"). 못 찾으면 소리 내고 멈춘다 —
       * 조용히 건너뛰면 "고쳤는데 안 바뀌는" 상태가 된다.
       */
      const q = escapeRe(row.q)
      const re = new RegExp(
        `(category:\\s*(['"]))([^'"]+)(\\2,\\s*question:\\s*(['"])${q}\\5)`,
      )
      const m = re.exec(t)
      if (m) {
        console.log(`#${row.number} ${f.split('/')[1]}  ${m[3]} → ${to}`)
        t = t.replace(re, `$1${to}$4`)
        texts.set(f, t)
        done = true
        fixed += 1
        break
      }
    }
    if (!done) misses.push(row.number)
  }

  if (misses.length > 0) {
    console.error(`못 찾음: ${misses.join(', ')} — 질문 문장이 파일과 다르다`)
    process.exit(1)
  }

  if (!apply) {
    console.log(`${fixed}건. --apply로 기록`)
    return
  }
  for (const [f, t] of texts) writeFileSync(f, t)
  console.log(`${fixed}건 교체 완료`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
