import { readFileSync, writeFileSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { questionFormIssues } from '../src/lib/llm/question-form'
import { CATEGORIES } from '../src/lib/tree/categories'

/**
 * 생성 결과를 데이터 파일로 옮긴다.
 *
 * `data/example-nodes.ts`(손으로 쓴 30개)와 섞지 않는다. 그쪽은 생성 규칙의
 * 기준선이고 시험이 그것을 상대로 걸려 있다. 모델이 쓴 것을 같은 파일에
 * 넣으면 기준선이 모델 출력으로 바뀌고, 그러면 예시가 기준선 노릇을 못 한다.
 *
 * 규칙을 어긴 것은 담지 않는다. 생성 단계에서는 표시만 하고 버리지 않았는데,
 * 그건 무엇이 얼마나 어긋나는지 세기 위해서였다. 화면에 나갈 것을 고르는
 * 자리에서는 걸러야 한다.
 *
 * 실행: npm run build:generated
 */
type Made = {
  src: string
  category: string
  topic: string
  question: string
  identityScope: string
  body: string
  summary: string
  suggestions: string[]
  issues: string[]
}

const IN = '/tmp/cs-harvest/generated.json'
const OUT = 'data/generated-nodes.ts'

const made: Made[] = JSON.parse(readFileSync(IN, 'utf8'))

/**
 * 담을지 정한다.
 *
 * 생성 때의 검사를 다시 돈다. 그 사이 규칙이 바뀌었을 수 있고, 무엇보다
 * 판단 근거가 파일에 적힌 문자열이 아니라 지금 코드여야 한다.
 */
function usable(m: Made): string[] {
  const bad: string[] = []
  if (!CATEGORIES.includes(m.category as (typeof CATEGORIES)[number])) bad.push('카테고리')
  if (questionFormIssues(m.question).length > 0) bad.push('질문형식')
  if (m.question.length > 40) bad.push('질문길이')
  if (m.suggestions.length !== 5) bad.push('꼬리질문수')
  if (m.suggestions.some((s) => s.length > 35 || questionFormIssues(s).length > 0))
    bad.push('꼬리질문')

  const blocks = parseBlocks(m.body)
  const first = blocks.findIndex((b) => b.type !== 'paragraph')
  if (first < 0) bad.push('도식없음')
  else if (first >= 3) bad.push('도식위치')
  for (const b of blocks) {
    if (b.type !== 'paragraph') continue
    if (b.text.includes(':::') || b.text.includes('```')) bad.push('울타리누출')
    if (b.text.length > 150) bad.push('긴문단')
  }
  return bad
}

/** 같은 질문이 두 번 들어가면 노드 id가 겹쳐 하나가 다른 하나를 덮는다 */
const seen = new Set<string>()
const kept: Made[] = []
const dropped = new Map<string, number>()

for (const m of made) {
  const bad = usable(m)
  const key = `${m.identityScope}::${m.question}`
  if (seen.has(key)) bad.push('중복')
  if (bad.length > 0) {
    for (const b of bad) dropped.set(b, (dropped.get(b) ?? 0) + 1)
    continue
  }
  seen.add(key)
  kept.push(m)
}

const q = (s: string) => JSON.stringify(s)

const lines = [
  '/**',
  ' * 생성된 루트 노드.',
  ' *',
  ' * 공개 저장소(VSFe/Tech-Interview, gyoogle/tech-interview-for-developer)에서',
  ' * 주제만 모아 우리 프롬프트로 다시 쓴 것이다. 남의 질문 문장을 그대로 옮기지',
  ' * 않는다 — 그쪽은 경어체 서술형이라 형식이 다르고, 큐레이션된 문장을 가져오는',
  ' * 것도 피하는 편이 맞다.',
  ' *',
  ' * **손으로 쓴 data/example-nodes.ts와 섞지 않는다.** 그쪽은 생성 규칙의',
  ' * 기준선이고 시험이 그것을 상대로 걸려 있다. 모델이 쓴 것을 같은 파일에 넣으면',
  ' * 기준선이 모델 출력으로 바뀐다.',
  ' *',
  ' * 이 파일은 scripts/build-generated-nodes.ts가 만든다. 손으로 고치지 않는다.',
  ' */',
  "import type { ExampleNode } from './example-nodes'",
  '',
  'export const GENERATED_NODES: ExampleNode[] = [',
]

for (const m of kept) {
  lines.push('  {')
  lines.push(`    identityScope: ${q(m.identityScope)},`)
  lines.push(`    category: ${q(m.category)},`)
  lines.push(`    question: ${q(m.question)},`)
  lines.push(`    body: ${q(m.body)},`)
  lines.push('    suggestions: [')
  for (const s of m.suggestions) lines.push(`      ${q(s)},`)
  lines.push('    ],')
  lines.push('  },')
}
lines.push(']', '')

writeFileSync(OUT, lines.join('\n'))

const byCat = new Map<string, number>()
for (const k of kept) byCat.set(k.category, (byCat.get(k.category) ?? 0) + 1)

console.log(`생성 ${made.length}개 → 담은 것 ${kept.length}개`)
if (dropped.size > 0) {
  console.log('걸러낸 이유:')
  for (const [why, n] of [...dropped].sort((a, b) => b[1] - a[1])) console.log(`  ${why}: ${n}`)
}
console.log('카테고리별:')
for (const c of CATEGORIES) console.log(`  ${c}: ${byCat.get(c) ?? 0}`)
