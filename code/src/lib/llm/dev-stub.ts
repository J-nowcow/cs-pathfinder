import {
  MODEL_GATE,
  MODEL_GENERATE,
  MODEL_DAILY,
  MODEL_CHAT,
  MODEL_PERSONALIZE,
  type StructuredCaller,
} from '@/lib/llm/client'

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

/**
 * 후보 목록을 프롬프트에서 다시 읽는다.
 *
 * 게이트가 "- id: 질문" 형태로 넣으므로 같은 형태로 되판다.
 */
function parseCandidates(prompt: string): Array<{ id: string; question: string }> {
  const out: Array<{ id: string; question: string }> = []
  for (const line of prompt.split('\n')) {
    const m = line.match(/^- ([0-9a-fA-F-]{8,}): (.+)$/)
    if (m) out.push({ id: m[1], question: m[2].trim() })
  }
  return out
}

/**
 * 스텁의 매칭 규칙.
 *
 * 실제 게이트는 의미로 판단하지만 스텁은 그럴 수 없다. 정규화한 문장이
 * 정확히 같을 때만 고른다. 화면에서 "같은 질문을 다시 물으면 재생성 안 된다"를
 * 재현하는 데는 이걸로 충분하고, 애매하면 안 고른다는 원칙과도 방향이 같다.
 */
function gateResponse(prompt: string) {
  const rawInput = field(prompt, '사용자 입력')
  const lower = rawInput.toLowerCase()

  if (REJECT_HINTS.some((h) => lower.includes(h))) {
    return {
      relevant: false,
      // 이 문장은 배너에 그대로 나간다. 화면 카피 톤에 맞춘다.
      reason: 'CS 학습이랑 관련 없는 요청 같아요.',
      matched_id: '',
      identity_scope: 'generic',
      normalized_question: '',
    }
  }

  const normalized = normalizeQuestion(rawInput)
  const hit = parseCandidates(prompt).find(
    (c) => c.question.trim().toLowerCase() === normalized.toLowerCase(),
  )

  if (hit) {
    return {
      relevant: true,
      reason: '',
      matched_id: hit.id,
      identity_scope: '',
      normalized_question: '',
    }
  }

  return {
    relevant: true,
    reason: '',
    matched_id: '',
    identity_scope: pickScope(`${rawInput} ${field(prompt, '부모 질문')}`),
    normalized_question: normalized,
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

/**
 * 매일 발행용 응답.
 *
 * 주제어 하나에서 루트 질문·해설·꼬리 5개를 만든다. 키 없이도 발행 경로를
 * 끝까지 돌려볼 수 있어야 워크플로와 화면을 검증할 수 있다.
 */
function dailyResponse(prompt: string) {
  const term = field(prompt, '주제어') || '주제'
  const category = field(prompt, '대분류') || '기타'
  const question = `${term}를 실무에서 쓸 때 무엇을 먼저 따져야 하는가?`

  return {
    question,
    identity_scope: pickScope(`${term} ${category}`),
    body: [
      `**개발용 예시 해설이다.** \`GOOGLE_GENERATIVE_AI_API_KEY\`가 없어 실제 모델 대신 스텁이 답했다. 내용은 검증되지 않았다.`,
      `오늘의 주제어는 "${term}"이고 대분류는 ${category}다. 실제 해설은 결론을 먼저 말하고 근거를 뒤에 붙인다.`,
      `두 번째 문단에서는 이 개념이 어디서 비용이나 제약을 만드는지 단계로 나눠 설명한다.`,
      `세 번째 문단에서는 면접에서 한 단계 더 들어오는 지점을 짚는다. 트레이드오프가 있으면 양면을 함께 말한다.`,
    ].join('\n\n'),
    summary: `${term}를 고를 때의 판단 기준을 짚는다.`,
    suggestions: SUGGESTION_FRAMES.map((f) => ({ text: f(term) })),
  }
}

/**
 * 노드 챗 응답. 결정론 — 같은 질문이면 같은 답이라 화면 검증이 재현된다.
 * 프롬프트의 [질문]을 되읽어 답에 박는다. 무엇이 전달됐는지 화면에서 보인다.
 */
function chatResponse(prompt: string): { answer: string } {
  const m = prompt.match(/\[질문\]\n([\s\S]*)$/)
  const asked = m ? m[1].trim() : ''
  return {
    answer: `(개발 스텁) "${asked}"에 대한 답입니다. 실제 배포에서는 이 자리에서 해설 범위 안의 설명이 옵니다.`,
  }
}

function resumeResponse() {
  return {
    questions: [
      { text: '캐시 무효화 시점은 어떻게 정했는가?', basis: '캐시로 응답 지연을 줄인 경험', topic: '캐시' },
      { text: '동시 요청의 정합성은 어떻게 지켰는가?', basis: '동시 요청을 처리하는 서버를 구현한 경험', topic: '동시성' },
      { text: '장애 전파 범위는 어떻게 줄였는가?', basis: '외부 시스템 장애에 대응한 경험', topic: '장애 격리' },
      { text: '성능 개선은 어떤 지표로 확인했는가?', basis: '처리 성능을 측정하고 개선한 경험', topic: '성능 측정' },
      { text: '트래픽이 늘면 어디가 먼저 막히는가?', basis: '요청량 증가를 고려해 시스템을 설계한 경험', topic: '확장성' },
    ],
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
  if (model === MODEL_DAILY) return dailyResponse(prompt) as T
  if (model === MODEL_CHAT) return chatResponse(prompt) as T
  if (model === MODEL_PERSONALIZE) return resumeResponse() as T

  // 모르는 모델에 그럴듯한 껍데기를 돌려주면 호출부가 조용히 잘못된 값을 쓴다.
  throw new Error(`dev stub has no response shape for model: ${model}`)
}
