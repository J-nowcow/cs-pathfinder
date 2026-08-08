import { loadEnvLocal } from '../src/lib/load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { patchDataFiles } from './lib/patch-data'

/**
 * 표로 눕혀진 것 중 **정말 구조인 것만** 도식으로 되돌린다.
 *
 * 167편을 분류자 셋에 넘겼더니 외부 모델이 25편을 바꾸자고 했다. 원문을
 * 대조하니 **대부분 바꾸면 안 되는 것이었다.**
 *
 * - **9편은 열을 버린다.** 3열·4열 표를 두 칸짜리 도식으로 바꾸면 열 하나가
 *   통째로 사라진다. `#30` 격리 수준은 `수준 | 막아주는 것 | 대가`인데
 *   stack으로 옮기면 `대가`가 없어진다
 * - **14편은 제목 붙은 목록이다.** CAP의 P·C·A는 서로 동렬인데 `tree`로
 *   옮기면서 없던 뿌리를 만든다. **목록은 도식이 아니다** -- 어휘 문서가
 *   조건 집합을 보류로 둔 이유가 그것이다
 *
 * 남은 둘만 넣는다. 둘 다 **본문이 이미 그 구조를 말하고 있다.**
 *
 * 실행: npm run fix:tables          (미리보기)
 *       npm run fix:tables -- --apply
 */
loadEnvLocal()

type Fix = { number: number; why: string; before: string; after: string }

const FIXES: Fix[] = [
  {
    number: 216,
    why: '공유/개별 아래 실제 영역이 담긴다. 두 단 포함 관계다',
    before: `| 구분 | 메모리 영역 |
| --- | --- |
| 공유 영역 | Heap, Method Area |
| 개별 영역 | Stack, PC Register, Native Method Stack |`,
    after: `:::tree
공유 영역 | 모든 스레드가 함께 쓴다
  Heap
  Method Area
개별 영역 | 스레드마다 따로 생긴다
  Stack
  PC Register
  Native Method Stack
:::`,
  },
  {
    /*
     * 본문이 이미 "전송 계층 위에 SSL/TLS라는 보안 계층을 얹은 구조"라고
     * 적는다. 그런데 표는 `HTTPS | HTTP + SSL/TLS`로 그 층을 한 칸에 뭉쳐
     * 놓았다. 층으로 그리면 글이 말하는 것이 그대로 보인다.
     */
    number: 233,
    why: '본문이 "위에 얹은 구조"라고 말하는데 표는 층을 한 칸에 뭉쳤다',
    before: `| 프로토콜 | 전송 방식 |
| --- | --- |
| HTTPS | HTTP + SSL/TLS |
| HTTP | 평문 전송 |`,
    after: `:::stack
HTTP | 요청과 응답. 내용은 그대로다
SSL/TLS | 암호화·인증·무결성. **HTTPS는 이 층이 더 있는 것이다**
TCP | 전송
:::`,
  },
]

const BACKUP = 'docs/audit/_bodies-before-table-fix.json'

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const ok: Array<{ id: string; number: number; question: string; body: string; next: string; fix: Fix }> = []

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
    const hits = row.body.split(fix.before).length - 1
    if (hits !== 1) {
      console.error(`#${fix.number} 원문이 ${hits}번 맞았다. 1이어야 한다. 중단.`)
      process.exit(1)
    }
    const next = row.body.replace(fix.before, fix.after)
    const kinds = parseBlocks(next).map((b) => b.type)
    const want = fix.after.startsWith(':::tree') ? 'tree' : 'stack'
    if (!kinds.includes(want as never)) {
      console.error(`#${fix.number} 바꿔도 ${want}로 안 읽힌다: ${kinds.join(',')}. 중단.`)
      process.exit(1)
    }
    console.log(`#${fix.number} ${row.question}`)
    console.log(`  ${fix.why}`)
    console.log(`  ${kinds.join(' · ')}`)
    ok.push({ ...row, number: fix.number, next, fix })
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
    /* 정적 파일을 반드시 같이. DB만 고치면 `bootstrap`이 되돌린다 */
    const r = patchDataFiles(o.fix.before, o.fix.after)
    if (!r.ok) console.error(`  #${o.number} 정적 파일 ${r.reason} — 되돌아간다!`)
  }

  writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  console.log(`\n${ok.length}편 적용. 되돌리려면 ${BACKUP}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
