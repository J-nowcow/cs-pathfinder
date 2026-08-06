import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

/**
 * 대조 결과에서 **반드시 고칠 것**만 뽑아 저장소에 남긴다.
 *
 * 전수 대조 결과가 `/tmp/fc-out/`에만 있었다. 앞선 문서에 "저장소에는 안
 * 넣는다 — `slice-corpus.ts`로 다시 만들 수 있다"고 적었는데 **틀린 말이다.**
 * 슬라이서가 다시 만드는 것은 **원본 묶음**이고 판정은 아니다. 판정은 병렬
 * 에이전트 다섯이 Codex를 열 번 부른 결과다. `/tmp`가 비면 그게 통째로 없어진다.
 *
 * 그렇다고 원본 18만 자를 그대로 넣지는 않는다. 지적의 절반 이상이 과일반화이고
 * 상당수는 면접 대비 자료에서 잘못이라 하기 어렵다. **틀린 서술과 용어 오용만**
 * 남긴다 — 면접관이 되물으면 그 자리에서 드러나는 것들이다.
 *
 * 절 번호를 노드 id로 바꿔 적는다. 그래야 고칠 때 바로 찾는다. 대조 결과에는
 * 번호만 있고 id는 원본 묶음의 주석에 있다.
 *
 * 실행: npx tsx scripts/extract-hard-errors.ts [결과디렉터리] [원본디렉터리]
 */
const OUT_DIR = process.argv[2] ?? '/tmp/fc-out'
const SRC_DIR = process.argv[3] ?? '/tmp/corpus-slices'
const DEST = 'docs/audit/2026-08-07-hard-errors.md'

const HARD = ['틀린 서술', '용어 오용']

type Finding = { kind: string; lines: string[] }
type Node = {
  slice: string
  index: number
  id: string
  category: string
  question: string
  findings: Finding[]
}

const nodes: Node[] = []

for (const file of readdirSync(OUT_DIR).filter((f) => f.endsWith('.md')).sort()) {
  /* 원본 묶음에서 번호 → id·분류·질문을 읽는다 */
  const src = readFileSync(`${SRC_DIR}/${file}`, 'utf8')
  const meta = new Map<number, { id: string; category: string; question: string }>()
  const HEAD = /^## (\d+)\.\s*\[([^\]]+)\]\s*(.+)$/gm
  let m: RegExpExecArray | null
  while ((m = HEAD.exec(src))) {
    const after = src.slice(m.index, m.index + 400)
    const id = /<!--\s*id:\s*([0-9a-f-]{36})/.exec(after)?.[1] ?? ''
    meta.set(Number(m[1]), { id, category: m[2], question: m[3].trim() })
  }

  /* 판정에서 편별 절을 훑는다 */
  const lines = readFileSync(`${OUT_DIR}/${file}`, 'utf8').split('\n')
  let current: Node | null = null
  let finding: Finding | null = null

  for (const line of lines) {
    const head = /^###\s*(\d+)\./.exec(line)
    if (head) {
      const n = Number(head[1])
      const info = meta.get(n)
      finding = null
      current = info
        ? { slice: file.replace('.md', ''), index: n, ...info, findings: [] }
        : null
      if (current) nodes.push(current)
      continue
    }
    if (!current) continue

    const hit = /^\s*-\s*\[([^\]]+)\]\s*(.*)$/.exec(line)
    if (hit) {
      const kind = HARD.find((k) => hit[1].includes(k))
      finding = kind ? { kind, lines: [hit[2]] } : null
      if (finding) current.findings.push(finding)
      continue
    }
    /* 지적에 딸린 `왜:`·`고침:` 줄 */
    if (finding && /^\s{2,}\S/.test(line)) finding.lines.push(line.trim())
  }
}

const hard = nodes.filter((n) => n.findings.length > 0)
const byCategory = new Map<string, Node[]>()
for (const n of hard) byCategory.set(n.category, [...(byCategory.get(n.category) ?? []), n])

const count = hard.reduce((a, n) => a + n.findings.length, 0)

const body = [...byCategory]
  .sort((a, b) => b[1].length - a[1].length)
  .map(([category, list]) => {
    const items = list
      .map((n) => {
        const fs = n.findings
          .map((f) => `  - **[${f.kind}]** ${f.lines.join('\n    ')}`)
          .join('\n')
        return `### ${n.question}\n\n\`${n.id}\` · ${n.slice} #${n.index}\n\n${fs}\n`
      })
      .join('\n')
    return `## ${category} — ${list.length}편\n\n${items}`
  })
  .join('\n')

writeFileSync(
  DEST,
  `# 반드시 고칠 것 — 하드 오류 ${hard.length}편 · ${count}건

> 2026-08-07 전수 대조에서 나온 **틀린 서술과 용어 오용**만 모았다.
> 과일반화·부정확은 뺐다 — 지적 수로는 그쪽이 더 많지만 면접 대비 자료에서
> 잘못이라 하기 어려운 것이 섞여 있다. 판단 근거는
> [2026-08-07-fact-check-full.md](2026-08-07-fact-check-full.md)에 적었다.
>
> **여기 있는 것은 다르다.** 면접관이 되물으면 그 자리에서 드러난다.
>
> 고치는 것은 **운영 DB 쓰기**라 사람이 정한다. 이 문서는 무엇을 고칠지
> 정하는 데 쓴다. 판정도 모델이 한 것이라 **하나씩 보고** 고쳐야 한다.
>
> 다시 만들려면: \`npx tsx scripts/extract-hard-errors.ts\`

${body}`,
)

console.log(`하드 오류 ${hard.length}편 · ${count}건 → ${DEST}`)
console.log(`훑은 편 ${nodes.length}편 (id를 못 찾은 절은 건너뛴다)`)
for (const [c, l] of [...byCategory].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${c.padEnd(16)} ${l.length}편`)
}
