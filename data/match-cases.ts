/**
 * 매칭 게이트 정확도 측정 세트.
 *
 * 스펙 §12가 정한 기준이 비대칭이다.
 *
 * - **precision은 완벽해야 한다.** 게이트가 "이건 이미 있는 그 질문이다"라고
 *   잘못 고르면 사용자는 자기가 묻지 않은 해설을 받는다. 그리고 그 오답이
 *   캐시에 남아 다음 사람에게도 간다. 되돌릴 방법이 화면에 없다.
 * - **recall은 90%면 된다.** 못 찾으면 같은 뜻의 노드가 하나 더 생긴다.
 *   비용이 한 번 더 나가고 그래프가 조금 지저분해질 뿐, 사용자가 받는 답은 맞다.
 *
 * 그래서 게이트 프롬프트가 "애매하면 고르지 않는다"로 서 있다. 이 세트는
 * 그 원칙이 실제로 지켜지는지, 그리고 그 대가로 recall이 얼마나 깎이는지를 잰다.
 *
 * 함정(expect NEW)이 세트의 절반 가까이인 것은 의도다. 매칭 케이스만 넣으면
 * "전부 고르는" 게이트가 만점을 받는다. 그건 최악의 게이트다.
 */
export type MatchExpectation =
  | { kind: 'match'; candidateId: string }
  /** 후보 중에 답이 같아질 질문이 없다. 새로 만들어야 한다 */
  | { kind: 'new' }
  /** CS 학습 질문이 아니다 */
  | { kind: 'reject' }

export type MatchCase = {
  id: string
  input: string
  expect: MatchExpectation
  /** 왜 그렇게 기대하는지. 판정이 갈릴 때 사람이 읽고 다투는 자리다 */
  note?: string
}

export type MatchCluster = {
  id: string
  parentQuestion: string
  candidates: Array<{ id: string; question: string }>
  cases: MatchCase[]
}

/**
 * 후보 id를 사람이 읽을 수 있게 둔다.
 *
 * 실제 게이트는 UUID를 받지만, 측정 세트에서 UUID를 쓰면 어느 후보가 왜
 * 틀렸는지 눈으로 못 쫓는다. 게이트는 id 문자열의 모양을 보지 않는다.
 */
export const MATCH_CLUSTERS: MatchCluster[] = [
  {
    id: 'pool',
    parentQuestion: 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?',
    candidates: [
      { id: 'pool-size', question: '커넥션 풀 크기는 어떤 기준으로 정하는가?' },
      { id: 'handshake', question: 'TCP 3-way handshake는 어떤 과정인가?' },
      { id: 'leak', question: '커넥션 leak은 어떻게 감지하는가?' },
      { id: 'exhaust', question: '커넥션 풀이 고갈되면 어떤 증상이 나타나는가?' },
    ],
    cases: [
      { id: 'pool-1', input: '왜 코어 수 기반?', expect: { kind: 'match', candidateId: 'pool-size' } },
      { id: 'pool-2', input: '풀 크기 얼마로 잡아야 하나요', expect: { kind: 'match', candidateId: 'pool-size' } },
      { id: 'pool-3', input: 'pool size 정하는 근거가 뭔가요', expect: { kind: 'match', candidateId: 'pool-size' } },
      { id: 'pool-4', input: '핸드셰이크가 뭔데요', expect: { kind: 'match', candidateId: 'handshake' } },
      { id: 'pool-5', input: '커넥션이 안 반납되면 어떻게 알아채나요', expect: { kind: 'match', candidateId: 'leak' } },
      { id: 'pool-6', input: '풀이 다 차면 무슨 일이 생기나요', expect: { kind: 'match', candidateId: 'exhaust' } },
      {
        id: 'pool-t1',
        input: 'ORM은 커넥션을 언제 반납하나요?',
        expect: { kind: 'new' },
        note: 'leak은 새는 것을 감지하는 얘기고 이건 정상 반납 시점이다. 어휘만 겹친다',
      },
      {
        id: 'pool-t2',
        input: '커넥션 풀 대신 쓸 수 있는 방식이 있나요?',
        expect: { kind: 'new' },
        note: '풀을 어떻게 쓰느냐가 아니라 안 쓰는 선택지를 묻는다',
      },
      { id: 'pool-r1', input: '이거 영어로 번역해줘', expect: { kind: 'reject' } },
    ],
  },

  {
    id: 'index',
    parentQuestion: '인덱스를 만들었는데 실행 계획에서 타지 않는 이유는?',
    candidates: [
      { id: 'leading', question: '복합 인덱스에서 선행 컬럼 규칙은 무엇인가?' },
      { id: 'fullscan', question: '옵티마이저가 풀 스캔을 고르는 기준은 무엇인가?' },
      { id: 'function', question: '컬럼에 함수를 씌우면 인덱스가 왜 안 걸리는가?' },
      { id: 'covering', question: '커버링 인덱스는 무엇을 줄이는가?' },
    ],
    cases: [
      { id: 'idx-1', input: '복합 인덱스는 왜 첫 컬럼이 중요한가요', expect: { kind: 'match', candidateId: 'leading' } },
      { id: 'idx-2', input: '앞 컬럼 안 쓰면 인덱스 못 타나요', expect: { kind: 'match', candidateId: 'leading' } },
      { id: 'idx-3', input: '옵티마이저가 왜 풀스캔을 고르죠', expect: { kind: 'match', candidateId: 'fullscan' } },
      { id: 'idx-4', input: 'WHERE에 함수 쓰면 인덱스 안 타는 이유', expect: { kind: 'match', candidateId: 'function' } },
      { id: 'idx-5', input: 'upper() 감싸면 왜 인덱스가 무시되나요', expect: { kind: 'match', candidateId: 'function' } },
      { id: 'idx-6', input: '커버링 인덱스 쓰면 뭐가 좋아지나요', expect: { kind: 'match', candidateId: 'covering' } },
      {
        id: 'idx-t1',
        input: '인덱스를 많이 만들면 쓰기 성능은 어떻게 되나요?',
        expect: { kind: 'new' },
        note: '읽기에서 안 타는 이유가 아니라 쓰기 비용이다',
      },
      {
        id: 'idx-t2',
        input: '인덱스 통계는 언제 갱신되나요?',
        expect: { kind: 'new' },
        note: 'fullscan 후보와 인접하지만 판단 기준이 아니라 갱신 시점을 묻는다',
      },
    ],
  },

  {
    id: 'timewait',
    parentQuestion: 'TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?',
    candidates: [
      { id: 'pileup', question: 'TIME_WAIT이 쌓이면 어떤 장애가 생기는가?' },
      { id: 'closewait', question: 'CLOSE_WAIT이 많다는 것은 무엇을 뜻하는가?' },
      { id: 'reuseaddr', question: 'SO_REUSEADDR는 무엇을 허용하는가?' },
      { id: 'fourway', question: '4-way handshake의 각 단계는 무엇인가?' },
    ],
    cases: [
      { id: 'tw-1', input: 'TIME_WAIT 많으면 뭐가 문제죠', expect: { kind: 'match', candidateId: 'pileup' } },
      { id: 'tw-2', input: '포트 고갈이 이것 때문인가요', expect: { kind: 'match', candidateId: 'pileup' } },
      { id: 'tw-3', input: 'CLOSE_WAIT이 쌓이면 누구 문제인가요', expect: { kind: 'match', candidateId: 'closewait' } },
      { id: 'tw-4', input: 'SO_REUSEADDR 켜면 뭐가 되나요', expect: { kind: 'match', candidateId: 'reuseaddr' } },
      { id: 'tw-5', input: '연결 끊는 절차가 어떻게 되나요', expect: { kind: 'match', candidateId: 'fourway' } },
      {
        id: 'tw-t1',
        input: 'UDP에는 왜 이런 종료 절차가 없나요?',
        expect: { kind: 'new' },
        note: '4-way를 언급하지만 묻는 것은 UDP의 설계다',
      },
      {
        id: 'tw-t2',
        input: 'TIME_WAIT 시간을 줄여도 안전한가요?',
        expect: { kind: 'new' },
        note: 'pileup은 증상이고 이건 완화책의 안전성이다',
      },
    ],
  },

  {
    id: 'gc',
    parentQuestion: 'JVM에서 Stop-the-world가 길어지면 무엇을 먼저 보는가?',
    candidates: [
      { id: 'collectors', question: 'G1과 CMS는 무엇이 다른가?' },
      { id: 'heapsize', question: '힙 크기를 키우면 GC 시간은 어떻게 되는가?' },
      { id: 'oldgen', question: 'Old 영역이 빠르게 차는 원인은 무엇인가?' },
      { id: 'gclog', question: 'GC 로그에서 무엇을 읽어야 하는가?' },
    ],
    cases: [
      { id: 'gc-1', input: 'G1이랑 CMS 차이가 뭐예요', expect: { kind: 'match', candidateId: 'collectors' } },
      { id: 'gc-2', input: '힙 늘리면 GC가 더 오래 걸리나요', expect: { kind: 'match', candidateId: 'heapsize' } },
      { id: 'gc-3', input: 'Old gen이 금방 차는 이유', expect: { kind: 'match', candidateId: 'oldgen' } },
      { id: 'gc-4', input: 'GC 로그 어디를 봐야 하나요', expect: { kind: 'match', candidateId: 'gclog' } },
      {
        id: 'gc-t1',
        input: '메모리 누수와 GC 문제를 어떻게 구분하나요?',
        expect: { kind: 'new' },
        note: 'oldgen이 차는 원인 하나가 누수지만, 이건 두 원인을 가르는 진단법이다',
      },
      {
        id: 'gc-t2',
        input: 'JVM 말고 다른 런타임의 GC는 어떻게 다른가요?',
        expect: { kind: 'new' },
      },
      { id: 'gc-r1', input: '오늘 점심 뭐 먹을지 골라줘', expect: { kind: 'reject' } },
    ],
  },

  {
    id: 'effect',
    parentQuestion: 'useEffect 의존성 배열을 잘못 넣으면 어떤 문제가 생기는가?',
    candidates: [
      { id: 'empty', question: '의존성 배열을 비우면 어떤 일이 생기는가?' },
      { id: 'callback', question: 'useCallback은 언제 쓰는 것이 맞는가?' },
      { id: 'cleanup', question: 'cleanup 함수는 언제 실행되는가?' },
      { id: 'infinite', question: '무한 렌더링은 왜 발생하는가?' },
    ],
    cases: [
      { id: 'ef-1', input: '빈 배열 넣으면 어떻게 되나요', expect: { kind: 'match', candidateId: 'empty' } },
      { id: 'ef-2', input: '[] 로 두면 한 번만 도나요', expect: { kind: 'match', candidateId: 'empty' } },
      { id: 'ef-3', input: 'useCallback 언제 써야 하죠', expect: { kind: 'match', candidateId: 'callback' } },
      { id: 'ef-4', input: 'cleanup은 언제 불리나요', expect: { kind: 'match', candidateId: 'cleanup' } },
      { id: 'ef-5', input: '왜 계속 리렌더링이 되죠', expect: { kind: 'match', candidateId: 'infinite' } },
      {
        id: 'ef-t1',
        input: 'useLayoutEffect는 언제 쓰나요?',
        expect: { kind: 'new' },
        note: '다른 훅이다. useEffect 후보들과 어휘가 겹칠 뿐',
      },
      {
        id: 'ef-t2',
        input: '클래스 컴포넌트에서는 이걸 어떻게 했나요?',
        expect: { kind: 'new' },
      },
    ],
  },

  {
    id: 'jwt',
    parentQuestion: 'JWT를 세션 대신 쓸 때 무엇을 잃는가?',
    candidates: [
      { id: 'revoke', question: '발급된 토큰을 즉시 무효화하려면 어떻게 해야 하는가?' },
      { id: 'refresh', question: 'Refresh token은 어디에 저장해야 하는가?' },
      { id: 'signature', question: 'JWT의 서명은 무엇을 보장하는가?' },
      { id: 'expiry', question: '토큰 만료 시간은 무엇을 기준으로 정하는가?' },
    ],
    cases: [
      { id: 'jwt-1', input: '로그아웃 시켰는데 토큰이 계속 먹히면요', expect: { kind: 'match', candidateId: 'revoke' } },
      { id: 'jwt-2', input: '탈취된 토큰 바로 죽일 수 있나요', expect: { kind: 'match', candidateId: 'revoke' } },
      { id: 'jwt-3', input: 'refresh 토큰 어디 두는 게 안전한가요', expect: { kind: 'match', candidateId: 'refresh' } },
      { id: 'jwt-4', input: '서명이 붙으면 내용도 못 보나요', expect: { kind: 'match', candidateId: 'signature' } },
      { id: 'jwt-5', input: '만료 시간 얼마로 잡나요', expect: { kind: 'match', candidateId: 'expiry' } },
      {
        id: 'jwt-t1',
        input: 'JWT를 쿠키에 담으면 CSRF는 어떻게 되나요?',
        expect: { kind: 'new' },
        note: 'refresh 저장 위치와 인접하지만 묻는 것은 CSRF 노출이다',
      },
      {
        id: 'jwt-t2',
        input: '세션 방식은 서버를 늘릴 때 무엇이 문제인가요?',
        expect: { kind: 'new' },
        note: '부모가 JWT와 세션을 견주지만 후보에 세션 확장 얘기는 없다',
      },
      { id: 'jwt-r1', input: '이 로그인 코드 대신 짜줘', expect: { kind: 'reject' } },
    ],
  },
]

export const MATCH_CASES = MATCH_CLUSTERS.flatMap((c) =>
  c.cases.map((k) => ({ cluster: c, case: k })),
)
