import { loadEnvLocal } from '../src/lib/load-env'
import { z } from 'zod'
import { callWithFallback, MODEL_GATE } from '../src/lib/llm/client'

/**
 * 후보 매칭이 후보 수에 따라 어떻게 무너지는지 본다.
 *
 * 후보 매칭은 형제 노드가 적을 때 잘 된다(6/7 실측). 그런데 인기 있는 부모는
 * 자식이 수십 개까지 늘어난다. 그때도 버티는지가 이 방식의 실용성을 가른다.
 *
 * 실행: npm run verify:scale
 */
loadEnvLocal()

const PARENT = 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?'

/** 정답이 있는 후보 3개. 어느 규모에서든 이 셋은 후보에 들어간다. */
const TARGETS = [
  { id: 'n01', q: 'connection pool size는 어떤 기준으로 정하는가?' },
  { id: 'n02', q: 'TCP 3-way handshake는 어떤 과정인가?' },
  { id: 'n03', q: 'connection leak은 어떻게 감지하고 방어하는가?' },
]

/** 정답을 흐리는 잡음 후보. 주제가 가까울수록 어려운 조건이 된다. */
const NOISE = [
  'connection pool이 고갈되면 요청은 어떻게 되는가?',
  'HikariCP와 Tomcat JDBC Pool은 무엇이 다른가?',
  'idle connection은 언제 정리되는가?',
  'connection validation 쿼리는 왜 필요한가?',
  'DB 세션과 커넥션은 어떻게 다른가?',
  'statement cache는 무엇을 재사용하는가?',
  'autocommit을 끄면 무엇이 달라지는가?',
  'connection timeout과 socket timeout의 차이는?',
  'DB 최대 연결 수는 무엇으로 제한되는가?',
  'read replica로 커넥션을 분산하면 무엇이 바뀌는가?',
  'PgBouncer 같은 외부 풀러는 언제 쓰는가?',
  'transaction pooling과 session pooling의 차이는?',
  'prepared statement는 풀러와 왜 충돌하는가?',
  'connection acquire 대기가 길어지면 무엇을 봐야 하는가?',
  'WAS 스레드 수와 커넥션 수는 어떤 관계인가?',
  'DB 커넥션에도 keep-alive가 있는가?',
  'SSL 커넥션은 비용이 얼마나 더 드는가?',
  '커넥션 생성 실패는 어떻게 재시도해야 하는가?',
  'connection pool 지표는 무엇을 수집해야 하는가?',
  '멀티 테넌트에서 커넥션은 어떻게 나누는가?',
  'DB 페일오버 시 기존 커넥션은 어떻게 되는가?',
  'connection pool을 서비스마다 나눠야 하는가?',
  '커넥션 누수와 스레드 누수는 어떻게 구분하는가?',
  'DNS 캐시가 커넥션 재연결에 미치는 영향은?',
  '커넥션 워밍업은 언제 필요한가?',
  'DB proxy를 두면 지연이 얼마나 늘어나는가?',
  '커넥션 수를 늘려도 처리량이 안 느는 이유는?',
  'connection pool 크기를 동적으로 바꿔도 되는가?',
  'JDBC 드라이버 버전이 커넥션 동작에 영향을 주는가?',
  '커넥션 풀 초기화 실패 시 앱은 떠야 하는가?',
  'DB 재시작 후 커넥션은 자동 복구되는가?',
  '커넥션당 메모리 사용량은 얼마나 되는가?',
  'connection pool과 서킷 브레이커를 함께 쓰는가?',
  '커넥션 획득 순서는 공정한가?',
  'DB 커넥션을 스레드 로컬에 두면 무엇이 문제인가?',
  'connection pool 로그는 어느 수준으로 남겨야 하는가?',
  '커넥션 검증 주기는 어떻게 정하는가?',
  '커넥션 풀이 여러 개면 무엇을 조심해야 하는가?',
  'DB 커넥션과 HTTP 커넥션의 재사용 전략은 어떻게 다른가?',
  '커넥션 종료를 명시적으로 해야 하는 이유는?',
  '풀 크기와 DB max_connections는 어떻게 맞추는가?',
  'DB 커넥션에 우선순위를 줄 수 있는가?',
  'connection pool 튜닝은 무엇부터 보는가?',
  '커넥션 대기 큐는 얼마나 길게 둬야 하는가?',
  '커넥션 재사용이 트랜잭션 격리에 영향을 주는가?',
  'DB 커넥션을 비동기로 얻을 수 있는가?',
  '커넥션 생성 비용은 DB 종류마다 다른가?',
]

const CASES = [
  { input: '왜 코어 수 기반?', expect: 'n01' },
  { input: '코어 수로 정하는 이유가 뭔가요?', expect: 'n01' },
  { input: 'pool size를 코어 개수 기준으로 잡는 까닭은', expect: 'n01' },
  { input: '풀 크기 얼마로 해야 되나요', expect: 'n01' },
  { input: '핸드셰이크가 뭔데요', expect: 'n02' },
  { input: '커넥션이 안 반납되면 어떻게 알아채나요', expect: 'n03' },
  { input: '이거 영어로 번역해줘', expect: 'REJECT' },
]

const schema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
  matched_id: z.string(),
  normalized_question: z.string(),
})

const SYSTEM = `당신은 CS 학습 서비스의 질문 매칭기다.

입력이 부모 질문과 이어지는 CS 학습 질문인지 판정하고, 후보 중 같은 것을 묻는
항목이 있으면 그 id를 고른다.

- 표현이 달라도 답이 같아질 질문이면 같은 것으로 본다.
- 입력이 짧고 생략이 많아도 부모 질문의 맥락으로 보충해서 판단한다.
- 후보에 없으면 matched_id를 빈 문자열로 두고 새 표준 문장을 만든다.
- 애매하면 고르지 말고 새로 만든다. 잘못 합친 것은 되돌릴 수 없다.
- CS 학습과 무관한 요청은 relevant=false로 거절한다.`

/** 모델을 갈아끼워 비교할 수 있게 한다. 기본은 게이트 모델 */
const GATE = process.env.GATE_MODEL || MODEL_GATE

async function runAt(size: number) {
  const pool = [...TARGETS, ...NOISE.slice(0, Math.max(0, size - TARGETS.length)).map((q, i) => ({ id: `x${i + 1}`, q }))]
  const candidates = pool.map((c) => `- ${c.id}: ${c.q}`).join('\n')

  let hit = 0
  const misses: string[] = []

  for (const c of CASES) {
    const out = await callWithFallback({
      model: GATE,
      schema,
      system: SYSTEM,
      prompt: [
        `부모 질문: ${PARENT}`,
        `후보 (${pool.length}개):\n${candidates}`,
        `사용자 입력: ${c.input}`,
      ].join('\n\n'),
    })

    const got = !out.relevant ? 'REJECT' : out.matched_id || 'NEW'
    if (got === c.expect) hit += 1
    else misses.push(`"${c.input}" 기대 ${c.expect} → 실제 ${got}`)
  }

  console.log(`후보 ${String(pool.length).padStart(2)}개 · 정확 ${hit}/${CASES.length}`)
  for (const m of misses) console.log(`     ${m}`)
  return hit
}

async function main() {
  console.log(`후보 규모별 매칭 정확도 — 모델: ${GATE}\n`)
  for (const size of [3, 10, 25, 50]) {
    await runAt(size)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
