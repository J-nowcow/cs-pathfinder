import { MODEL_GATE, MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

/**
 * API 키 없이 화면을 만들고 검증하기 위한 가짜 LLM.
 *
 * 키가 없으면 캐시 미스에서 확장이 실패해 읽기 UI를 아예 만들 수 없다.
 * realCaller는 손대지 않고 주입으로만 붙인다. 프로덕션 경로에 영향이 없다.
 *
 * 결정론적인 것이 중요하다. 같은 질문이 같은 정규화 문장으로 수렴해야
 * 캐시 히트 경로가 화면에서 재현된다.
 */

/** 스코프 판정용 키워드. 앞에 있는 것이 먼저 걸린다. */
const SCOPE_HINTS: Array<[string, string[]]> = [
  ['tcp', ['tcp', 'handshake', 'time_wait', 'close_wait', '3-way', '4-way']],
  ['http', ['http', 'rest', 'cors', 'cookie', '쿠키', 'header']],
  ['network', ['네트워크', 'dns', 'ip', 'udp', 'socket', '소켓', 'load balanc']],
  ['postgres', ['인덱스', 'index', '쿼리', 'query', '트랜잭션', 'transaction', 'sql', 'db', '커넥션']],
  ['redis', ['redis', '레디스', '캐시 서버']],
  ['os', ['운영체제', '프로세스', '스레드', 'context switch', '컨텍스트 스위', 'tlb', '페이지', 'mutex']],
  ['linux', ['리눅스', 'linux', 'inode', 'systemd']],
  ['java', ['java', '자바', 'jvm', 'gc', 'equals', 'hashcode']],
  ['spring', ['spring', '스프링', 'bean', 'aop', 'jpa']],
  ['javascript', ['javascript', '자바스크립트', 'event loop', '이벤트 루프', 'promise', 'closure', '클로저']],
  ['react', ['react', '리액트', 'useeffect', 'usestate', 'hook', '렌더링', 'virtual dom']],
  ['python', ['python', '파이썬', 'gil']],
  ['docker', ['docker', '도커', '컨테이너']],
  ['kubernetes', ['kubernetes', 'k8s', '쿠버네티스', 'pod']],
  ['security', ['보안', 'jwt', 'xss', 'csrf', 'oauth', '토큰', '인증', '암호']],
  ['android', ['android', '안드로이드']],
  ['ios', ['ios', 'swift']],
]

/** CS 학습과 무관한 요청을 거절하는 신호. 실제 게이트의 거절 규칙을 흉내 낸다. */
const REJECT_HINTS = ['번역', 'translate', '코드 짜줘', '대신 써줘', '노래', '점심', '주식']

function pickScope(text: string): string {
  const lower = text.toLowerCase()
  for (const [scope, hints] of SCOPE_HINTS) {
    if (hints.some((h) => lower.includes(h))) return scope
  }
  return 'generic'
}

/**
 * 최소 정규화만 한다.
 *
 * 원문을 크게 바꾸면 화면에서 사용자가 친 것과 달라 보여 검증이 어려워진다.
 * 공백을 정리하고 의문형으로 끝맺는 선까지만 손댄다.
 */
function normalizeQuestion(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().replace(/[?？!.]+$/, '')
  return `${cleaned}?`
}

function field(prompt: string, label: string): string {
  const m = prompt.match(new RegExp(`^${label}:\\s*(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

function gateResponse(prompt: string) {
  const rawInput = field(prompt, '사용자 입력')
  const lower = rawInput.toLowerCase()

  if (REJECT_HINTS.some((h) => lower.includes(h))) {
    return {
      relevant: false,
      reason: 'CS 학습과 관련 없는 요청입니다.',
      identity_scope: 'generic',
      normalized_question: '',
    }
  }

  return {
    relevant: true,
    reason: '',
    identity_scope: pickScope(`${rawInput} ${field(prompt, '부모 질문')}`),
    normalized_question: normalizeQuestion(rawInput),
  }
}

/**
 * 꼬리질문 틀. 5개가 서로 다른 방향으로 뻗는다.
 *
 * 부모 질문을 통째로 앞에 붙이면 화면에서 한 줄을 넘겨 읽기 어렵다.
 * 앞 두 어절만 따 붙인다. 짧으면서 어느 질문에서 뻗었는지도 남는다.
 *
 * 조사는 붙이지 않고 대시로 잇는다. 뽑아온 어절이 이미 조사를 달고 있어
 * 깊이가 쌓이면 "TCP 3-way은에" 같은 겹침이 생긴다.
 */
const SUGGESTION_FRAMES = [
  (k: string) => `${k} — 판단 근거는?`,
  (k: string) => `${k} — 반대로 선택하면?`,
  (k: string) => `${k} — 실무 측정 방법은?`,
  (k: string) => `${k} — 규모가 커지면?`,
  (k: string) => `${k} — 흔한 오해는?`,
]

function topic(question: string): string {
  return question.replace(/\?$/, '').split(/\s+/).slice(0, 2).join(' ')
}

function generateResponse(prompt: string) {
  const question = field(prompt, '질문') || '질문'
  const scope = field(prompt, '의미 범위') || 'generic'

  const body = [
    `**개발용 예시 해설이다.** \`GOOGLE_GENERATIVE_AI_API_KEY\`가 없어 실제 모델 대신 스텁이 답했다. 내용은 검증되지 않았다.`,
    `질문은 "${question}"이고 의미 범위는 \`${scope}\`다. 실제 해설은 결론을 먼저 말하고 근거를 뒤에 붙인다.`,
    `두 번째 문단에서는 왜 그런지를 단계로 나눠 설명한다. 각 단계가 어디서 비용을 만드는지 짚는다.`,
    `세 번째 문단에서는 면접에서 한 단계 더 들어오는 지점을 짚는다. 트레이드오프가 있으면 양면을 함께 말한다.`,
    `아래 꼬리질문을 눌러 더 파고들 수 있다. 같은 질문을 다시 물으면 캐시에 걸려 새로 생성하지 않는다.`,
  ].join('\n\n')

  const key = topic(question)
  return {
    body,
    suggestions: SUGGESTION_FRAMES.map((f) => ({ text: f(key) })),
  }
}

export const stubCaller: StructuredCaller = async <T>({
  model,
  prompt,
}: {
  model: string
  prompt: string
}): Promise<T> => {
  if (model === MODEL_GATE) return gateResponse(prompt) as T
  if (model === MODEL_GENERATE) return generateResponse(prompt) as T

  // 모르는 모델에 그럴듯한 껍데기를 돌려주면 호출부가 조용히 잘못된 값을 쓴다.
  throw new Error(`dev stub has no response shape for model: ${model}`)
}
