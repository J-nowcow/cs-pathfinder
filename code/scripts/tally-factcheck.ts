import { readFileSync, readdirSync } from 'node:fs'

/**
 * 사실 확인 결과를 묶어 센다.
 *
 * **"깨끗 38%"를 그대로 쓰면 안 된다.** 그렇게 말하면 62%가 틀렸다는 뜻으로
 * 읽히는데, 지적의 절반 이상이 `과일반화`이고 그중 상당수는 현학적이다.
 * 실제로 나온 것들을 보면 이렇다.
 *
 *   "GET은 조회, POST는 생성, PUT은 수정, DELETE는 삭제"
 *   → POST는 생성 외 처리에도 쓰이고 PUT도 생성할 수 있다
 *
 *   "RDB는 수직 확장, NoSQL은 수평 확장"
 *   → RDB도 샤딩과 분산 SQL로 수평 확장한다
 *
 * 둘 다 맞는 지적이지만 면접 대비 자료에서 저렇게 쓰는 것이 잘못은 아니다.
 * 저 지적을 다 반영하면 글이 "제품별로 확인한다"로 끝나는 하나 마나 한 문서가
 * 된다.
 *
 * 그래서 두 숫자를 따로 낸다.
 * - **하드 오류** (틀린 서술 + 용어 오용) — 면접관이 되물으면 그 자리에서
 *   드러난다. 반드시 고쳐야 한다
 * - **전체** — 참고용
 *
 * 실행: npx tsx scripts/tally-factcheck.ts [묶음디렉터리]
 */
const DIR = process.argv[2] ?? '/tmp/fc-out'

type Slice = {
  file: string
  total: number
  clean: number
  /** 하드 오류가 하나라도 있는 편 */
  hard: Set<number>
  byKind: Map<string, number>
}

const KINDS = ['틀린 서술', '용어 오용', '과일반화', '부정확']
const HARD = ['틀린 서술', '용어 오용']

const slices: Slice[] = []

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
  const text = readFileSync(`${DIR}/${file}`, 'utf8')

  /* 요약 줄에서 분모와 깨끗한 편 수를 읽는다. 별표가 붙어 오기도 한다 */
  const sum = /깨끗:\s*(\d+)\s*\/\s*(\d+)/.exec(text)
  if (!sum) {
    console.error(`${file}: 요약을 못 찾았다`)
    continue
  }

  const byKind = new Map<string, number>()
  const hard = new Set<number>()

  /*
   * 편별 절을 훑는다. `### 12. [분류] 질문` 다음부터 다음 `###`까지가 한 편이다.
   * 지적 줄은 `- [종류] "인용"` 모양이다.
   */
  let current = 0
  for (const line of text.split('\n')) {
    const head = /^###\s*(\d+)\./.exec(line)
    if (head) {
      current = Number(head[1])
      continue
    }
    const hit = /^\s*-\s*\[([^\]]+)\]/.exec(line)
    if (!hit) continue
    const kind = KINDS.find((k) => hit[1].includes(k))
    if (!kind) continue
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1)
    if (HARD.includes(kind) && current > 0) hard.add(current)
  }

  slices.push({
    file,
    clean: Number(sum[1]),
    total: Number(sum[2]),
    hard,
    byKind,
  })
}

const total = slices.reduce((a, s) => a + s.total, 0)
const clean = slices.reduce((a, s) => a + s.clean, 0)
const hard = slices.reduce((a, s) => a + s.hard.size, 0)
const pct = (x: number) => ((x / total) * 100).toFixed(1)

console.log(`## 대조한 해설 ${total}편 (묶음 ${slices.length}개)\n`)
console.log(`  하드 오류 있음 : ${hard}편 (${pct(hard)}%)  ← 반드시 고칠 것`)
console.log(`  아무 지적 없음 : ${clean}편 (${pct(clean)}%)`)
console.log(`  나머지         : ${total - clean - hard}편 — 과일반화·부정확만 있는 편\n`)

console.log('## 지적 종류별 (건수)')
for (const k of KINDS) {
  const n = slices.reduce((a, s) => a + (s.byKind.get(k) ?? 0), 0)
  const mark = HARD.includes(k) ? ' ←' : ''
  console.log(`  ${k.padEnd(6)} ${String(n).padStart(4)}건${mark}`)
}

console.log('\n## 묶음별')
for (const s of slices) {
  console.log(
    `  ${s.file.replace('.md', '')}  ${s.total}편 · 깨끗 ${s.clean} · 하드 ${s.hard.size}`,
  )
}

if (total < 276) {
  console.log(`\n주의: ${276 - total}편이 아직 안 들어왔다. 위 비율은 들어온 것만의 값이다.`)
}
