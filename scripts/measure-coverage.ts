import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { z } from 'zod'
import { callWithFallback, MODEL_GATE, type StructuredCaller, type StructuredCallArgs } from '../src/lib/llm/client'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'

/**
 * 꼬리질문이 기존 질문 안에 답을 갖는 비율을 잰다.
 *
 * debate에서 Codex가 "가장 위험한 가정"으로 지목한 것이다. 이 비율이 낮으면
 * 어느 전략도 그물을 못 만든다. 매칭률을 억지로 올릴수록 precision만 무너진다.
 *
 * 후보를 좁히지 않는다. 249개 질문을 통째로 프롬프트에 넣는다. 한 줄이
 * 25자 남짓이라 6KB밖에 안 되고, 좁히는 방법 자체가 아직 미검증이라
 * 좁히면 그 방법의 한계를 재게 된다. **여기서 재려는 것은 상한이다.**
 *
 * 실행: npm run measure:coverage [표본수]
 */
const ALL = [...EXAMPLE_NODES, ...GENERATED_NODES]

const schema = z.object({
  results: z.array(
    z.object({
      i: z.number(),
      /** 같은 것을 묻는 기존 질문 번호. 없으면 -1 */
      match: z.number(),
      /** 확신 없으면 고르지 말 것. 골랐다면 왜 같은지 한 줄 */
      why: z.string(),
    }),
  ),
})

const CATALOG = ALL.map((n, i) => `${i}. ${n.question}`).join('\n')

const SYSTEM = `기존 질문 목록이 주어진다. 새 질문 각각에 대해 **이미 같은 것을 묻는 기존 질문이 있는지** 판정한다.

## 기존 질문
${CATALOG}

## 판정 규칙
- **같은 것을 묻는 경우에만 고른다.** 표현이 달라도 답이 같아질 질문이면 같은 것으로 본다
- **"관련 있다"는 이유로 고르지 마라.** 이어지는 주제, 상위 개념, 비슷한 분야는 전부 아니다
  - 예: "인덱스는 언제 안 타는가?"와 "인덱스를 어떻게 만드는가?"는 **다르다**
  - 예: "TCP는 무엇을 보장하는가?"와 "TCP 3-way handshake는 왜 필요한가?"는 **다르다**
- 문장 틀이 같다고 고르지 마라. "~는 무엇을 기준으로 고르는가?"는 흔한 틀이다
- **애매하면 -1을 고른다.** 놓치는 것보다 잘못 잇는 것이 훨씬 나쁘다
- match에 번호를 골랐으면 why에 "둘 다 X를 묻는다" 식으로 한 줄 적는다. -1이면 why는 빈 문자열`

const patient: StructuredCaller = <T,>(a: StructuredCallArgs<T>): Promise<T> =>
  callWithFallback(a, { attemptTimeoutMs: 120_000 })

/** 꼬리질문을 부모와 함께 펼친다 */
const SUGGESTIONS = ALL.flatMap((n) =>
  n.suggestions.map((s) => ({ text: s, parent: n.question, parentCategory: n.category })),
)

const want = Number(process.argv[2] ?? 90)
const step = Math.max(1, Math.floor(SUGGESTIONS.length / want))
const sample = SUGGESTIONS.filter((_, i) => i % step === 0).slice(0, want)

console.log(`기존 질문 ${ALL.length}개 · 꼬리질문 전체 ${SUGGESTIONS.length}개 중 표본 ${sample.length}개\n`)

const BATCH = 30
let matched = 0
let checked = 0
const cases: string[] = []

for (let start = 0; start < sample.length; start += BATCH) {
  const batch = sample.slice(start, start + BATCH)
  const prompt = batch
    .map((s, i) => `${i}. ${s.text}\n   (부모: ${s.parent})`)
    .join('\n')

  try {
    const out = await patient({ model: MODEL_GATE, schema, system: SYSTEM, prompt })
    for (const r of out.results) {
      const s = batch[r.i]
      if (!s) continue
      checked += 1
      if (r.match >= 0 && r.match < ALL.length) {
        matched += 1
        if (cases.length < 40)
          cases.push(`"${s.text}"\n     → "${ALL[r.match].question}"`)
      }
    }
    process.stdout.write('·')
  } catch (e) {
    process.stdout.write('x')
  }
}

console.log(`\n\n판정한 것 ${checked}개`)
console.log(`  기존 질문에 답이 있다  ${matched} (${Math.round((matched / Math.max(checked, 1)) * 100)}%)`)
console.log()
for (const c of cases) console.log(`  ${c}\n`)
process.exit(0)
