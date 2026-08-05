import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'
import { callWithFallback, MODEL_GATE } from '../src/lib/llm/client'

/**
 * 수렴 실패 대책 실험.
 *
 * 자유 텍스트로 canonical 문장을 만들게 하면 어휘가 매번 흔들린다(verify-gate로 실측).
 * 대신 이미 있는 형제 노드를 후보로 주고 "같은 게 있으면 고르라"고 시킨다.
 * 생성이 아니라 선택이라 결정론에 훨씬 가깝다.
 *
 * 실행: npm run verify:match
 */
const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const PARENT = 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?'

/** 이미 그래프에 있는 형제 노드들 */
const EXISTING = [
  { id: 'n1', q: 'connection pool size는 어떤 기준으로 정하는가?' },
  { id: 'n2', q: 'TCP 3-way handshake는 어떤 과정인가?' },
  { id: 'n3', q: 'connection leak은 어떻게 감지하고 방어하는가?' },
]

const schema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
  matched_id: z.string(),
  identity_scope: z.string(),
  normalized_question: z.string(),
})

const SYSTEM = `당신은 CS 학습 서비스의 질문 매칭기다.

입력이 부모 질문과 이어지는 CS 학습 질문인지 판정하고, 이미 있는 후보 중
같은 것을 묻는 항목이 있으면 그 id를 고른다.

matched_id 규칙:
- 후보 중 사용자가 묻는 것과 **같은 것을 묻는** 항목이 있으면 그 id를 그대로 쓴다.
  표현이 달라도 답이 같아질 질문이면 같은 것으로 본다.
- 없으면 빈 문자열을 쓰고 normalized_question에 새 표준 문장을 만든다.
- 애매하면 고르지 말고 새로 만든다. 잘못 합친 것은 되돌릴 수 없다.

matched_id를 골랐으면 normalized_question은 빈 문자열로 둔다.
무관한 입력은 relevant=false로 거절한다.`

const INPUTS = [
  '왜 코어 수 기반?',
  '코어 수로 정하는 이유가 뭔가요?',
  'pool size를 코어 개수 기준으로 잡는 까닭은',
  '풀 크기 얼마로 해야 되나요',
  '핸드셰이크가 뭔데요',
  '커넥션이 안 반납되면 어떻게 알아채나요',
  '이거 영어로 번역해줘',
]

async function main() {
  const candidates = EXISTING.map((e) => `- ${e.id}: ${e.q}`).join('\n')

  console.log('후보:')
  console.log(candidates)
  console.log()

  const tally = new Map<string, number>()

  for (const input of INPUTS) {
    const out = await callWithFallback({
      model: MODEL_GATE,
      schema,
      system: SYSTEM,
      prompt: [
        `부모 질문: ${PARENT}`,
        `이미 있는 후보:\n${candidates}`,
        `사용자 입력: ${input}`,
      ].join('\n\n'),
    })

    const verdict = !out.relevant
      ? `거절 (${out.reason})`
      : out.matched_id
        ? `기존 ${out.matched_id} 로 매칭`
        : `신규 → [${out.identity_scope}] ${out.normalized_question}`

    console.log(`"${input}"\n   ${verdict}`)

    const key = out.relevant ? out.matched_id || 'NEW' : 'REJECT'
    tally.set(key, (tally.get(key) ?? 0) + 1)
  }

  console.log('\n집계')
  for (const [k, v] of tally) console.log(`  ${k}: ${v}건`)
  console.log('\n기대: 앞 4건이 모두 n1, 5번째 n2, 6번째 n3, 마지막 REJECT')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
