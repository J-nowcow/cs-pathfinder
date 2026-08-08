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

/*
 * 이미 넣은 둘은 목록에서 뺐다. 다시 돌리면 원문이 안 맞아 멈춘다.
 *
 *   #216 JVM 메모리 영역 -> tree   (Codex·B 일치. 두 표)
 *   #233 HTTPS           -> stack  (Codex와 나. B는 반대 — 갈린 판정이다)
 *
 * `#233`은 내 규칙("둘 이상 일치")을 어기고 넣은 것이다. B는 "질문 자체가
 * 무엇이 다른가라 대조가 답"이라고 봤다. 본문이 "전송 계층 위에 얹은
 * 구조"라고 쓰는데 표가 그 층을 한 칸에 뭉쳤다는 점으로 갈랐다.
 * 되돌리려면 `docs/audit/_bodies-before-table-fix.json`.
 */
const FIXES: Fix[] = [
  {
    /*
     * 분류자 둘(외부 모델 · 서브에이전트 A)이 따로 같은 판정을 냈다.
     *
     * 나는 처음에 거부했다 -- 3열 표를 두 칸 도식으로 옮기면 `대가` 열이
     * 사라진다고 봤다. 그런데 A가 그 손실을 알면서도 갈랐다. **나란히 놓고
     * 고르는 두 방식이 아니라 누적되는 사다리**라는 것이다. 위 수준이 아래가
     * 막는 것을 포함한다. 본문도 처음부터 "위로 올라갈수록"이라고 쓴다.
     *
     * `대가`는 설명 칸에 붙여 살린다. 순서를 뒤집는다 -- `StackDiagram`은
     * 첫 줄을 맨 위에 그리므로 Serializable이 먼저 와야 본문의 "위로"와 맞는다.
     */
    number: 30,
    why: '누적 사다리다. 본문이 "위로 올라갈수록"이라고 쓴다 (Codex·A 일치)',
    before: `| 수준 | 막아주는 것 | 대가 |
| --- | --- | --- |
| Read Committed | 커밋 안 된 값 읽기 | 같은 질의가 두 번 다를 수 있다 |
| Repeatable Read | 읽은 행이 중간에 바뀌는 것 | 없던 행이 끼어드는 것은 못 막는다 |
| Serializable | 전부 | 충돌 시 트랜잭션이 취소된다 |`,
    after: `:::stack
Serializable | 전부 막는다. 대신 충돌하면 트랜잭션이 취소된다
Repeatable Read | 읽은 행이 중간에 바뀌는 것까지. 없던 행이 끼어드는 것은 못 막는다
Read Committed | 커밋 안 된 값 읽기까지. 같은 질의가 두 번 다를 수 있다
:::`,
  },
  {
    /*
     * **표가 사실을 뒤집어 놓았다.** `JVM 내부 | Java Runtime Environment (JRE)`
     * 는 거꾸로다 -- JRE가 JVM을 담는다(JRE = JVM + 표준 클래스 라이브러리).
     *
     * 그래서 이 편은 도식 판정과 무관하게 고쳐야 한다. 바로 아래 본문이
     * "컴파일러가 바이트코드로 변환하면 JVM이 읽어 기계어로 해석한다"고
     * 순서를 그대로 말하므로, 틀린 표를 그 순서로 바꾼다.
     */
    number: 203,
    why: '표가 사실을 뒤집었다 — JRE가 JVM을 담는다. 본문이 말하는 순서로 바꾼다',
    before: `| 구분 | 내용 |
| --- | --- |
| JVM 내부 | Java Runtime Environment (JRE) |
| 실행 대상 | Java Bytecode (.class) |`,
    after: `:::flow
자바 소스코드 -> 바이트코드(.class): 컴파일러가 변환한다
바이트코드(.class) -> 각 OS의 기계어: JVM이 읽어 해석한다
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
    const want = fix.after.slice(3, fix.after.indexOf('\n'))
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
