/**
 * 해설을 읽기 전에 내는 진단 문제.
 *
 * **런타임에 만들지 않는다.** 해설이 고정된 자산인데 매번 LLM을 부를 이유가
 * 없다. `authored-nodes.ts`와 같은 방식으로 손으로 써서 커밋한다 — 비용이
 * 0이고, git에서 리뷰되고, `npm run verify:quiz`가 형식을 검사한다.
 *
 * **본문에 없는 사실을 쓰지 않는다.** 문제도 근거도 전부 그 노드 body에서
 * 나와야 한다. 새 사실을 끌어오면 해설을 읽고도 못 푸는 문제가 된다.
 *
 * 노드는 `(identityScope, question)`으로 참조한다. `bootstrap.ts`의
 * `rootNodeId()`가 uuid를 파생하는 바로 그 키다. 여기서 uuid를 직접 들면
 * 질문 문장을 고칠 때 조용히 끊긴다.
 *
 * 설계: `docs/design/2026-08-29-quiz.md`
 */

export type QuizKind =
  /** 핵심 결론을 아는가. 틀리면 이 주제를 처음 본 것이다 */
  | 'concept'
  /** 흔한 오해에 빠지지 않는가. 틀리면 얕게 아는 것이다 */
  | 'misconception'
  /** 조건·예외를 아는가. 틀리면 안다고 생각하며 단정하는 것이다 */
  | 'boundary'

export type QuizChoice = {
  text: string
  /** 정답 하나에만 붙인다. 나머지는 생략한다 */
  correct?: boolean
  /**
   * 이 오답을 고른 사람에게 맨 위로 올려줄 `suggestions` 인덱스 (0~4).
   *
   * 새 질문을 만들지 않는다 — 이미 있는 꼬리질문의 순서만 바꾼다.
   * 정답에는 붙이지 않는다. 맞힌 사람을 보낼 이유가 없다.
   */
  leadsTo?: number
}

export type QuizItem = {
  kind: QuizKind
  stem: string
  choices: QuizChoice[]
  /** 정답 공개 시 한 문장. 근거가 본문에 있어야 한다 */
  rationale: string
}

export type NodeQuiz = {
  identityScope: string
  question: string
  /** 세 문제. kind가 서로 달라야 한다 */
  items: QuizItem[]
}

export const NODE_QUIZZES: NodeQuiz[] = [
  {
    identityScope: 'postgres',
    question: 'DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '커넥션 하나를 새로 맺을 때 실제로 일어나는 일은?',
        choices: [
          { text: '커넥션 객체를 메모리에 하나 만든다', leadsTo: 0 },
          { text: 'TCP 연결·인증·세션 준비를 차례로 밟는다', correct: true },
          { text: 'DB가 미리 만들어 둔 것을 꺼내 준다', leadsTo: 1 },
          { text: '질의 계획을 미리 컴파일해 둔다', leadsTo: 0 },
        ],
        rationale:
          '객체 하나를 만드는 일이 아니다. TCP 3-way handshake, 인증 정보 확인, 세션 자원 할당이 단계마다 왕복을 끼고 일어난다.',
      },
      {
        kind: 'misconception',
        stem: 'connection pool이 하는 일 중 더 중요한 쪽은?',
        choices: [
          { text: '커넥션을 재사용해 생성 비용을 없앤다', leadsTo: 2 },
          { text: '끊긴 커넥션을 자동으로 되살린다', leadsTo: 3 },
          { text: '질의 결과를 캐시해 왕복을 줄인다', leadsTo: 1 },
          { text: 'DB로 나가는 커넥션 수에 상한을 둔다', correct: true },
        ],
        rationale:
          '재사용은 눈에 띄는 쪽이고, 상한이 더 중요하다. 상한이 없으면 동시 요청이 몰릴 때 DB가 질의 대신 커넥션 생성과 해제에 자원을 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '풀 크기를 크게 잡으면 생기는 일은?',
        choices: [
          { text: 'DB 자원을 과점유한다', correct: true },
          { text: '처리량이 코어 수에 비례해 늘어난다', leadsTo: 1 },
          { text: '애플리케이션 쪽 대기가 늘어난다', leadsTo: 2 },
          { text: 'connection leak이 자동으로 회수된다', leadsTo: 3 },
        ],
        rationale:
          '크게 잡으면 DB 자원을 과점유하고 작게 잡으면 애플리케이션 대기가 늘어난다. 양면을 함께 말할 수 있어야 한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '분산 트랜잭션에서 Saga 패턴이 필요한 이유는?',
    items: [
      {
        kind: 'concept',
        stem: 'Saga가 필요해지는 조건은?',
        choices: [
          { text: '서비스마다 DB가 분리돼 하나로 묶을 수 없다', correct: true },
          { text: '트랜잭션이 너무 오래 걸린다', leadsTo: 1 },
          { text: '동시 접속자가 많아 잠금 경합이 심하다', leadsTo: 1 },
          { text: '네트워크가 자주 끊긴다', leadsTo: 4 },
        ],
        rationale:
          'DB가 나뉘면 롤백을 DB에 맡길 수 없다. 그래서 애플리케이션이 앞 단계를 직접 되돌린다.',
      },
      {
        kind: 'misconception',
        stem: '2PC 대신 Saga를 쓰면 얻는 것은?',
        choices: [
          { text: '원자성을 그대로 보장받는다', leadsTo: 3 },
          { text: '중간 상태가 외부에 안 보인다', leadsTo: 3 },
          { text: '보상 로직을 안 짜도 된다', leadsTo: 0 },
          { text: '가용성이 높아진다', correct: true },
        ],
        rationale:
          '각 단계가 자기 DB에서 즉시 커밋하므로 잠금을 들고 기다리지 않는다. 2PC는 모든 참여자가 준비를 마칠 때까지 자원을 잠근다.',
      },
      {
        kind: 'boundary',
        stem: 'Saga가 치르는 대가는?',
        choices: [
          { text: '격리성을 포기한다', correct: true },
          { text: '지속성을 포기한다', leadsTo: 3 },
          { text: '조정자가 단일 장애점이 된다', leadsTo: 2 },
          { text: '단계 수가 늘수록 잠금 시간이 길어진다', leadsTo: 1 },
        ],
        rationale:
          '중간 상태가 외부에 보인다. 결제는 됐는데 배송 생성이 실패한 순간이 잠깐 존재한다.',
      },
    ],
  },
  {
    identityScope: 'tcp',
    question: 'TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?',
    items: [
      {
        kind: 'concept',
        stem: 'TIME_WAIT이 없으면 무엇이 깨지는가?',
        choices: [
          { text: '마지막 ACK이 유실됐을 때 재전송을 받아줄 쪽이 없다', correct: true },
          { text: '연결이 절반만 닫힌 채로 남는다', leadsTo: 4 },
          { text: '수신 버퍼에 남은 데이터가 사라진다', leadsTo: 0 },
          { text: '포트 번호가 순서대로 재사용되지 않는다', leadsTo: 2 },
        ],
        rationale:
          '먼저 닫는 쪽이 잠시 남아 있어야 상대의 FIN 재전송을 받아준다. 소켓이 이미 사라졌다면 상대는 정상 종료하지 못한다.',
      },
      {
        kind: 'misconception',
        stem: 'TIME_WAIT이 많이 쌓인 서버에서 가장 먼저 할 일은?',
        choices: [
          { text: 'SO_REUSEADDR을 켠다', leadsTo: 3 },
          { text: '커널의 대기 시간 설정을 줄인다', leadsTo: 3 },
          { text: 'CLOSE_WAIT 수부터 줄인다', leadsTo: 4 },
          { text: '누가 먼저 연결을 닫는지 확인한다', correct: true },
        ],
        rationale:
          '설정을 만지기 전에 원인을 본다. 짧은 연결을 반복해 맺는 것이 원인이면 keep-alive와 연결 풀이 먼저다.',
      },
      {
        kind: 'boundary',
        stem: 'TIME_WAIT 소켓이 많다는 사실 자체가 뜻하는 것은?',
        choices: [
          { text: '이미 장애 상태다', leadsTo: 2 },
          { text: '상대가 FIN을 안 보내고 있다', leadsTo: 4 },
          { text: '그 호스트가 능동 종료를 많이 했다는 신호다', correct: true },
          { text: '커널 파라미터가 잘못돼 있다', leadsTo: 3 },
        ],
        rationale:
          '그 자체로 장애는 아니다. 실제 문제는 로컬 임시 포트나 연결 추적 자원이 모자랄 때 생긴다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '컨텍스트 스위칭 비용은 구체적으로 어디서 발생하는가?',
    items: [
      {
        kind: 'concept',
        stem: '컨텍스트 스위칭 비용의 본체는 어느 쪽인가?',
        choices: [
          { text: '캐시가 밀려나고 TLB를 다시 채우는 간접 비용', correct: true },
          { text: '레지스터와 PC를 저장·복원하는 직접 비용', leadsTo: 1 },
          { text: '커널 모드로 전환하는 비용', leadsTo: 1 },
          { text: '스케줄러가 다음 스레드를 고르는 비용', leadsTo: 3 },
        ],
        rationale:
          '직접 비용은 수 마이크로초 수준이다. 쌓아둔 캐시가 밀려나 다시 실행될 때 캐시 미스가 연달아 나는 쪽이 본체다.',
      },
      {
        kind: 'misconception',
        stem: '전환이 일어날 때 캐시는 어떻게 되는가?',
        choices: [
          { text: '통째로 비운다', leadsTo: 0 },
          { text: '새 작업이 데이터를 올리면서 앞 것이 밀려난다', correct: true },
          { text: '그대로 유지되고 영향받지 않는다', leadsTo: 4 },
          { text: '프로세스마다 별도 영역이 있어 섞이지 않는다', leadsTo: 0 },
        ],
        rationale:
          '전환할 때 캐시를 통째로 비우는 것이 아니다. 새 작업이 데이터를 올리면서 밀려나는 것이라, 앞 작업이 다시 실행될 때 미스가 연달아 난다.',
      },
      {
        kind: 'boundary',
        stem: 'I/O 바운드 작업은 스레드를 코어 수보다 늘려도 되는 이유는?',
        choices: [
          { text: 'I/O는 컨텍스트 스위칭을 일으키지 않는다', leadsTo: 3 },
          { text: '대기 중인 스레드는 CPU를 점유하지 않는다', correct: true },
          { text: '커널이 I/O 스레드를 따로 스케줄링한다', leadsTo: 1 },
          { text: 'TLB를 비우지 않아도 되기 때문이다', leadsTo: 0 },
        ],
        rationale:
          'CPU 바운드는 코어 수를 넘으면 실행이 아니라 전환에 시간을 쓴다. 대기하는 스레드는 그렇지 않다.',
      },
    ],
  },
  {
    identityScope: 'postgres',
    question: '인덱스를 만들었는데 실행 계획에서 타지 않는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '원인을 가르는 첫 갈래는?',
        choices: [
          { text: '인덱스가 있느냐 없느냐', leadsTo: 0 },
          { text: '단일 인덱스냐 복합 인덱스냐', leadsTo: 0 },
          { text: '읽기 질의냐 쓰기 질의냐', leadsTo: 4 },
          { text: '쓸 수 없는 경우와 쓰지 않기로 한 경우', correct: true },
        ],
        rationale:
          '실행 계획에서 후보에도 안 오르면 쓸 수 없는 경우이고, 후보에 있는데 안 고르면 통계나 비용 추정 문제다.',
      },
      {
        kind: 'misconception',
        stem: '인덱스 컬럼에 함수를 씌운 조건은 어떻게 되는가?',
        choices: [
          { text: '느려지지만 인덱스는 그대로 탄다', leadsTo: 2 },
          { text: '옵티마이저가 알아서 풀어 준다', leadsTo: 2 },
          { text: '인덱스가 무력해진다', correct: true },
          { text: '통계를 갱신하면 다시 탄다', leadsTo: 3 },
        ],
        rationale:
          '저장된 값과 비교 대상이 달라진다. 날짜 컬럼의 포맷 함수가 대표적이고, 범위 비교로 바꾸면 살아난다.',
      },
      {
        kind: 'boundary',
        stem: '조회 대상이 테이블 전체의 상당 비율일 때는?',
        choices: [
          { text: '인덱스를 타는 편이 항상 빠르다', leadsTo: 1 },
          { text: '커버링 인덱스만이 답이다', leadsTo: 4 },
          { text: '복합 인덱스로 바꾸면 해결된다', leadsTo: 0 },
          { text: '풀 스캔이 더 빠를 수 있다', correct: true },
        ],
        rationale:
          '인덱스로 한 건씩 찾아가는 비용이 커진다. 옵티마이저는 카디널리티 추정으로 판단하는데 통계가 낡으면 이 추정이 틀린다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HTTP/2는 HTTP/1.1의 무엇을 고쳤는가?',
    items: [
      {
        kind: 'concept',
        stem: 'HTTP/1.1에서 여러 요청을 미리 보내도 남던 제약은?',
        choices: [
          { text: '한 연결에 요청을 하나만 실을 수 있다', leadsTo: 2 },
          { text: '응답을 요청 순서대로 내보내야 한다', correct: true },
          { text: '헤더를 압축할 수 없다', leadsTo: 0 },
          { text: '연결을 재사용할 수 없다', leadsTo: 4 },
        ],
        rationale:
          '파이프라이닝으로 연달아 보낼 수는 있었다. 서버가 응답 순서를 지켜야 해서 브라우저가 여러 연결을 열어 병렬성을 얻었다.',
      },
      {
        kind: 'misconception',
        stem: 'HTTP/2로 바꾸면 줄서기가 완전히 사라지는가?',
        choices: [
          { text: '사라진다. 스트림이 독립적이다', leadsTo: 3 },
          { text: 'TCP 계층의 줄서기는 남는다', correct: true },
          { text: '헤더 압축 때문에 오히려 늘어난다', leadsTo: 0 },
          { text: '서버 푸시를 켜야 사라진다', leadsTo: 1 },
        ],
        rationale:
          '패킷 하나가 유실되면 그 연결의 모든 스트림이 재전송을 기다린다. HTTP/3가 전송을 QUIC으로 바꾼 이유가 이것이다.',
      },
      {
        kind: 'boundary',
        stem: 'HTTP/1.1 시절의 우회책을 HTTP/2에서 그대로 쓰면?',
        choices: [
          { text: '그대로 이득이 유지된다', leadsTo: 4 },
          { text: '서버 푸시가 자동으로 대신한다', leadsTo: 1 },
          { text: '동작하지 않아 오류가 난다', leadsTo: 3 },
          { text: '오히려 비용이 될 수 있다', correct: true },
        ],
        rationale:
          '도메인을 쪼개면 연결 재사용과 헤더 압축 범위가 나뉜다. 스프라이트는 한 조각만 바뀌어도 전체를 다시 받게 만든다.',
      },
    ],
  },
  {
    identityScope: 'dns',
    question: 'DNS 조회는 어떤 순서로 도는가?',
    items: [
      {
        kind: 'concept',
        stem: '루트 네임서버가 리졸버에게 주는 것은?',
        choices: [
          { text: '최종 IP 주소', leadsTo: 1 },
          { text: '도메인 전체 목록', leadsTo: 1 },
          { text: '캐시에 저장된 이전 응답', leadsTo: 0 },
          { text: '다음에 물어볼 곳의 주소', correct: true },
        ],
        rationale:
          '한 번에 답을 주는 것이 아니라 다음에 물을 곳을 알려준다. 루트가 모든 도메인을 알 필요가 없어서 이 구조가 버틴다.',
      },
      {
        kind: 'misconception',
        stem: '기존 53번 포트 DNS의 전송 프로토콜은?',
        choices: [
          { text: 'UDP로 시작하는 경우가 많지만 TCP도 지원해야 한다', correct: true },
          { text: 'UDP 하나로 고정돼 있다', leadsTo: 2 },
          { text: 'TCP만 쓴다', leadsTo: 2 },
          { text: '암호화하면 위임 계층이 바뀐다', leadsTo: 4 },
        ],
        rationale:
          '작은 질의를 UDP로 시작하는 경우가 많지만 TCP도 지원해야 한다. 잘린 응답을 TCP로 다시 묻는 것이 한 예다.',
      },
      {
        kind: 'boundary',
        stem: '서버를 옮기기 전에 미리 해둘 일은?',
        choices: [
          { text: '전 세계 캐시를 즉시 지운다', leadsTo: 0 },
          { text: '옮긴 뒤에 TTL을 낮춘다', leadsTo: 0 },
          { text: 'TTL을 미리 낮춰둔다', correct: true },
          { text: 'CNAME으로 바꿔 즉시 반영시킨다', leadsTo: 3 },
        ],
        rationale:
          '값을 바꿔도 캐시가 만료되기 전까지는 옛 주소로 간다. 그래서 이전을 앞두고 TTL을 미리 낮춰두고 옮긴 뒤에 되돌린다.',
      },
    ],
  },
  {
    identityScope: 'tcp',
    question: '수신자는 여유 있는데 전송이 느린 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '실제 전송량을 정하는 것은?',
        choices: [
          { text: '수신 창만 본다', leadsTo: 3 },
          { text: '혼잡 창만 본다', leadsTo: 4 },
          { text: '두 창 중 작은 값', correct: true },
          { text: '두 창을 더한 값', leadsTo: 0 },
        ],
        rationale:
          '수신 창이 넉넉해도 네트워크가 혼잡하면 송신자는 혼잡 창을 줄인다. 전송량은 둘 중 작은 값으로 제한된다.',
      },
      {
        kind: 'misconception',
        stem: '처리량이 안 나올 때 수신 버퍼를 늘리면?',
        choices: [
          { text: '언제나 그만큼 빨라진다', leadsTo: 0 },
          { text: '혼잡이 원인이면 소용이 없다', correct: true },
          { text: '혼잡 창도 따라서 커진다', leadsTo: 4 },
          { text: '패킷 손실이 줄어든다', leadsTo: 2 },
        ],
        rationale:
          '수신 버퍼만 늘려서는 혼잡 구간이 빨라지지 않는다. 두 창과 왕복 시간, 패킷 손실을 함께 봐야 한다.',
      },
      {
        kind: 'boundary',
        stem: '송신자가 혼잡을 감지하는 신호는?',
        choices: [
          { text: '손실 외에 ECN, 지연·전달률도 쓴다', correct: true },
          { text: '패킷 손실만이 유일한 신호다', leadsTo: 2 },
          { text: '수신 창 크기로 감지한다', leadsTo: 3 },
          { text: '알고리즘과 무관하게 늘 같다', leadsTo: 4 },
        ],
        rationale:
          '송신자는 알고리즘에 따라 손실, ECN, 지연·전달률 같은 신호로 혼잡 창을 조절한다.',
      },
    ],
  },
  {
    identityScope: 'tcp',
    question: '연결 설정 왕복을 언제 줄일 수 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '새 TCP 연결의 세 단계를 줄일 수 있는가?',
        choices: [
          { text: '두 단계로 줄일 수 있다', leadsTo: 1 },
          { text: '생략할 수 없다. 대신 연결을 재사용한다', correct: true },
          { text: '순번 교환을 건너뛰면 된다', leadsTo: 0 },
          { text: 'Fast Open을 켜면 없어진다', leadsTo: 3 },
        ],
        rationale:
          '세 단계는 양쪽의 송수신 가능 여부와 초기 순번을 확인한다. 한 단계를 없애면 지연 패킷을 새 연결로 오인하거나 반쪽 연결이 늘 수 있다.',
      },
      {
        kind: 'misconception',
        stem: 'TCP Fast Open이 실제로 하는 일은?',
        choices: [
          { text: '핸드셰이크를 없앤다', leadsTo: 4 },
          { text: '초기 순번 확인을 생략한다', leadsTo: 0 },
          { text: '첫 연결부터 왕복 없이 보낸다', leadsTo: 3 },
          { text: '핸드셰이크는 그대로 돌고 데이터를 SYN에 싣는다', correct: true },
        ],
        rationale:
          '쿠키가 있는 재접속에서 SYN에 데이터를 실을 수 있다. 핸드셰이크는 계속 진행되며 중간 장비 호환성과 재전송 안전성을 고려해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '지연을 줄이는 가장 일반적인 수단은?',
        choices: [
          { text: '이미 맺은 연결의 재사용', correct: true },
          { text: 'Fast Open 적용', leadsTo: 3 },
          { text: '초기 순번을 고정값으로', leadsTo: 0 },
          { text: 'SYN 쿠키 활성화', leadsTo: 2 },
        ],
        rationale:
          'Keep-Alive와 연결 풀은 이미 맺은 연결을 다시 쓴다. 새 핸드셰이크 자체를 줄이므로 가장 일반적인 지연 절감 수단이다.',
      },
    ],
  },
  {
    identityScope: 'udp',
    question: '신뢰성보다 지연을 우선할 기준은?',
    items: [
      {
        kind: 'concept',
        stem: 'UDP가 맞는 상황은?',
        choices: [
          { text: '순서와 재전송 보장이 필요할 때', leadsTo: 2 },
          { text: '일부 손실을 허용하고 최신 데이터가 더 중요할 때', correct: true },
          { text: '연결 상태를 오래 유지해야 할 때', leadsTo: 3 },
          { text: '무조건 더 빠르므로 언제나', leadsTo: 4 },
        ],
        rationale:
          '음성 통화와 게임은 늦게 도착한 과거 패킷의 가치가 낮다. 재전송을 기다리기보다 손실을 보간하고 다음 데이터를 처리하는 편이 낫다.',
      },
      {
        kind: 'misconception',
        stem: 'UDP를 쓰면 언제나 빠른가?',
        choices: [
          { text: '그렇다. 오버헤드가 없다', leadsTo: 4 },
          { text: '필요한 보장을 직접 구현하면 비용이 돌아온다', correct: true },
          { text: '체크섬이 없어서 항상 빠르다', leadsTo: 0 },
          { text: '혼잡 제어가 없어 언제나 유리하다', leadsTo: 2 },
        ],
        rationale:
          'UDP가 곧 빠름을 뜻하지는 않는다. 혼잡 제어와 인증, 순서 보장이 필요하면 직접 구현하거나 QUIC 같은 검증된 프로토콜을 써야 한다.',
      },
      {
        kind: 'boundary',
        stem: '주고받는 크기가 커지면 무엇이 필요한가?',
        choices: [
          { text: '분할과 재시도 전략을 따로 세워야 한다', correct: true },
          { text: '크기 제한이 없어 그대로 보내면 된다', leadsTo: 1 },
          { text: '자동으로 분할되므로 신경 쓸 것이 없다', leadsTo: 1 },
          { text: 'TCP로 자동 전환된다', leadsTo: 4 },
        ],
        rationale:
          'DNS처럼 요청과 응답이 작고 짧으면 연결 비용을 피할 수 있다. 다만 크기가 커지면 분할과 재시도 전략이 필요하다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '재검증 없이 응답을 써도 되는 기준은?',
    items: [
      {
        kind: 'concept',
        stem: '저장된 응답을 서버에 묻지 않고 바로 쓸 조건은?',
        choices: [
          { text: '같은 사용자가 다시 요청했을 때', leadsTo: 1 },
          { text: '검증자가 붙어 있을 때', leadsTo: 0 },
          { text: 'max-age 안에 있고 재검증 강제 지시자가 없을 때', correct: true },
          { text: '응답 본문이 바뀌지 않았을 때', leadsTo: 3 },
        ],
        rationale:
          '신선한 동안은 즉시 쓴다. 기간이 지나면 보통 검증자를 붙여 바뀌었는지 묻는다.',
      },
      {
        kind: 'misconception',
        stem: 'no-cache가 뜻하는 것은?',
        choices: [
          { text: '저장을 금지한다', leadsTo: 2 },
          { text: '공유 캐시에만 저장한다', leadsTo: 1 },
          { text: '저장은 되지만 쓸 때마다 재검증한다', correct: true },
          { text: '검증자를 무시한다', leadsTo: 3 },
        ],
        rationale:
          'no-cache는 저장 금지가 아니다. 캐시에 보관해도 되지만 사용할 때마다 ETag나 Last-Modified로 확인하라는 뜻이다. 저장을 막는 것은 no-store다.',
      },
      {
        kind: 'boundary',
        stem: '304 Not Modified를 받으면 무엇이 절약되는가?',
        choices: [
          { text: '아무것도 절약되지 않는다', leadsTo: 0 },
          { text: '왕복까지 사라진다', leadsTo: 4 },
          { text: '전송량은 줄지만 왕복은 남는다', correct: true },
          { text: '캐시 키가 갱신된다', leadsTo: 1 },
        ],
        rationale:
          '변경이 없으면 서버는 본문 없이 304 Not Modified를 보낸다. 전송량은 줄지만 네트워크 왕복은 남는다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '실패 응답 코드는 무엇을 기준으로 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: '4xx와 5xx를 가르는 기준은?',
        choices: [
          { text: '응답 본문의 유무', leadsTo: 3 },
          { text: '오류의 심각도', leadsTo: 2 },
          { text: '재시도 횟수', leadsTo: 4 },
          { text: '책임이 요청·권한 쪽인지 서버 처리 쪽인지', correct: true },
        ],
        rationale:
          '요청이나 인증·권한·사용량 제한 같은 클라이언트 측 조건 때문에 처리할 수 없으면 4xx, 서버가 정상 요청을 처리하지 못하면 5xx다.',
      },
      {
        kind: 'misconception',
        stem: '신원은 확인됐지만 권한이 없을 때는?',
        choices: [
          { text: '401을 쓴다', leadsTo: 1 },
          { text: '409를 쓴다', leadsTo: 4 },
          { text: '400을 쓴다', leadsTo: 0 },
          { text: '403을 쓴다', correct: true },
        ],
        rationale:
          '401은 인증이 필요하다는 뜻이고 403은 신원을 알아도 권한이 없다는 뜻이다. 존재를 숨기려면 404를 택할 수도 있다.',
      },
      {
        kind: 'boundary',
        stem: '내부 오류를 200으로 감싸면 생기는 문제는?',
        choices: [
          { text: '클라이언트만 조금 헷갈린다', leadsTo: 4 },
          { text: '중간 장비가 실패를 오해한다', correct: true },
          { text: '재시도가 자동으로 늘어난다', leadsTo: 2 },
          { text: '문제가 없다. 본문으로 알리면 된다', leadsTo: 3 },
        ],
        rationale:
          '원인과 재시도 가능성을 코드에 담아야 한다. 503은 일시적 과부하나 점검을 알리고 Retry-After로 재시도 시점을 안내할 수 있다.',
      },
    ],
  },
  {
    identityScope: 'tls',
    question: '자물쇠 표시는 무엇을 검증한 결과인가?',
    items: [
      {
        kind: 'concept',
        stem: '자물쇠가 확인한 것은?',
        choices: [
          { text: '전송 구간의 압축 여부', leadsTo: 3 },
          { text: '사이트 운영자의 신원과 사업자 등록', leadsTo: 4 },
          { text: '신뢰 사슬·도메인·유효 기간과 서버의 개인 키 소유', correct: true },
          { text: '서버가 최신 소프트웨어를 쓴다는 사실', leadsTo: 0 },
        ],
        rationale:
          '브라우저가 신뢰 사슬과 도메인, 유효 기간을 확인하고 서버가 개인 키를 가졌음을 검증한 결과다.',
      },
      {
        kind: 'misconception',
        stem: '자물쇠가 보장하지 않는 것은?',
        choices: [
          { text: '전송 구간의 암호화', leadsTo: 2 },
          { text: '접속 호스트와 인증서 이름의 일치', leadsTo: 1 },
          { text: '사이트의 신뢰성과 안전한 운영', correct: true },
          { text: '상위 인증서의 서명', leadsTo: 0 },
        ],
        rationale:
          '사이트의 신뢰성이나 안전한 운영까지 보장하지는 않는다. 폐기 조회 실패를 엄격히 막지 않는 구현도 있어 절대적 보증으로 보면 안 된다.',
      },
      {
        kind: 'boundary',
        stem: '발급 대상이 다른 유효한 인증서를 가져오면?',
        choices: [
          { text: '유효 기간이 남아 있으면 통과한다', leadsTo: 0 },
          { text: '도메인 이름 확인 단계에서 막힌다', correct: true },
          { text: '중간 인증서가 있으면 통과한다', leadsTo: 2 },
          { text: '폐기 조회에서만 걸러진다', leadsTo: 3 },
        ],
        rationale:
          '브라우저는 접속 호스트가 SAN의 이름과 맞는지 확인한다. 사슬이 유효해도 이 단계에서 막힌다.',
      },
    ],
  },
  {
    identityScope: 'tls',
    question: '첫 보안 연결에는 왜 왕복이 필요한가?',
    items: [
      {
        kind: 'concept',
        stem: '연결 전에 끝내야 하는 준비는?',
        choices: [
          { text: '압축 방식과 언어 협상', leadsTo: 1 },
          { text: '암호 규칙 합의, 서버 인증, 통신 키 생성', correct: true },
          { text: '세션 티켓 발급', leadsTo: 3 },
          { text: '인증서 폐기 목록 내려받기', leadsTo: 2 },
        ],
        rationale:
          '이 준비가 끝나야 애플리케이션 데이터를 안전하게 보낼 수 있다. 이후 트래픽은 파생된 대칭 키로 암호화한다.',
      },
      {
        kind: 'misconception',
        stem: 'TLS 1.3이 새 연결에서 이룬 것은?',
        choices: [
          { text: '왕복을 완전히 없앴다', leadsTo: 4 },
          { text: '인증서 검증을 생략했다', leadsTo: 0 },
          { text: '일반적인 새 연결을 1-RTT로 줄였다', correct: true },
          { text: '대칭 키를 안 쓰게 됐다', leadsTo: 2 },
        ],
        rationale:
          'TLS 1.3은 키 교환에 필요한 값을 첫 메시지부터 보내 일반적인 새 연결을 1-RTT로 줄였다. 왕복이 사라진 것은 아니다.',
      },
      {
        kind: 'boundary',
        stem: '0-RTT 데이터를 쓸 때 걸어야 할 제한은?',
        choices: [
          { text: '첫 연결에만 쓴다', leadsTo: 3 },
          { text: '멱등한 요청에만 쓴다', correct: true },
          { text: '인증서가 있으면 제한이 없다', leadsTo: 2 },
          { text: '본문 크기만 줄이면 된다', leadsTo: 4 },
        ],
        rationale:
          '세션 재개는 이전 비밀을 사용해 지연을 줄이지만, 0-RTT 데이터는 재전송 공격에 노출될 수 있다.',
      },
    ],
  },
  {
    identityScope: 'proxy',
    question: '중계 서버의 주체는 어떻게 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '포워드와 리버스를 가르는 기준은?',
        choices: [
          { text: '누구를 대리하는가', correct: true },
          { text: '어느 계층에서 동작하는가', leadsTo: 2 },
          { text: '캐시를 두는가', leadsTo: 3 },
          { text: '주소를 바꾸는가', leadsTo: 1 },
        ],
        rationale:
          '클라이언트를 대신하면 포워드, 서버를 대신하면 리버스다. 요청을 시작한 쪽을 대리하는지 받는 쪽을 대리하는지부터 본다.',
      },
      {
        kind: 'misconception',
        stem: '리버스 프록시는 누가 설정하는가?',
        choices: [
          { text: '서비스 운영자', correct: true },
          { text: '접속하는 사용자', leadsTo: 0 },
          { text: '통신 사업자', leadsTo: 0 },
          { text: '인증서 발급 기관', leadsTo: 2 },
        ],
        rationale:
          '포워드 프록시는 사용자나 조직이 설정하고, 리버스 프록시는 서비스 운영자가 공개 진입점으로 세운다.',
      },
      {
        kind: 'boundary',
        stem: '리버스 프록시가 흔히 맡는 일은?',
        choices: [
          { text: '사용자 브라우저 캐시 관리', leadsTo: 3 },
          { text: '사내 인터넷 접근 통제', leadsTo: 0 },
          { text: '요청 라우팅과 분산, TLS 종료 같은 공통 기능', correct: true },
          { text: '클라이언트 익명화', leadsTo: 1 },
        ],
        rationale:
          '공개 진입점을 하나로 만들고 내부 서버를 숨긴다. 접근 통제와 익명화는 포워드 프록시 쪽 역할이다.',
      },
    ],
  },
  {
    identityScope: 'load-balancing',
    question: '요청을 어떤 서버로 보낼지 어떻게 정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '연결 길이가 제각각일 때 맞는 방식은?',
        choices: [
          { text: '최소 연결', correct: true },
          { text: '라운드 로빈', leadsTo: 3 },
          { text: '일관된 해시', leadsTo: 1 },
          { text: '무작위 분배', leadsTo: 2 },
        ],
        rationale:
          '서버 성능과 요청 비용이 비슷하면 순환 분배가 단순하다. 연결이 길고 짧은 것이 섞이면 점유량을 반영하는 최소 연결이 맞다.',
      },
      {
        kind: 'misconception',
        stem: '최소 연결은 언제나 부하를 정확히 반영하는가?',
        choices: [
          { text: '그렇다. 연결 수가 곧 부하다', leadsTo: 2 },
          { text: '헬스 체크가 있으면 정확해진다', leadsTo: 3 },
          { text: '가중치를 주면 항상 정확해진다', leadsTo: 0 },
          { text: '연결당 비용이 다르면 틀릴 수 있다', correct: true },
        ],
        rationale:
          'CPU와 지연을 반영하는 방식은 정확도가 높지만 측정 지연과 진동을 제어해야 한다. 정적 가중치는 실제 부하 변화를 늦게 반영한다.',
      },
      {
        kind: 'boundary',
        stem: '알고리즘을 고르기 전에 갖춰야 할 것은?',
        choices: [
          { text: '노드 수를 2의 거듭제곱으로 맞추기', leadsTo: 1 },
          { text: '세션 고정 설정', leadsTo: 0 },
          { text: '무제한 재시도', leadsTo: 4 },
          { text: '비정상 노드를 빼는 헬스 체크', correct: true },
        ],
        rationale:
          '알고리즘보다 먼저 비정상 노드를 제외해야 한다. 재시도는 장애를 숨길 수 있지만 과하면 남은 서버까지 압박한다.',
      },
    ],
  },
  {
    identityScope: 'realtime',
    question: '실시간 갱신에 연결을 계속 열어야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '연결을 유지하는 편이 나은 조건은?',
        choices: [
          { text: '클라이언트가 많을수록 언제나', leadsTo: 2 },
          { text: '갱신이 드물고 운영 단순함이 중요할 때', leadsTo: 0 },
          { text: '갱신이 잦고 낮은 지연이나 양방향 전송이 필요할 때', correct: true },
          { text: '응답 크기가 클 때', leadsTo: 3 },
        ],
        rationale:
          '드문 갱신과 단순한 운영이 중요하면 폴링이 적합하다. 짧은 폴링 주기는 빈 응답과 헤더 비용을 늘린다.',
      },
      {
        kind: 'misconception',
        stem: '웹소켓으로 바꾸면 설계가 끝나는가?',
        choices: [
          { text: '끝난다. 연결만 열면 된다', leadsTo: 2 },
          { text: '폴링보다 항상 단순하다', leadsTo: 0 },
          { text: '재연결만 붙이면 된다', leadsTo: 1 },
          { text: '수용량·하트비트·재연결·역압력을 따로 설계해야 한다', correct: true },
        ],
        rationale:
          '한 번 업그레이드한 뒤 프레임을 주고받지만, 연결 수용량과 하트비트, 재연결, 느린 소비자에 대한 역압력을 설계해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '서버에서 클라이언트로만 흐르는 경우의 대안은?',
        choices: [
          { text: '하트비트를 없앤 연결', leadsTo: 2 },
          { text: '짧은 폴링만이 답이다', leadsTo: 0 },
          { text: '양방향 웹소켓이 유일하다', leadsTo: 1 },
          { text: 'Server-Sent Events', correct: true },
        ],
        rationale:
          '통신 방향과 허용 지연, 기존 인프라 지원을 함께 비교한다. 단방향이면 더 단순한 선택지가 있다.',
      },
    ],
  },
  {
    identityScope: 'grpc',
    question: '내부 API에 바이너리 RPC가 유리한 때는?',
    items: [
      {
        kind: 'concept',
        stem: 'gRPC가 유리해지는 조건은?',
        choices: [
          { text: '호출이 많고 엄격한 계약·낮은 지연·스트리밍이 필요할 때', correct: true },
          { text: '외부 파트너에게 공개할 때', leadsTo: 3 },
          { text: '단순한 CRUD만 있을 때', leadsTo: 1 },
          { text: '사람이 응답을 직접 읽어야 할 때', leadsTo: 2 },
        ],
        rationale:
          '클라이언트와 서버를 함께 통제할 수 있을수록 도입 비용이 낮다. 단순 CRUD나 외부 연동은 REST가 운영과 디버깅에 더 쉬울 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '공개 API에서도 그대로 유리한가?',
        choices: [
          { text: '그렇다. 성능이 좋으니 언제나 낫다', leadsTo: 1 },
          { text: '브라우저 지원과 읽기 어려운 페이로드가 장벽이 된다', correct: true },
          { text: '스키마만 공개하면 문제없다', leadsTo: 0 },
          { text: '오류 코드가 같아서 차이가 없다', leadsTo: 2 },
        ],
        rationale:
          '멀티플렉싱과 작은 메시지는 서비스 간 통신의 전송 부담을 줄인다. 그러나 공개 API에서는 브라우저 지원과 사람이 읽기 어려운 페이로드가 장벽이 된다.',
      },
      {
        kind: 'boundary',
        stem: '도입 전에 함께 확인해야 하는 것은?',
        choices: [
          { text: '데이터베이스 종류', leadsTo: 4 },
          { text: '프록시와 관측 도구의 지원 여부', correct: true },
          { text: '클라이언트 언어가 하나인지', leadsTo: 0 },
          { text: '응답 본문의 최대 크기', leadsTo: 1 },
        ],
        rationale:
          '프록시와 관측 도구가 HTTP/2와 gRPC를 제대로 지원하는지도 확인한다.',
      },
    ],
  },
  {
    identityScope: 'rest',
    question: '리소스 API의 성숙도를 무엇으로 판단하는가?',
    items: [
      {
        kind: 'concept',
        stem: '성숙도 단계가 재는 것은?',
        choices: [
          { text: '지원하는 클라이언트 수', leadsTo: 1 },
          { text: '응답 속도가 얼마나 빠른가', leadsTo: 4 },
          { text: '문서가 얼마나 자세한가', leadsTo: 2 },
          { text: 'HTTP의 의미를 얼마나 충실히 사용하는가', correct: true },
        ],
        rationale:
          '리소스를 URI로 나누고 메서드와 상태 코드를 의미에 맞게 쓰며 응답이 다음 행동 링크를 제공하는지로 판단한다.',
      },
      {
        kind: 'misconception',
        stem: 'Level 3이 아닌 API도 좋은 API일 수 있는가?',
        choices: [
          { text: '그렇다. 복잡성의 이득이 있는지 따져 정한다', correct: true },
          { text: '아니다. 단계가 높을수록 좋은 API다', leadsTo: 1 },
          { text: '아니다. Level 3이 아니면 REST가 아니다', leadsTo: 0 },
          { text: '아니다. 단계는 성능 순위라 낮으면 느리다', leadsTo: 4 },
        ],
        rationale:
          '조직의 클라이언트 통제 범위와 변경 빈도에 비해 복잡성의 이득이 있는지 판단해야 한다.',
      },
      {
        kind: 'boundary',
        stem: 'Level 2까지만 올라가도 얻는 것은?',
        choices: [
          { text: '링크만 따라가면 되는 클라이언트가 된다', leadsTo: 1 },
          { text: '클라이언트 결합이 완전히 사라진다', leadsTo: 1 },
          { text: '자원과 행위, 오류 의미가 명확해진다', correct: true },
          { text: '멱등성이 자동으로 보장된다', leadsTo: 3 },
        ],
        rationale:
          'Level 2만 되어도 자원과 행위, 오류 의미가 명확해져 일반적인 API에 실용적이다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HTTP 메서드 선택의 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '메서드를 고르는 기준은?',
        choices: [
          { text: '요청 본문의 크기', leadsTo: 4 },
          { text: 'CRUD 이름과의 대응', leadsTo: 0 },
          { text: '클라이언트가 서버에 요구하는 의미', correct: true },
          { text: '응답 코드의 종류', leadsTo: 2 },
        ],
        rationale:
          '대상 URI를 누가 정하는지, 표현을 통째로 바꿀지 일부 변경 명령을 적용할지도 함께 본다.',
      },
      {
        kind: 'misconception',
        stem: '자원을 새로 만들 때는 무조건 POST인가?',
        choices: [
          { text: '그렇다. 생성은 POST다', leadsTo: 0 },
          { text: 'PATCH로 만들어야 한다', leadsTo: 3 },
          { text: '클라이언트가 대상 URI를 알면 PUT이 맞을 수 있다', correct: true },
          { text: 'PUT은 수정에만 쓴다', leadsTo: 0 },
        ],
        rationale:
          '생성은 무조건 POST라는 규칙은 없다. 서버가 새 URI를 정하는 컬렉션 처리는 POST와 잘 맞고, 클라이언트가 URI를 알고 같은 표현으로 대체한다면 PUT이 맞을 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '멱등하다는 것은 무엇이 같다는 뜻인가?',
        choices: [
          { text: '로그 기록까지 같다', leadsTo: 2 },
          { text: '응답 코드까지 매번 같다', leadsTo: 1 },
          { text: '서버에 요청한 효과가 한 번과 같다', correct: true },
          { text: '재시도가 언제나 안전하다', leadsTo: 1 },
        ],
        rationale:
          '응답 코드나 로그까지 같다는 뜻은 아니다. DELETE를 다시 보내 404를 받아도 삭제 효과는 더 늘지 않는다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '전송 계층에서 멀티플렉싱과 디멀티플렉싱은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '수신 데이터를 어느 소켓에 줄지 정하는 기준은?',
        choices: [
          { text: '프로세스 이름', leadsTo: 1 },
          { text: 'IP 주소', leadsTo: 4 },
          { text: '포트 번호', correct: true },
          { text: '패킷 도착 순서', leadsTo: 3 },
        ],
        rationale:
          '전송 계층은 포트 번호로 프로세스를 구분하고, 네트워크 계층은 IP 주소로 호스트를 구분한다.',
      },
      {
        kind: 'misconception',
        stem: 'UDP와 TCP는 같은 방식으로 소켓을 가려내는가?',
        choices: [
          { text: '다르다. TCP는 네 요소를 모두 본다', correct: true },
          { text: '같다. 둘 다 포트만 본다', leadsTo: 0 },
          { text: '다르다. UDP가 더 많은 요소를 본다', leadsTo: 0 },
          { text: '프로토콜과 무관하게 동일하다', leadsTo: 3 },
        ],
        rationale:
          '붙이지 않은 UDP 소켓은 목적지 IP와 목적지 포트만으로 구분한다. TCP는 출발지와 목적지의 IP와 포트를 모두 확인한다.',
      },
      {
        kind: 'boundary',
        stem: 'UDP 소켓에 connect로 상대를 정해 두면?',
        choices: [
          { text: '출발지 쪽까지 함께 본다', correct: true },
          { text: '연결 지향으로 바뀌어 재전송이 생긴다', leadsTo: 0 },
          { text: '포트를 안 봐도 된다', leadsTo: 2 },
          { text: '아무것도 달라지지 않는다', leadsTo: 3 },
        ],
        rationale:
          '붙이지 않은 소켓은 목적지만으로 구분하지만, 상대를 정해 두면 출발지까지 확인해 가려낸다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HTTP 상태 코드는 어떤 기준으로 분류하는가?',
    items: [
      {
        kind: 'concept',
        stem: '분류를 정하는 자리는?',
        choices: [
          { text: '마지막 자리 숫자', leadsTo: 0 },
          { text: '첫 번째 자리 숫자', correct: true },
          { text: '응답 본문의 유무', leadsTo: 2 },
          { text: '요청 메서드의 종류', leadsTo: 3 },
        ],
        rationale:
          '첫 자리가 응답의 성격을 나눈다. 그래서 로그와 지표를 빠르게 분류하는 기준이 된다.',
      },
      {
        kind: 'misconception',
        stem: '4xx는 모두 요청을 고쳐 보내면 해결되는가?',
        choices: [
          { text: '그렇다. 요청 오류이므로 고치면 된다', leadsTo: 1 },
          { text: '서버가 고쳐야 한다', leadsTo: 4 },
          { text: '재시도만 하면 언제나 통과한다', leadsTo: 4 },
          { text: '인증이나 한도처럼 그렇지 않은 것도 있다', correct: true },
        ],
        rationale:
          '4xx는 요청 쪽 사정으로 서버가 처리하지 못했다는 뜻이다. 고쳐 보내면 되는 것도 있고 인증이나 한도처럼 그렇지 않은 것도 있다.',
      },
      {
        kind: 'boundary',
        stem: '5xx가 뜻하는 것은?',
        choices: [
          { text: '요청 형식이 잘못됐다', leadsTo: 1 },
          { text: '요청은 멀쩡한데 서버가 못 해냈다', correct: true },
          { text: '자원이 사라졌다', leadsTo: 2 },
          { text: '다른 주소로 옮겨졌다', leadsTo: 3 },
        ],
        rationale:
          '4xx와 5xx의 차이는 책임 소재가 어디에 있느냐다. 5xx는 요청은 멀쩡한데 서버가 못 해냈다는 뜻이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'Git 협업 시 충돌 해결을 위해 무엇을 우선하는가?',
    items: [
      {
        kind: 'concept',
        stem: '가장 먼저 맞춰야 하는 것은?',
        choices: [
          { text: '합의된 브랜치 전략과 코드 컨벤션', correct: true },
          { text: '머지 방식의 통일', leadsTo: 0 },
          { text: '충돌 해결 도구의 선택', leadsTo: 4 },
          { text: '커밋 메시지 형식', leadsTo: 1 },
        ],
        rationale:
          '머지 방식보다 먼저 작업 범위와 시점을 팀원끼리 맞춘다. 전략이 없으면 각자 다른 시점에 같은 파일을 수정해 충돌이 잦아진다.',
      },
      {
        kind: 'misconception',
        stem: '포맷팅 차이로 나는 충돌은 어떻게 줄이는가?',
        choices: [
          { text: '코드 컨벤션을 맞추고 도구로 자동화한다', correct: true },
          { text: '충돌이 나면 그때그때 손으로 고른다', leadsTo: 4 },
          { text: '브랜치를 더 잘게 쪼갠다', leadsTo: 1 },
          { text: '병합 대신 골라 옮긴다', leadsTo: 2 },
        ],
        rationale:
          '코드 컨벤션을 맞추면 단순 포맷팅 차이로 발생하는 불필요한 충돌을 줄인다. Prettier 같은 도구로 자동화하는 것이 일반적이다.',
      },
      {
        kind: 'boundary',
        stem: '실제 충돌 해결은 무엇에서 시작하는가?',
        choices: [
          { text: '작업 내용을 잠시 치워두기', leadsTo: 3 },
          { text: '병합 도구의 자동 해결 기능', leadsTo: 4 },
          { text: '최신 커밋을 무조건 채택', leadsTo: 0 },
          { text: '변경 사항의 맥락 파악과 작성자와의 소통', correct: true },
        ],
        rationale:
          '최종 충돌 해결은 항상 변경 사항의 맥락을 파악하는 것에서 시작한다. 단순 도구 사용보다 작성자와의 소통이 가장 빠르고 정확하다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '웹소켓과 일반 소켓 통신은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘이 놓인 계층은?',
        choices: [
          { text: '웹소켓이 더 아래에 있다', leadsTo: 0 },
          { text: '둘 다 전송 계층이다', leadsTo: 4 },
          { text: '웹소켓은 애플리케이션 계층, 소켓은 전송 계층', correct: true },
          { text: '계층과 무관하게 같은 것이다', leadsTo: 2 },
        ],
        rationale:
          '웹소켓은 HTTP 기반의 전이중 통신 프로토콜이고, 일반 소켓은 전송 계층의 TCP/UDP 연결 자체를 의미한다.',
      },
      {
        kind: 'misconception',
        stem: '웹소켓은 소켓을 대체하는가?',
        choices: [
          { text: '대체한다. 더 상위 기술이다', leadsTo: 4 },
          { text: '내부적으로 소켓을 사용해 구현된다', correct: true },
          { text: '서로 무관한 별개 기술이다', leadsTo: 0 },
          { text: '소켓이 웹소켓을 사용한다', leadsTo: 0 },
        ],
        rationale:
          '일반 소켓은 운영체제가 제공하는 네트워크 인터페이스다. 웹소켓은 특정 규약을 정의한 것이고 그 통로 위에서 구현된다.',
      },
      {
        kind: 'boundary',
        stem: '핸드셰이크가 끝난 뒤의 통신 방식은?',
        choices: [
          { text: '서버만 보낼 수 있다', leadsTo: 3 },
          { text: '계속 HTTP 요청-응답을 반복한다', leadsTo: 2 },
          { text: '자기 프레임으로 양쪽이 아무 때나 보낸다', correct: true },
          { text: '매번 다시 악수한다', leadsTo: 0 },
        ],
        rationale:
          '처음 한 번만 HTTP로 악수하고 그 뒤로는 자기 프레임으로 오간다. 요청-응답이 아니라 양쪽이 아무 때나 보내는 구조다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: 'IP 주소의 핵심 역할은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'IP 주소가 담는 것은?',
        choices: [
          { text: '어디로 보내야 하는지', correct: true },
          { text: '어떤 프로세스가 받을지', leadsTo: 2 },
          { text: '어떤 물리 장비인지', leadsTo: 3 },
          { text: '어떤 프로토콜을 쓸지', leadsTo: 0 },
        ],
        rationale:
          '네트워크 인터페이스마다 붙는 주소이고 라우터는 이 주소를 보고 패킷을 목적지 네트워크로 보낸다.',
      },
      {
        kind: 'misconception',
        stem: '기기 하나에 IP 주소는 하나인가?',
        choices: [
          { text: '하나다. 기기의 고유 식별자다', leadsTo: 3 },
          { text: '운영체제가 하나로 통합한다', leadsTo: 4 },
          { text: '인터페이스와 무관하게 하나다', leadsTo: 1 },
          { text: '여러 개가 붙을 수 있고 사설 주소는 겹칠 수도 있다', correct: true },
        ],
        rationale:
          '기기 하나에 여러 개가 붙을 수 있고 사설 주소는 안팎에서 겹칠 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '기기의 위치가 바뀌면?',
        choices: [
          { text: 'IP도 바뀐다. 그래서 이름을 따로 쓴다', correct: true },
          { text: '주소는 그대로 따라다닌다', leadsTo: 4 },
          { text: '물리 주소만 바뀐다', leadsTo: 3 },
          { text: '서브넷만 바뀐다', leadsTo: 2 },
        ],
        rationale:
          '식별과 위치 정보가 동시에 존재하므로 기기의 위치가 바뀌면 IP 주소도 변한다. 그래서 고정된 대상과 통신하기 위해 DNS나 도메인 네임을 사용한다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'XSS 공격으로 훔칠 수 있는 데이터는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '스크립트가 읽어갈 수 있는 것은?',
        choices: [
          { text: '모든 쿠키와 모든 출처의 저장소', leadsTo: 0 },
          { text: '같은 출처의 로컬 스토리지와 HttpOnly가 없는 쿠키', correct: true },
          { text: '서버의 세션 저장소', leadsTo: 3 },
          { text: '브라우저에 저장된 비밀번호', leadsTo: 2 },
        ],
        rationale:
          'XSS는 주로 세션 정보와 브라우저 저장소를 노린다. 쿠키에는 세션 ID와 인증 정보가, 로컬 스토리지에는 토큰과 설정값이 담긴다.',
      },
      {
        kind: 'misconception',
        stem: 'HttpOnly가 붙은 쿠키는 어떻게 되는가?',
        choices: [
          { text: '암호화돼 있어 읽어도 못 쓴다', leadsTo: 2 },
          { text: '똑같이 읽을 수 있다', leadsTo: 0 },
          { text: '스크립트가 그 쿠키를 못 읽는다', correct: true },
          { text: '서버로만 전송되지 않는다', leadsTo: 0 },
        ],
        rationale:
          'HttpOnly가 붙어 있으면 스크립트가 그 쿠키를 못 읽는다. 로컬 스토리지에는 이런 보호가 없다.',
      },
      {
        kind: 'boundary',
        stem: '피해가 정보 유출에서 끝나는가?',
        choices: [
          { text: '서버 파일까지 지울 수 있다', leadsTo: 3 },
          { text: '읽기만 가능해 유출에서 끝난다', leadsTo: 1 },
          { text: '페이지 내용을 바꿔 피싱으로도 이어진다', correct: true },
          { text: '다른 사이트 요청을 위조하는 것이 본체다', leadsTo: 3 },
        ],
        rationale:
          '정보 유출에 그치지 않고 페이지 내용을 바꾸기도 한다. 가짜 로그인 폼을 띄워 비밀번호를 직접 입력하게 만드는 피싱으로 이어진다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '쿠키와 세션은 데이터 저장 위치로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘의 저장 위치는?',
        choices: [
          { text: '둘 다 브라우저', leadsTo: 3 },
          { text: '쿠키는 브라우저, 세션은 서버', correct: true },
          { text: '둘 다 서버', leadsTo: 0 },
          { text: '쿠키는 서버, 세션은 브라우저', leadsTo: 2 },
        ],
        rationale:
          '세션은 서버에 데이터를 저장하고 클라이언트에는 세션 ID만 전달한다. 실제 데이터는 서버가 관리하므로 조작이 어렵다.',
      },
      {
        kind: 'misconception',
        stem: '쿠키는 모든 요청에 자동으로 실리는가?',
        choices: [
          { text: '도메인과 상관없이 모든 요청에 자동으로 실린다', leadsTo: 1 },
          { text: '스크립트가 헤더에 직접 붙일 때만 실린다', leadsTo: 1 },
          { text: '도메인과 SameSite 조건에 맞는 요청에만 실린다', correct: true },
          { text: '같은 탭에서 연 요청에만 실린다', leadsTo: 3 },
        ],
        rationale:
          '쿠키는 도메인·경로와 Secure·SameSite 조건에 맞는 요청에만 자동으로 실린다.',
      },
      {
        kind: 'boundary',
        stem: '세션 방식이 치르는 비용은?',
        choices: [
          { text: '요청마다 전체 데이터를 실어 보낸다', leadsTo: 2 },
          { text: '클라이언트가 데이터를 조작할 수 있다', leadsTo: 1 },
          { text: '저장 용량이 브라우저 한도에 묶인다', leadsTo: 3 },
          { text: '사용자 수가 늘면 서버 부하가 늘어난다', correct: true },
        ],
        rationale:
          '서버 메모리를 사용하므로 사용자 수가 늘면 부하가 증가한다. 조작이 어렵다는 이점과 맞바꾸는 부분이다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '브라우저에 URL을 입력하면 어떤 과정을 거치는가?',
    items: [
      {
        kind: 'concept',
        stem: 'URL을 해석한 다음 순서는?',
        choices: [
          { text: '바로 보안 연결을 맺는다', leadsTo: 2 },
          { text: '무조건 이름 조회부터 한다', leadsTo: 0 },
          { text: '캐시와 기존 연결이 남아 있는지 확인한다', correct: true },
          { text: 'HTML부터 파싱한다', leadsTo: 1 },
        ],
        rationale:
          '이미 가진 답과 연결이 있으면 모든 단계를 매번 반복하지 않는다. 서비스 워커나 HTTP 캐시가 요청을 만족시키면 네트워크에 나가지 않을 수도 있다.',
      },
      {
        kind: 'misconception',
        stem: '이름 조회는 매번 처음부터 도는가?',
        choices: [
          { text: '매번 루트부터 새로 찾는다', leadsTo: 0 },
          { text: '서버가 대신 찾아준다', leadsTo: 0 },
          { text: '브라우저와 운영체제 캐시를 먼저 본다', correct: true },
          { text: '연결이 있으면 이름이 바뀐다', leadsTo: 3 },
        ],
        rationale:
          '브라우저와 운영체제의 DNS 캐시에 주소가 없을 때만 설정된 재귀 리졸버에 묻는다.',
      },
      {
        kind: 'boundary',
        stem: 'HTTP/3에서 보안 연결은 어떻게 맺는가?',
        choices: [
          { text: 'TCP를 맺은 뒤 따로 TLS를 한다', leadsTo: 2 },
          { text: 'QUIC 연결 설정에 TLS 1.3 핸드셰이크가 통합돼 있다', correct: true },
          { text: '암호화를 하지 않는다', leadsTo: 3 },
          { text: 'UDP라 보안 연결을 못 맺는다', leadsTo: 3 },
        ],
        rationale:
          'HTTP/1.1과 HTTP/2는 보통 TCP를 맺은 뒤 TLS로 키를 확인한다. HTTP/3은 UDP 위의 QUIC을 쓰며 TLS 1.3 핸드셰이크가 연결 설정에 통합돼 있다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HTTPS는 HTTP와 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: 'HTTPS에 더 있는 것은?',
        choices: [
          { text: '압축 계층', leadsTo: 3 },
          { text: '더 빠른 전송 프로토콜', leadsTo: 3 },
          { text: '전송 계층 위에 얹은 TLS 보안 계층', correct: true },
          { text: '새로운 요청 메서드', leadsTo: 0 },
        ],
        rationale:
          'HTTP에 SSL/TLS 프로토콜을 추가해 데이터를 암호화한 것이다. 암호화와 인증으로 도청과 변조, 위조를 막는다.',
      },
      {
        kind: 'misconception',
        stem: '대칭키는 어떻게 양쪽이 나눠 갖는가?',
        choices: [
          { text: '각자 낸 값을 합쳐 만든 공유 비밀에서 뽑는다', correct: true },
          { text: '비대칭키로 암호화해 실어 보낸다', leadsTo: 1 },
          { text: '인증서 안에 들어 있다', leadsTo: 2 },
          { text: '서버가 평문으로 알려준다', leadsTo: 1 },
        ],
        rationale:
          '요즘 흔한 (EC)DHE라면 양쪽이 각자 값을 내고 합쳐 공유 비밀을 만든 뒤 거기서 대칭키를 뽑는다. 공개키는 서버가 인증서의 주인임을 서명으로 보이는 데 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '서버가 클라이언트를 확인하는 것은?',
        choices: [
          { text: '인증서가 있으면 자동으로 된다', leadsTo: 2 },
          { text: '항상 양쪽이 서로 확인한다', leadsTo: 2 },
          { text: '기본이 아니다. 필요하면 따로 켠다', correct: true },
          { text: '대칭키 교환에 포함돼 있다', leadsTo: 1 },
        ],
        rationale:
          '클라이언트가 서버를 확인하는 것이 기본이다. 서버가 클라이언트를 확인해야 하면 mTLS를 따로 켠다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '쿠키와 세션의 상태 유지 방식은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '쿠키만으로 상태를 유지하면 서버는?',
        choices: [
          { text: '요청마다 데이터베이스를 읽는다', leadsTo: 4 },
          { text: '별도 저장소 없이 사용자를 식별한다', correct: true },
          { text: '세션 ID를 따로 발급한다', leadsTo: 3 },
          { text: '메모리에 사본을 둔다', leadsTo: 1 },
        ],
        rationale:
          '쿠키는 조건에 맞는 요청에 자동으로 실리고, 서버는 이를 읽어 사용자를 식별한다.',
      },
      {
        kind: 'misconception',
        stem: '서버를 여러 대로 늘리면 세션은?',
        choices: [
          { text: '불일치가 생겨 외부 저장소로 모아야 한다', correct: true },
          { text: '자동으로 공유된다', leadsTo: 4 },
          { text: '쿠키가 대신 처리한다', leadsTo: 2 },
          { text: '문제가 생기지 않는다', leadsTo: 1 },
        ],
        rationale:
          '분산 서버 환경에서는 세션 불일치 문제가 발생한다. 여러 서버가 세션을 공유해야 하면 Redis 같은 외부 저장소로 모은다.',
      },
      {
        kind: 'boundary',
        stem: '세션이 쿠키보다 보안성이 높은 이유는?',
        choices: [
          { text: '전송 구간이 암호화되기 때문이다', leadsTo: 2 },
          { text: '실제 데이터를 서버가 관리해 조작이 어렵다', correct: true },
          { text: '세션 ID는 탈취될 수 없기 때문이다', leadsTo: 0 },
          { text: '용량 제한이 없기 때문이다', leadsTo: 4 },
        ],
        rationale:
          '세션은 클라이언트에 세션 ID만 전달한다. 쿠키는 클라이언트가 데이터를 직접 수정할 수 있어 보안에 취약하다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HTTP 메서드 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '두 축으로 나누는 기준은?',
        choices: [
          { text: '본문이 있는지와 캐시되는지', leadsTo: 2 },
          { text: '상태를 바꾸는지와 멱등한지', correct: true },
          { text: '응답 코드와 헤더 종류', leadsTo: 4 },
          { text: '요청 크기와 처리 시간', leadsTo: 0 },
        ],
        rationale:
          'GET은 서버 상태를 바꾸지 않아 캐싱이 가능하다. 나머지는 상태를 바꾸며 멱등성에서 갈린다.',
      },
      {
        kind: 'misconception',
        stem: 'PATCH는 언제나 비멱등인가?',
        choices: [
          { text: '언제나 비멱등이다', leadsTo: 0 },
          { text: '언제나 멱등이다', leadsTo: 1 },
          { text: '구현 방식에 따라 멱등할 수도 있다', correct: true },
          { text: '멱등성과 무관하다', leadsTo: 0 },
        ],
        rationale:
          'PATCH는 리소스의 일부만 수정한다. 구현 방식에 따라 멱등할 수도, 비멱등할 수도 있어 주의가 필요하다.',
      },
      {
        kind: 'boundary',
        stem: 'PUT이 멱등한 이유는?',
        choices: [
          { text: '상태를 바꾸지 않기 때문이다', leadsTo: 4 },
          { text: '전체를 교체하므로 여러 번 보내도 결과가 같다', correct: true },
          { text: '서버가 중복을 걸러내기 때문이다', leadsTo: 0 },
          { text: '캐시되기 때문이다', leadsTo: 2 },
        ],
        rationale:
          'PUT은 리소스를 전체 교체한다. 동일한 요청을 여러 번 보내도 결과가 같으므로 멱등하다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '죽은 서버로 요청이 안 가는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '살아 있는지 언제 확인하는가?',
        choices: [
          { text: '요청이 올 때마다 확인한다', leadsTo: 1 },
          { text: '주기적으로 미리 확인해 둔다', correct: true },
          { text: '장애 신고가 들어오면 확인한다', leadsTo: 2 },
          { text: '배포할 때만 확인한다', leadsTo: 4 },
        ],
        rationale:
          '로드밸런서가 주기적으로 물어보고 대답이 없으면 목록에서 뺀다. 요청이 올 때 확인하는 것이 아니라 미리 확인해 둔다.',
      },
      {
        kind: 'misconception',
        stem: '목록에서 빼면 그 서버의 기존 연결은?',
        choices: [
          { text: '이미 열린 연결은 이어질 수 있다', correct: true },
          { text: '즉시 모두 끊긴다', leadsTo: 3 },
          { text: '다른 서버로 옮겨진다', leadsTo: 3 },
          { text: '오류 응답으로 바뀐다', leadsTo: 2 },
        ],
        rationale:
          '새로 배정하는 것을 멈추는 것이지 쓰던 것을 끊는 것이 아니다.',
      },
      {
        kind: 'boundary',
        stem: '확인 주소를 잘못 잡으면?',
        choices: [
          { text: '연결이 두 배로 늘어난다', leadsTo: 3 },
          { text: '멀쩡한 서버가 전부 빠진다', leadsTo: 1 },
          { text: '확인 주기가 늘어난다', leadsTo: 1 },
          { text: '죽은 서버가 계속 목록에 남는다', correct: true },
        ],
        rationale:
          '웹 서버만 살아 있고 데이터베이스가 끊긴 상태에서 정적 파일을 돌려주면 죽은 서버가 계속 목록에 남는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '먼 나라 사용자도 빠르게 받는 방법은?',
    items: [
      {
        kind: 'concept',
        stem: '가까운 사본이 빠른 이유는?',
        choices: [
          { text: '원본 서버가 더 빨라진다', leadsTo: 4 },
          { text: '파일이 더 작게 압축된다', leadsTo: 0 },
          { text: '거리만큼 길어지던 왕복이 통째로 사라진다', correct: true },
          { text: '연결을 맺지 않아도 된다', leadsTo: 4 },
        ],
        rationale:
          '거리가 곧 시간이다. 멀수록 왕복 하나가 길어지고 연결을 맺는 데만 그 왕복이 여러 번 든다.',
      },
      {
        kind: 'misconception',
        stem: '원본 파일을 바꾸면 사본은?',
        choices: [
          { text: '즉시 함께 바뀐다', leadsTo: 2 },
          { text: '자동으로 지워진다', leadsTo: 2 },
          { text: '보관 기간이 끝날 때까지 옛것을 준다', correct: true },
          { text: '원본을 다시 확인한다', leadsTo: 0 },
        ],
        rationale:
          '어려운 것은 지우는 일이다. 그래서 파일 이름에 내용 해시를 넣어 다른 파일로 만든다.',
      },
      {
        kind: 'boundary',
        stem: '사본이 있어도 원본까지 가는 때는?',
        choices: [
          { text: '파일이 클 때', leadsTo: 4 },
          { text: '사용자가 멀리 있을 때', leadsTo: 0 },
          { text: '기간이 지났거나 캐시를 건너뛰라고 적혀 있을 때', correct: true },
          { text: '언제나 원본까지 간다', leadsTo: 0 },
        ],
        rationale:
          '기간이 지나 다시 확인할 때, 캐시를 건너뛰라고 적혀 있을 때, 애초에 캐시할 수 없는 응답일 때다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '서버 앞에 하나를 더 두는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '앞에 하나를 두면 얻는 것은?',
        choices: [
          { text: '여러 서버를 하나처럼 보이게 한다', correct: true },
          { text: '서버 대수를 줄일 수 있다', leadsTo: 3 },
          { text: '데이터베이스 부하가 준다', leadsTo: 4 },
          { text: '클라이언트를 감춘다', leadsTo: 0 },
        ],
        rationale:
          '여러 서버를 하나처럼 보이게 하고, 서버마다 하던 일을 한곳으로 모은다. 인증서와 압축, 정적 파일도 여기서 한 번에 처리한다.',
      },
      {
        kind: 'misconception',
        stem: '뒤쪽 서버를 늘리거나 옮기면 바깥 주소는?',
        choices: [
          { text: '그대로다. 브라우저는 앱 서버를 모른다', correct: true },
          { text: '함께 바뀌어 클라이언트가 고쳐야 한다', leadsTo: 2 },
          { text: '서버 수만큼 늘어난다', leadsTo: 0 },
          { text: '매번 새로 발급된다', leadsTo: 1 },
        ],
        rationale:
          '브라우저는 앱 서버를 모른다. 그래서 서버를 늘리거나 옮겨도 바깥 주소가 그대로다.',
      },
      {
        kind: 'boundary',
        stem: '이 구조의 약점은?',
        choices: [
          { text: '뒤쪽 서버가 하나 죽으면 전부 멈춘다', leadsTo: 3 },
          { text: '여기가 죽으면 전부 죽는다', correct: true },
          { text: '정적 파일을 못 준다', leadsTo: 4 },
          { text: '인증서를 쓸 수 없다', leadsTo: 1 },
        ],
        rationale:
          '그래서 이 자리도 여러 대를 두거나 앞단을 따로 둔다.',
      },
    ],
  },
  {
    identityScope: 'tcp',
    question: 'TCP 연결은 어떤 상태를 지나 닫히는가?',
    items: [
      {
        kind: 'concept',
        stem: '종료가 한 번에 안 끝나는 이유는?',
        choices: [
          { text: '양쪽이 각자 닫아야 하기 때문', correct: true },
          { text: '패킷이 자주 유실되기 때문', leadsTo: 3 },
          { text: '순번을 다시 맞춰야 하기 때문', leadsTo: 2 },
          { text: '버퍼를 비워야 하기 때문', leadsTo: 0 },
        ],
        rationale:
          '먼저 닫는 쪽과 받는 쪽이 서로 다른 상태를 지난다. 받는 쪽은 FIN을 받아도 아직 보낼 것을 마저 보낸 뒤 자기 FIN을 보낸다.',
      },
      {
        kind: 'misconception',
        stem: 'CLOSE_WAIT가 쌓여 있으면 어디를 봐야 하는가?',
        choices: [
          { text: '상대 서버의 설정', leadsTo: 4 },
          { text: '네트워크 장비의 패킷 유실', leadsTo: 3 },
          { text: '커널의 대기 시간 설정', leadsTo: 1 },
          { text: '내 쪽 코드가 소켓을 안 닫고 있다', correct: true },
        ],
        rationale:
          'CLOSE_WAIT가 쌓여 있으면 상대 탓이 아니다. FIN을 받고도 자기 쪽에서 닫지 않고 있다는 뜻이다.',
      },
      {
        kind: 'boundary',
        stem: 'TIME_WAIT는 어느 쪽에 생기는가?',
        choices: [
          { text: '언제나 클라이언트 쪽', leadsTo: 4 },
          { text: '나중에 닫은 쪽', leadsTo: 0 },
          { text: '언제나 서버 쪽', leadsTo: 4 },
          { text: '먼저 닫은 쪽', correct: true },
        ],
        rationale:
          '서버에 쌓였다면 서버가 먼저 끊고 있다는 신호다. 양쪽이 동시에 닫으면 둘 다 생긴다.',
      },
    ],
  },
  {
    identityScope: 'tcp',
    question: 'TCP는 보낼 양을 어떻게 늘렸다 줄이는가?',
    items: [
      {
        kind: 'concept',
        stem: '보낼 양을 늘리는 방식은?',
        choices: [
          { text: '처음부터 최대치로 시작한다', leadsTo: 2 },
          { text: '두 배씩 늘리다 문턱을 넘으면 하나씩', correct: true },
          { text: '왕복마다 항상 하나씩만', leadsTo: 0 },
          { text: '수신 창 크기에 맞춰 고정한다', leadsTo: 2 },
        ],
        rationale:
          '작게 시작해 왕복마다 두 배로 늘리다가 문턱(ssthresh)을 넘으면 왕복마다 하나씩 늘리는 혼잡 회피로 바꾼다.',
      },
      {
        kind: 'misconception',
        stem: '느린 시작은 정말 느린가?',
        choices: [
          { text: '느리다. 조금씩만 늘린다', leadsTo: 0 },
          { text: '느리지만 안전해서 쓴다', leadsTo: 4 },
          { text: '시작이 작을 뿐 왕복마다 두 배로 늘어난다', correct: true },
          { text: '이름과 달리 줄이는 단계다', leadsTo: 1 },
        ],
        rationale:
          '이름과 달리 느린 시작은 느리지 않다. 시작이 작을 뿐 늘어나는 속도는 왕복마다 두 배다.',
      },
      {
        kind: 'boundary',
        stem: '타임아웃과 중복 ACK 세 번은 왜 다르게 다루는가?',
        choices: [
          { text: '타임아웃은 아무 소식이 없다는 뜻이라 1로 되돌린다', correct: true },
          { text: '둘 다 절반으로 줄인다', leadsTo: 1 },
          { text: '중복 ACK가 더 심각한 신호다', leadsTo: 0 },
          { text: '둘 다 1로 되돌린다', leadsTo: 1 },
        ],
        rationale:
          '같은 ACK가 세 번 겹쳐 오면 길이 완전히 막힌 것은 아니라고 보고 절반으로 줄인다. 타임아웃이면 1로 되돌리고 느린 시작부터 다시 한다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '보낼 데이터가 길에서 감당할 크기보다 크면 어떻게 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '감당할 크기를 넘으면?',
        choices: [
          { text: '연결이 끊긴다', leadsTo: 2 },
          { text: '언제나 자동으로 잘려 전달된다', leadsTo: 3 },
          { text: '속도만 느려지고 전달은 된다', leadsTo: 1 },
          { text: '중간에 잘리거나, 아예 못 가고 되돌아온다', correct: true },
        ],
        rationale:
          'IPv4는 자르지 말라는 표시가 붙었는지로 갈린다. 표시가 있으면 라우터는 자르지 않고 버린 뒤 감당할 크기를 알려 준다. IPv6는 라우터가 아예 자르지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '중간에서 잘린 조각 하나를 잃으면?',
        choices: [
          { text: '그 조각만 다시 받으면 된다', leadsTo: 1 },
          { text: '아무 영향이 없다', leadsTo: 3 },
          { text: '받는 쪽이 알아서 메운다', leadsTo: 1 },
          { text: '전체를 다시 보내야 한다', correct: true },
        ],
        rationale:
          '중간에서 자르는 방식은 손해가 크다. 받는 쪽은 다 모일 때까지 메모리를 붙들고 있어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '크기를 알려 주는 신호가 막히면 어떤 증상이 나오는가?',
        choices: [
          { text: '작은 요청부터 실패한다', leadsTo: 2 },
          { text: '연결 자체가 안 맺어진다', leadsTo: 2 },
          { text: '모든 요청이 느려진다', leadsTo: 0 },
          { text: '악수는 됐는데 큰 데이터만 안 간다', correct: true },
        ],
        rationale:
          '알려 주는 신호가 막히면 조용히 멈춘다. 그래서 연결은 되는데 큰 데이터만 안 가는 증상으로 나타난다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '같은 망 안에서 상대를 어떻게 찾아가는가?',
    items: [
      {
        kind: 'concept',
        stem: '주소를 알아도 다시 물어보는 이유는?',
        choices: [
          { text: '실제로 보낼 때 쓰는 주소가 따로 있어서', correct: true },
          { text: '상대가 살아 있는지 확인하려고', leadsTo: 4 },
          { text: '경로를 계산하려고', leadsTo: 1 },
          { text: '속도를 재려고', leadsTo: 0 },
        ],
        rationale:
          '알아낸 것은 잠시 들고 있는다. 매번 물어보면 망이 소리로 가득 찬다.',
      },
      {
        kind: 'misconception',
        stem: '다른 망에 있는 상대는 어떻게 찾는가?',
        choices: [
          { text: '똑같이 소리쳐 물어본다', leadsTo: 1 },
          { text: '상대를 안 찾고 문 역할 장비로 넘긴다', correct: true },
          { text: '중간 라우터가 대신 대답한다', leadsTo: 1 },
          { text: '찾을 수 없어 통신이 안 된다', leadsTo: 3 },
        ],
        rationale:
          '다른 망이면 상대를 안 찾는다. 대신 문 역할을 하는 장비의 주소를 찾아 거기로 넘기고 그 뒤는 그 장비가 맡는다.',
      },
      {
        kind: 'boundary',
        stem: '알아낸 것을 오래 들고 있으면?',
        choices: [
          { text: '아무 문제가 없다', leadsTo: 2 },
          { text: '망이 소리로 가득 찬다', leadsTo: 0 },
          { text: '메모리가 부족해진다', leadsTo: 0 },
          { text: '상대가 바뀌었을 때 엉뚱한 곳으로 보낸다', correct: true },
        ],
        rationale:
          '짧으면 물음이 잦고 길면 상대가 바뀌었을 때 엉뚱한 곳으로 보낸다. 장비를 갈아 끼웠는데 잠깐 안 되는 일이 그것이다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '집 안의 여러 기기가 IP 하나로 어떻게 나가는가?',
    items: [
      {
        kind: 'concept',
        stem: '나갈 때 무엇을 하는가?',
        choices: [
          { text: '주소를 바꾸지 않고 그대로 보낸다', leadsTo: 0 },
          { text: '목적지를 사설 주소로 바꾼다', leadsTo: 4 },
          { text: '기기마다 공인 주소를 하나씩 받는다', leadsTo: 3 },
          { text: '출발지를 공인 주소로 바꿔 적고 표에 남긴다', correct: true },
        ],
        rationale:
          '표가 있어야 돌아온 답을 누구에게 줄지 안다. 포트는 겹칠 때만 바꾼다.',
      },
      {
        kind: 'misconception',
        stem: '바깥에서 먼저 걸어오는 연결이 안 되는 이유는?',
        choices: [
          { text: '보안 정책이 막고 있어서', leadsTo: 0 },
          { text: '포트가 모두 쓰여서', leadsTo: 4 },
          { text: '공인 주소가 없어서', leadsTo: 3 },
          { text: '먼저 나간 적이 없어 표에 줄이 없어서', correct: true },
        ],
        rationale:
          '받으려면 어느 포트를 어디로 보낼지 미리 적어 둬야 한다.',
      },
      {
        kind: 'boundary',
        stem: '오래 열어 두는 연결에 필요한 것은?',
        choices: [
          { text: '표의 줄은 영구히 남으니 둘 필요 없다', leadsTo: 1 },
          { text: '주기적으로 뭔가를 보내 줄을 살려 둔다', correct: true },
          { text: '포트를 고정해 둔다', leadsTo: 0 },
          { text: '공인 주소를 하나 더 받는다', leadsTo: 3 },
        ],
        rationale:
          '표의 줄은 오래 두지 않는다. 조용하면 지운다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '브라우저가 캐시를 쓸지 말지 어떻게 정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '쓸지 말지를 정하는 근거는?',
        choices: [
          { text: '접속 속도', leadsTo: 1 },
          { text: '브라우저 설정값', leadsTo: 3 },
          { text: '파일 확장자', leadsTo: 2 },
          { text: '응답에 붙은 지시', correct: true },
        ],
        rationale:
          '아직 신선하면 요청 없이 그대로 쓰고, 수명이 지났으면 서버에 물어본다.',
      },
      {
        kind: 'misconception',
        stem: '수명이 지난 응답은 어떻게 되는가?',
        choices: [
          { text: '표식을 붙여 물어보고 안 바뀌었으면 그대로 쓴다', correct: true },
          { text: '바로 버리고 새로 받는다', leadsTo: 1 },
          { text: '경고와 함께 그냥 쓴다', leadsTo: 0 },
          { text: '저장소에서 자동으로 지워진다', leadsTo: 2 },
        ],
        rationale:
          '낡았다고 버리는 것이 아니다. 안 바뀌었으면 서버가 그렇다고만 답하고 본문은 안 보낸다.',
      },
      {
        kind: 'boundary',
        stem: '뒤로 가기는 이 흐름을 그대로 따르는가?',
        choices: [
          { text: '다른 경로로 동작한다', correct: true },
          { text: '똑같이 수명을 확인한다', leadsTo: 1 },
          { text: '언제나 서버에 다시 묻는다', leadsTo: 1 },
          { text: '캐시를 쓰지 않는다', leadsTo: 3 },
        ],
        rationale:
          '브라우저가 앞 화면을 통째로 들고 있다가 되살리는 경로가 따로 있다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '응답을 압축하면 무엇을 치르는가?',
    items: [
      {
        kind: 'concept',
        stem: '전송량이 주는 대신 무엇을 쓰는가?',
        choices: [
          { text: '서버 디스크 용량만', leadsTo: 1 },
          { text: '보내는 쪽과 받는 쪽 모두의 CPU와 시간', correct: true },
          { text: '받는 쪽 메모리만', leadsTo: 3 },
          { text: '아무것도 치르지 않는다', leadsTo: 2 },
        ],
        rationale:
          '그래서 늘 이득이 아니다. 같은 파일을 요청마다 다시 압축하는 것이 가장 아까운 자리다.',
      },
      {
        kind: 'misconception',
        stem: '모든 응답에 압축을 켜면 되는가?',
        choices: [
          { text: '이미 압축된 형식과 작은 응답은 이득이 작다', correct: true },
          { text: '켜면 언제나 이득이다', leadsTo: 0 },
          { text: '텍스트만 아니면 다 이득이다', leadsTo: 2 },
          { text: '세기를 최대로 두면 언제나 이득이다', leadsTo: 0 },
        ],
        rationale:
          '이미 압축된 이미지와 동영상은 더 안 줄고 CPU만 쓴다. 아주 작은 응답은 줄어드는 양보다 덧붙는 정보가 크다.',
      },
      {
        kind: 'boundary',
        stem: '비밀 값이 섞인 응답에서 조심할 점은?',
        choices: [
          { text: '줄어든 크기가 그 값을 짐작할 단서가 된다', correct: true },
          { text: '압축하면 값이 평문으로 드러난다', leadsTo: 3 },
          { text: '압축 방식이 노출된다', leadsTo: 0 },
          { text: '조심할 것이 없다', leadsTo: 4 },
        ],
        rationale:
          '압축은 반복을 줄이는 것이라, 줄어든 크기가 그 값을 짐작할 단서가 되기도 한다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: 'TCP 연결 종료는 왜 대개 네 번 주고받는가?',
    items: [
      {
        kind: 'concept',
        stem: '네 번이 필요한 근본 이유는?',
        choices: [
          { text: '양방향 경로를 각각 독립적으로 닫아야 해서', correct: true },
          { text: '패킷 유실에 대비하려고', leadsTo: 2 },
          { text: '순번을 다시 맞추려고', leadsTo: 3 },
          { text: '대기 시간을 벌려고', leadsTo: 3 },
        ],
        rationale:
          'TCP는 전이중 통신을 지원하므로 송신과 수신 경로가 별개로 동작한다. 한쪽이 끊고자 해도 다른 쪽은 여전히 보내는 중일 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '언제나 네 단계로 끝나는가?',
        choices: [
          { text: '양쪽이 각각 닫으니 언제나 네 단계다', leadsTo: 0 },
          { text: 'ACK와 FIN이 합쳐지면 세 단계도 된다', correct: true },
          { text: '연결과 마찬가지로 언제나 세 단계다', leadsTo: 0 },
          { text: '연결을 강제로 끊으면 다섯 단계다', leadsTo: 4 },
        ],
        rationale:
          '네 단계가 되는 것은 상대의 ACK와 FIN이 따로 나갈 때다. 곧바로 닫으면 한 세그먼트로 합쳐진다.',
      },
      {
        kind: 'boundary',
        stem: 'close()와 shutdown()의 차이는?',
        choices: [
          { text: 'shutdown()은 닫을 방향을 고를 수 있다', correct: true },
          { text: '둘 다 송수신을 함께 끝낸다', leadsTo: 0 },
          { text: 'close()가 더 빨리 끊는다', leadsTo: 4 },
          { text: 'shutdown()은 디스크립터를 반납한다', leadsTo: 1 },
        ],
        rationale:
          'close()는 디스크립터를 반납하고 마지막 참조였다면 송수신이 함께 끝난다. Half-Close는 송신만 닫는 shutdown(SHUT_WR)로 만든다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: 'DNS 질의 시 재귀적 질의와 반복적 질의의 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '재귀적 질의에서 클라이언트가 받는 것은?',
        choices: [
          { text: '캐시된 레코드 목록', leadsTo: 0 },
          { text: '다음에 물어볼 서버의 주소', leadsTo: 2 },
          { text: '중간 단계마다의 응답 전부', leadsTo: 2 },
          { text: '최종 답이나 오류만', correct: true },
        ],
        rationale:
          '중간 과정은 서버가 밟는다. 클라이언트의 부담은 줄지만 질의 처리 부담이 로컬 서버에 모인다.',
      },
      {
        kind: 'misconception',
        stem: '반복적 질의에서 각 단계의 서버는?',
        choices: [
          { text: '모두 최종 답을 갖고 있다', leadsTo: 2 },
          { text: '아는 만큼만 답하고 모르면 더 가까운 곳을 알려준다', correct: true },
          { text: '다음 서버에 직접 물어봐 준다', leadsTo: 2 },
          { text: '캐시에서만 답한다', leadsTo: 0 },
        ],
        rationale:
          '최종 답을 가졌으면 그것을 주고, 모르면 더 가까운 권한 서버의 주소를 알려준다.',
      },
      {
        kind: 'boundary',
        stem: '캐시도 포워더도 없으면?',
        choices: [
          { text: '요청이 루트부터 시작돼 병목이 생긴다', correct: true },
          { text: '질의가 실패한다', leadsTo: 1 },
          { text: '권한 서버가 대신 캐시한다', leadsTo: 0 },
          { text: '아무 차이가 없다', leadsTo: 0 },
        ],
        rationale:
          '로컬 서버는 응답 레코드를 TTL 동안 저장해 다음 질의에 다시 쓴다. 그것이 없으면 매번 루트부터 도는 셈이다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: 'TIME_WAIT 포트 고갈은 어떻게 진단하는가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇을 함께 봐야 하는가?',
        choices: [
          { text: '열려 있는 전체 소켓 수만', leadsTo: 1 },
          { text: '목적지별 소켓 수와 포트 범위, 오류', correct: true },
          { text: '그 시각의 CPU 사용률만', leadsTo: 3 },
          { text: '커널 버전과 배포판만', leadsTo: 0 },
        ],
        rationale:
          'netstat이나 ss로 목적지별로 세고, 포트 범위와 EADDRNOTAVAIL 발생 여부를 함께 본다.',
      },
      {
        kind: 'misconception',
        stem: 'TIME_WAIT 소켓이 많으면 곧 고갈인가?',
        choices: [
          { text: '많으면 곧 고갈이다', leadsTo: 1 },
          { text: '상대가 다르면 같은 포트를 다시 쓸 수 있다', correct: true },
          { text: '포트 범위와 무관하게 고갈된다', leadsTo: 0 },
          { text: '커널이 자동으로 재사용해 문제없다', leadsTo: 0 },
        ],
        rationale:
          '같은 상대에게 쓸 수 있는 포트 조합이 다 차면 새 연결에서 EADDRNOTAVAIL이 난다. 상대가 다르면 같은 포트를 다시 쓸 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '원인이 잦은 재연결이면 무엇부터 보는가?',
        choices: [
          { text: '커널 재사용 옵션', leadsTo: 0 },
          { text: '커넥션 풀과 Keep-Alive', correct: true },
          { text: '소켓 재사용 옵션', leadsTo: 4 },
          { text: '포트 범위 확대', leadsTo: 1 },
        ],
        rationale:
          '커널 설정은 그다음이다. 어떤 프로세스가 능동적 닫기를 주도하는지도 함께 확인해야 한다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: '헬스 체크는 어떤 조건을 검사하는가?',
    items: [
      {
        kind: 'concept',
        stem: '계층에 따라 달라지는 것은?',
        choices: [
          { text: '응답 형식만', leadsTo: 0 },
          { text: '검사 주기만', leadsTo: 1 },
          { text: '검사 대상과 깊이', correct: true },
          { text: '복구 기준만', leadsTo: 2 },
        ],
        rationale:
          'ICMP 응답으로 도달만 보는 것부터 TCP 소켓 연결, 설정한 응답 코드와 애플리케이션 내부 상태까지 깊이가 달라진다.',
      },
      {
        kind: 'misconception',
        stem: 'L4 검사가 성공하면 서비스가 정상인가?',
        choices: [
          { text: '프로세스가 멈췄거나 의존성이 끊겨도 성공할 수 있다', correct: true },
          { text: '정상이다. 연결이 되니까', leadsTo: 3 },
          { text: 'L4는 실패만 알려준다', leadsTo: 0 },
          { text: 'L3보다 항상 정확하다', leadsTo: 3 },
        ],
        rationale:
          'L3과 L4 검사는 단순하고 빠르다. 하지만 프로세스가 밀려 멈췄거나 데이터베이스가 끊겼어도 성공할 수 있는 한계가 있다.',
      },
      {
        kind: 'boundary',
        stem: 'L7 검사 주기를 너무 짧게 두면?',
        choices: [
          { text: '죽은 서버를 못 걸러낸다', leadsTo: 2 },
          { text: '검사 정확도가 떨어진다', leadsTo: 0 },
          { text: '서버 자체에 부담을 준다', correct: true },
          { text: '아무 영향이 없다', leadsTo: 1 },
        ],
        rationale:
          'L7 검사는 특정 엔드포인트로 요청을 보내고 그 엔드포인트가 구현한 범위까지 확인한다. 대신 주기가 짧으면 부담이 된다.',
      },
    ],
  },
  {
    identityScope: 'network',
    question: 'TCP 연결에서 RST 패킷은 어떤 상황에 전송되는가?',
    items: [
      {
        kind: 'concept',
        stem: 'RST가 정상 종료와 다른 점은?',
        choices: [
          { text: '대기 시간 없이 연결을 즉시 파기한다', correct: true },
          { text: '양쪽이 순서대로 닫는다', leadsTo: 0 },
          { text: '남은 데이터를 마저 보낸다', leadsTo: 0 },
          { text: '재전송을 기다린다', leadsTo: 2 },
        ],
        rationale:
          '비정상적인 연결 요청을 받거나 연결을 즉시 끊어야 할 때 나간다. 닫힌 포트로 SYN이 들어오는 경우가 대표적이다.',
      },
      {
        kind: 'misconception',
        stem: '프로세스가 강제로 죽으면 RST가 나가는가?',
        choices: [
          { text: '반드시 RST가 나간다', leadsTo: 0 },
          { text: '상대가 먼저 RST를 보낸다', leadsTo: 4 },
          { text: '아무것도 안 나간다', leadsTo: 4 },
          { text: '커널이 정상 종료 절차를 밟으면 FIN이 나간다', correct: true },
        ],
        rationale:
          'SO_LINGER를 0으로 두고 닫는 것처럼 끊어 내는 방식으로 닫을 때 RST가 나간다.',
      },
      {
        kind: 'boundary',
        stem: 'RST를 받은 쪽은 어떻게 되는가?',
        choices: [
          { text: '대기 상태로 남는다', leadsTo: 2 },
          { text: '남은 데이터를 모두 처리한 뒤 닫는다', leadsTo: 0 },
          { text: '버퍼의 미처리 데이터를 버리고 연결을 해제한다', correct: true },
          { text: '자동으로 재연결한다', leadsTo: 4 },
        ],
        rationale:
          '정상적인 FIN 교환 과정과 달리 즉시 파기하므로 아직 읽지 않은 데이터가 사라진다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: 'equals 재정의 시 hashCode도 바꿔야 하는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: 'HashMap이 값을 찾는 순서는?',
        choices: [
          { text: 'hashCode로 버킷을 정하고 equals로 견준다', correct: true },
          { text: 'equals로 전체를 훑고 hashCode로 정렬한다', leadsTo: 0 },
          { text: 'equals로 하나씩 견줘 찾는다', leadsTo: 0 },
          { text: 'hashCode가 같으면 같은 값으로 본다', leadsTo: 3 },
        ],
        rationale:
          'equals만 재정의하면 논리적으로 같은 두 객체가 서로 다른 버킷으로 흩어진다. equals 비교까지 가지도 못하므로 조회가 실패한다.',
      },
      {
        kind: 'misconception',
        stem: '규약은 어느 방향으로 성립하는가?',
        choices: [
          { text: '둘은 서로 무관하다', leadsTo: 4 },
          { text: 'hashCode가 같으면 equals도 true여야 한다', leadsTo: 0 },
          { text: '양방향으로 모두 성립해야 한다', leadsTo: 0 },
          { text: 'equals가 true면 hashCode도 같아야 한다', correct: true },
        ],
        rationale:
          '규약은 단방향이다. hashCode가 같아도 equals는 false일 수 있고 이게 해시 충돌이다.',
      },
      {
        kind: 'boundary',
        stem: '가변 필드를 hashCode에 쓰면?',
        choices: [
          { text: '아무 문제가 없다', leadsTo: 2 },
          { text: '성능만 조금 떨어진다', leadsTo: 3 },
          { text: '컬렉션이 알아서 다시 계산한다', leadsTo: 2 },
          { text: '컬렉션에 넣은 뒤 그 필드를 바꾸면 다시 찾지 못한다', correct: true },
        ],
        rationale:
          '컬렉션에 넣은 뒤 필드를 바꾸면 그 객체는 사실상 사라진다. JPA 엔티티의 식별자가 영속화 시점에 채워지는 것도 같은 함정이다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: 'setTimeout(0)이 즉시 실행되지 않는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '여기서 0이 뜻하는 것은?',
        choices: [
          { text: '가능한 가장 이른 다음 차례', correct: true },
          { text: '지금 이 자리에서 바로', leadsTo: 0 },
          { text: '0밀리초 뒤 정확히', leadsTo: 0 },
          { text: '우선순위가 가장 높다는 표시', leadsTo: 1 },
        ],
        rationale:
          '콜백이 큐에 들어갈 뿐이고, 지금 돌고 있는 코드가 끝나야 이벤트 루프가 그것을 꺼낸다.',
      },
      {
        kind: 'misconception',
        stem: 'setTimeout(0) 뒤에 등록한 Promise.then은 언제 도는가?',
        choices: [
          { text: '둘은 같은 큐라 순서가 보장되지 않는다', leadsTo: 1 },
          { text: '등록 순서대로 나중에 돈다', leadsTo: 0 },
          { text: '나중에 등록했어도 먼저 돈다', correct: true },
          { text: '동기 코드보다도 먼저 돈다', leadsTo: 0 },
        ],
        rationale:
          '마이크로태스크 큐는 매크로태스크보다 먼저, 그리고 스택이 빌 때마다 전부 비워진다.',
      },
      {
        kind: 'boundary',
        stem: 'setTimeout(0)의 쓸모가 실제로 드러나는 자리는?',
        choices: [
          { text: '애니메이션 프레임을 맞출 때', leadsTo: 3 },
          { text: '가장 빨리 실행하고 싶을 때', leadsTo: 0 },
          { text: '무거운 작업을 잘라 사이사이 화면이 숨 쉬게 할 때', correct: true },
          { text: '서버 응답을 기다릴 때', leadsTo: 4 },
        ],
        rationale:
          '무거운 계산이 한 덩어리로 돌면 그동안 렌더링도 입력도 처리되지 않는다. 작업을 잘라 큐에 나눠 넣으면 사이사이에 화면이 숨을 쉰다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '가비지 컬렉션이 멈춤을 만드는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '수집 중 실행을 세우는 까닭은?',
        choices: [
          { text: '스레드를 새로 만들어야 해서', leadsTo: 1 },
          { text: '메모리를 물리적으로 지워야 해서', leadsTo: 1 },
          { text: '세는 동안 참조 관계가 바뀌면 이미 확인한 것이 틀려져서', correct: true },
          { text: '디스크에 기록해야 해서', leadsTo: 4 },
        ],
        rationale:
          '살아 있는 객체를 세는 동안 애플리케이션이 참조를 바꾸면 앞서 확인한 결과가 무너진다. 그 구간만 실행을 세운다.',
      },
      {
        kind: 'misconception',
        stem: '힙을 키우면 멈춤 문제가 해결되는가?',
        choices: [
          { text: '빈도도 길이도 모두 준다', leadsTo: 2 },
          { text: '빈도는 줄지만 한 번의 멈춤은 길어진다', correct: true },
          { text: '아무 영향이 없다', leadsTo: 2 },
          { text: '젊은 영역만 영향을 받는다', leadsTo: 0 },
        ],
        rationale:
          '총량과 최악값의 맞바꿈이다. 늙은 영역은 대상이 많고 흩어져 있어 한 번 손대면 오래 걸린다.',
      },
      {
        kind: 'boundary',
        stem: '동시 수집기를 쓰면 멈춤이 사라지는가?',
        choices: [
          { text: '오히려 늘어난다', leadsTo: 1 },
          { text: '완전히 사라진다', leadsTo: 1 },
          { text: '줄일 뿐 완전히 없애지는 못한다', correct: true },
          { text: '젊은 영역에서만 사라진다', leadsTo: 0 },
        ],
        rationale:
          '요즘 수집기는 세는 일 대부분을 실행과 겹쳐서 한다. 멈추는 구간을 시작과 끝의 짧은 두 번으로 줄이는 방식이다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '객체와 호출 프레임은 왜 따로 저장하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 기준은?',
        choices: [
          { text: '오래 사는가 짧게 사는가', leadsTo: 0 },
          { text: '크기가 큰가 작은가', leadsTo: 4 },
          { text: '여러 스레드가 공유하는가, 스레드마다 따로인가', correct: true },
          { text: '기본형인가 참조형인가', leadsTo: 3 },
        ],
        rationale:
          '객체는 여러 스레드가 공유할 수 있어 힙에 두고, 호출 프레임은 스레드마다 독립된 실행 상태라 각 JVM 스택에 둔다.',
      },
      {
        kind: 'misconception',
        stem: '호출 프레임도 GC가 회수하는가?',
        choices: [
          { text: '스레드가 끝날 때 한꺼번에 회수된다', leadsTo: 0 },
          { text: '힙 객체와 똑같이 회수된다', leadsTo: 0 },
          { text: '메서드가 끝나면 사라져 별도 회수가 필요 없다', correct: true },
          { text: '수집기 종류에 따라 다르다', leadsTo: 4 },
        ],
        rationale:
          '프레임에는 지역 변수, 피연산자 스택, 반환 정보가 있다. 메서드가 끝나면 프레임이 사라진다.',
      },
      {
        kind: 'boundary',
        stem: '힙 객체는 참조가 끊기면 어떻게 되는가?',
        choices: [
          { text: '영원히 남는다', leadsTo: 1 },
          { text: '즉시 메모리에서 지워진다', leadsTo: 1 },
          { text: '스택으로 옮겨진다', leadsTo: 3 },
          { text: '바로 사라지지 않고 도달 불가 판정 뒤에 회수된다', correct: true },
        ],
        rationale:
          'GC가 도달 불가능하다고 판단한 뒤 회수한다. 참조를 끊는 것과 메모리가 비는 것은 같은 순간이 아니다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '순환 참조 객체도 회수할 수 있는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '생존을 판정하는 기준은?',
        choices: [
          { text: 'GC 루트에서 도달할 수 있는가', correct: true },
          { text: '참조하는 개수가 0인가', leadsTo: 0 },
          { text: '마지막으로 쓰인 지 얼마나 됐는가', leadsTo: 2 },
          { text: '객체 크기가 얼마인가', leadsTo: 4 },
        ],
        rationale:
          '서로 가리켜도 루트에서 닿지 않으면 둘 다 회수 대상이다. 참조 횟수를 세는 방식이 아니라서 순환이 문제가 되지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '서로를 가리키는 두 객체는 어떻게 되는가?',
        choices: [
          { text: '하나만 회수된다', leadsTo: 0 },
          { text: '서로 참조하므로 영원히 남는다', leadsTo: 0 },
          { text: '루트에서 안 닿으면 둘 다 회수된다', correct: true },
          { text: '약한 참조로 바꿔야 회수된다', leadsTo: 1 },
        ],
        rationale:
          '추적식 수집기는 참조 횟수가 아니라 도달 가능성을 본다.',
      },
      {
        kind: 'boundary',
        stem: 'GC 루트에 해당하는 것은?',
        choices: [
          { text: '가장 최근에 만든 객체', leadsTo: 2 },
          { text: '힙에 있는 모든 객체', leadsTo: 0 },
          { text: '실행 중인 스레드의 스택 참조와 정적 참조', correct: true },
          { text: '크기가 가장 큰 객체', leadsTo: 4 },
        ],
        rationale:
          '루트가 살아 있으면 그 경로의 객체도 살아 있다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '수집기는 처리량과 지연 중 무엇으로 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇을 우선할지 정하는 기준은?',
        choices: [
          { text: '배치는 처리량, 응답형 서비스는 최악 지연', correct: true },
          { text: '언제나 처리량이 우선이다', leadsTo: 1 },
          { text: '언제나 짧은 정지가 우선이다', leadsTo: 2 },
          { text: '힙 크기만 보고 정한다', leadsTo: 3 },
        ],
        rationale:
          '힙 크기, CPU 여유, 할당률과 실제 지원 범위도 함께 본다.',
      },
      {
        kind: 'misconception',
        stem: '짧은 정지를 목표로 하는 수집기는 공짜인가?',
        choices: [
          { text: '힙을 줄여도 된다', leadsTo: 3 },
          { text: '아무 대가 없이 정지만 줄인다', leadsTo: 2 },
          { text: '처리량도 함께 올라간다', leadsTo: 0 },
          { text: '장벽 비용과 충분한 힙 여유가 필요하다', correct: true },
        ],
        rationale:
          'ZGC는 표시와 재배치 대부분을 동시에 수행하지만 그만큼 자원을 쓴다. Parallel GC는 처리량이 높은 대신 살아 있는 집합이 크면 정지가 길어진다.',
      },
      {
        kind: 'boundary',
        stem: '고르기 전에 반드시 할 일은?',
        choices: [
          { text: '운영과 같은 부하에서 지연과 처리량을 잰다', correct: true },
          { text: '가장 최신 수집기를 골라 기본값으로 둔다', leadsTo: 2 },
          { text: '힙을 장비가 허용하는 최대로 잡는다', leadsTo: 0 },
          { text: '손대지 않고 기본값을 그대로 쓴다', leadsTo: 4 },
        ],
        rationale:
          'G1은 리전 단위로 수집해 처리량과 정지 목표를 절충한다. 어느 쪽이든 선택 전 같은 부하에서 재 봐야 한다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '왜 모든 바이트코드를 바로 최적화하지 않는가?',
    items: [
      {
        kind: 'concept',
        stem: '전부 최적화하지 않는 까닭은?',
        choices: [
          { text: '시작이 느려지고 실행되지 않을 코드에도 비용을 쓴다', correct: true },
          { text: '최적화가 코드를 망가뜨릴 수 있어서', leadsTo: 2 },
          { text: '메모리가 부족해서', leadsTo: 0 },
          { text: '바이트코드는 최적화할 수 없어서', leadsTo: 1 },
        ],
        rationale:
          '실행 정보를 모아 자주 쓰이는 코드만 기계어로 최적화한다. 계층형 컴파일은 빠른 컴파일과 최고 성능을 절충한다.',
      },
      {
        kind: 'misconception',
        stem: '한 번 최적화된 코드는 그대로 유지되는가?',
        choices: [
          { text: '메서드가 끝나면 버린다', leadsTo: 3 },
          { text: '한 번 만들면 끝까지 쓴다', leadsTo: 2 },
          { text: '주기적으로 다시 컴파일한다', leadsTo: 0 },
          { text: '관찰에 기댄 가정이 깨지면 폐기하고 되돌린다', correct: true },
        ],
        rationale:
          'JIT는 관찰된 타입을 바탕으로 가상 호출을 인라이닝할 수 있다. 가정이 깨지면 최적화 코드를 폐기하고 디옵티마이즈한다.',
      },
      {
        kind: 'boundary',
        stem: '짧은 벤치마크가 잘못 읽히는 이유는?',
        choices: [
          { text: '측정 단위가 너무 커서', leadsTo: 0 },
          { text: '워밍업과 컴파일 시간이 측정에 섞인다', correct: true },
          { text: 'GC가 항상 끼어들어서', leadsTo: 3 },
          { text: '인라이닝이 일어나지 않아서', leadsTo: 1 },
        ],
        rationale:
          'JMH처럼 워밍업과 측정을 분리해야 한다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: '이름이 같은 클래스가 다른 타입이 되는 조건은?',
    items: [
      {
        kind: 'concept',
        stem: '런타임 타입을 정하는 것은?',
        choices: [
          { text: '바이너리 이름만', leadsTo: 0 },
          { text: '바이너리 이름과 정의한 클래스 로더의 조합', correct: true },
          { text: '패키지 경로만', leadsTo: 4 },
          { text: '클래스 파일의 위치', leadsTo: 3 },
        ],
        rationale:
          '이름이 같아도 정의한 클래스 로더가 다르면 다른 타입으로 본다.',
      },
      {
        kind: 'misconception',
        stem: '다른 로더가 만든 같은 이름의 객체는?',
        choices: [
          { text: '이름이 같아도 캐스팅할 수 없다', correct: true },
          { text: '이름이 같으니 캐스팅된다', leadsTo: 0 },
          { text: '리플렉션으로는 캐스팅된다', leadsTo: 1 },
          { text: '부모 로더를 거치면 캐스팅된다', leadsTo: 0 },
        ],
        rationale:
          '부모 우선 위임은 이미 로드된 핵심 클래스의 중복 정의를 막는다. 플러그인과 서버는 격리를 위해 이 순서를 일부러 뒤집기도 한다.',
      },
      {
        kind: 'boundary',
        stem: '클래스가 언로드되지 않는 때는?',
        choices: [
          { text: '로더가 실행 중인 스레드나 외부 정적 참조에 붙잡혀 있을 때', correct: true },
          { text: '인스턴스가 하나라도 있을 때', leadsTo: 3 },
          { text: '정적 초기화가 끝나지 않았을 때', leadsTo: 2 },
          { text: '언로드는 원래 일어나지 않는다', leadsTo: 3 },
        ],
        rationale:
          '로더가 살아 있으면 그 로더가 정의한 클래스도 함께 남는다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '서로 다른 List 타입 인자는 런타임에 남는가?',
    items: [
      {
        kind: 'concept',
        stem: '타입 인자가 다른 두 List는 런타임에?',
        choices: [
          { text: '실행할 때마다 달라진다', leadsTo: 3 },
          { text: '서로 다른 클래스다', leadsTo: 4 },
          { text: '인자 개수에 따라 다르다', leadsTo: 1 },
          { text: '같은 클래스다', correct: true },
        ],
        rationale:
          '컴파일러가 타입 안전성을 검사한 뒤 타입 인자를 소거한다. 형변환은 필요한 곳에 삽입된다.',
      },
      {
        kind: 'misconception',
        stem: '리플렉션으로 객체의 타입 인자를 알 수 있는가?',
        choices: [
          { text: '배열로 만들면 읽을 수 있다', leadsTo: 1 },
          { text: '언제나 읽을 수 있다', leadsTo: 3 },
          { text: '아무 제네릭 정보도 남지 않는다', leadsTo: 3 },
          { text: '선언 정보는 읽지만 객체의 실제 인자는 복원하지 못한다', correct: true },
        ],
        rationale:
          '필드와 메서드 선언의 제네릭 시그니처는 클래스 파일에 남을 수 있다. 그러나 그것은 선언이지 객체의 상태가 아니다.',
      },
      {
        kind: 'boundary',
        stem: '소거 때문에 막히는 것은?',
        choices: [
          { text: '물음표를 쓰는 와일드카드', leadsTo: 2 },
          { text: '타입 변수를 두는 제네릭 메서드', leadsTo: 0 },
          { text: '타입 인자를 붙인 instanceof 검사', correct: true },
          { text: '부모에게서 상속받은 제네릭 타입', leadsTo: 0 },
        ],
        rationale:
          '타입 변수의 직접 인스턴스화와 배열 생성도 제한되고, 소거형이 같은 메서드를 오버로드할 수도 없다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '상태 변경을 막으면 동시성에서 무엇을 얻는가?',
    items: [
      {
        kind: 'concept',
        stem: '불변으로 두면 얻는 것은?',
        choices: [
          { text: '실행 속도가 항상 빨라진다', leadsTo: 3 },
          { text: '메모리를 덜 쓴다', leadsTo: 3 },
          { text: '잠금 없이 여러 스레드가 공유하기 쉬워진다', correct: true },
          { text: '가비지 컬렉션이 필요 없어진다', leadsTo: 3 },
        ],
        rationale:
          '해시 키도 안정된다. 대신 변경마다 새 객체가 필요하다.',
      },
      {
        kind: 'misconception',
        stem: '필드를 private final로 두면 불변인가?',
        choices: [
          { text: '그것으로 충분하다', leadsTo: 0 },
          { text: '부족하다. 가변 인자와 내부 컬렉션을 복사해야 한다', correct: true },
          { text: '필드가 기본형일 때만 충분하다', leadsTo: 2 },
          { text: '생성자만 private이면 된다', leadsTo: 0 },
        ],
        rationale:
          '생성자에서 가변 인자를 복사하고 내부 배열과 컬렉션도 방어적 복사로 반환해야 한다.',
      },
      {
        kind: 'boundary',
        stem: 'final 필드의 초기화 안전성이 깨지는 때는?',
        choices: [
          { text: '필드가 여러 개일 때', leadsTo: 1 },
          { text: '생성 중 this가 외부로 노출될 때', correct: true },
          { text: '상속받았을 때', leadsTo: 2 },
          { text: '깨지는 경우가 없다', leadsTo: 1 },
        ],
        rationale:
          'final 필드는 생성자 종료 뒤 초기화 안전성을 제공한다. 그 전에 참조가 새 나가면 보장이 성립하지 않는다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '동등한 객체의 해시값도 같아야 하는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: 'equals가 지켜야 하는 성질은?',
        choices: [
          { text: '반사성·대칭성·추이성·일관성, 그리고 null에는 거짓', correct: true },
          { text: '대칭성 하나면 된다', leadsTo: 2 },
          { text: '순서를 매길 수 있어야 한다', leadsTo: 4 },
          { text: '항상 모든 필드를 비교해야 한다', leadsTo: 3 },
        ],
        rationale:
          'hashCode는 동등하면 같아야 하지만 충돌은 허용된다.',
      },
      {
        kind: 'misconception',
        stem: 'hashCode는 equals가 쓰는 필드를 모두 써야 하는가?',
        choices: [
          { text: '항상 한 필드만 써야 한다', leadsTo: 0 },
          { text: '반드시 같은 필드를 모두 써야 한다', leadsTo: 3 },
          { text: '더 적게 써도 동등하면 같기만 하면 된다', correct: true },
          { text: '필드와 무관하게 상수를 써도 좋다', leadsTo: 0 },
        ],
        rationale:
          '규약이 요구하는 것은 동등한 객체의 해시값이 같다는 조건 하나다. 다만 상수를 쓰면 모든 키가 한 버킷에 몰린다.',
      },
      {
        kind: 'boundary',
        stem: '상속 계층에서 값 동등성을 더하면 흔히 깨지는 것은?',
        choices: [
          { text: '반사성', leadsTo: 0 },
          { text: '대칭성', correct: true },
          { text: '일관성', leadsTo: 1 },
          { text: '깨지는 것이 없다', leadsTo: 2 },
        ],
        rationale:
          '값 객체는 불변으로 만들고 두 메서드를 같은 필드에서 함께 생성하는 편이 안전하다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '체크 예외는 언제 API 계약에 넣는가?',
    items: [
      {
        kind: 'concept',
        stem: '체크 예외를 계약에 넣는 기준은?',
        choices: [
          { text: '호출자가 복구 전략을 세울 수 있을 때', correct: true },
          { text: '오류가 심각할 때', leadsTo: 4 },
          { text: '내부 구현이 바뀔 수 있을 때', leadsTo: 0 },
          { text: '예외가 자주 날 때', leadsTo: 3 },
        ],
        rationale:
          '프로그래밍 오류에는 런타임 예외가 맞다. 컴파일러가 처리·선언을 강제하는 쪽은 예측 가능한 복구에 어울린다.',
      },
      {
        kind: 'misconception',
        stem: '체크 예외를 넓게 쓰면 더 안전해지는가?',
        choices: [
          { text: '처리를 강제하니 넓게 쓸수록 안전하다', leadsTo: 3 },
          { text: '계층마다 의미 없는 catch가 퍼진다', correct: true },
          { text: '스택 추적 비용으로 성능만 조금 나빠진다', leadsTo: 2 },
          { text: '컴파일러가 알아서 걸러 준다', leadsTo: 0 },
        ],
        rationale:
          '복구할 수 없으면 도메인 런타임 예외로 번역하되 원인을 보존한다.',
      },
      {
        kind: 'boundary',
        stem: '경계에서 예외를 번역할 때 반드시 할 일은?',
        choices: [
          { text: '원인을 보존한다', correct: true },
          { text: '메시지를 지운다', leadsTo: 1 },
          { text: 'Error로 바꾼다', leadsTo: 4 },
          { text: '스택 트레이스를 새로 만든다', leadsTo: 1 },
        ],
        rationale:
          '예외를 경계에서 번역하면 저장소나 네트워크 구현을 API 밖으로 숨길 수 있다. 메시지와 원인, 복구 가능 여부를 계약에 명확히 둔다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '중간 연산을 바로 실행하지 않는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '미뤄서 얻는 것은?',
        choices: [
          { text: '자동으로 병렬 처리된다', leadsTo: 2 },
          { text: '메모리를 항상 덜 쓴다', leadsTo: 0 },
          { text: '여러 중간 연산을 한 번의 순회로 결합한다', correct: true },
          { text: '순서가 보장된다', leadsTo: 3 },
        ],
        rationale:
          '종료 연산이 요구할 때까지 미루면 단계를 합칠 수 있고, 단락 종료로 필요한 원소만 처리할 수도 있다.',
      },
      {
        kind: 'misconception',
        stem: '지연 실행이면 버퍼를 안 쓰는가?',
        choices: [
          { text: '지연이면 절대 버퍼를 쓰지 않는다', leadsTo: 0 },
          { text: '상태 있는 연산은 지연이어도 버퍼를 쓸 수 있다', correct: true },
          { text: '모든 연산이 버퍼를 쓴다', leadsTo: 0 },
          { text: '병렬일 때만 버퍼를 쓴다', leadsTo: 2 },
        ],
        rationale:
          'filter와 map 같은 상태 없는 연산은 원소 하나씩 이어서 처리하지만, sorted와 distinct는 앞선 원소를 들고 있어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '무한 스트림이 유한 시간에 끝나려면?',
        choices: [
          { text: '중간 연산 개수를 줄이면 된다', leadsTo: 0 },
          { text: '병렬로 돌리면 된다', leadsTo: 2 },
          { text: '무한 스트림은 언제나 끝나지 않는다', leadsTo: 1 },
          { text: '전체 입력을 요구하는 연산 없이 단락 종료가 걸려야 한다', correct: true },
        ],
        rationale:
          'findFirst와 anyMatch는 답이 정해지면 순회를 멈춘다. 그 앞에 sorted 같은 연산이 있으면 전체를 요구한다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '락보다 높은 수준의 도구를 먼저 고르는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '높은 수준 도구를 먼저 보는 까닭은?',
        choices: [
          { text: '언제나 더 빠르기 때문', leadsTo: 3 },
          { text: '검증된 원자 연산과 대기 정책을 재사용해 위험을 줄인다', correct: true },
          { text: '메모리를 덜 쓰기 때문', leadsTo: 3 },
          { text: '락은 더 이상 쓰이지 않기 때문', leadsTo: 4 },
        ],
        rationale:
          '작업 성격에 맞는 가장 높은 수준의 도구를 고르면 경쟁 조건과 교착 위험이 준다.',
      },
      {
        kind: 'misconception',
        stem: '동시 컬렉션에서 get 뒤 put은 안전한가?',
        choices: [
          { text: '동시 컬렉션이니 안전하다', leadsTo: 0 },
          { text: '두 번의 연산이라 그 사이에 경쟁이 생긴다', correct: true },
          { text: '값이 작으면 안전하다', leadsTo: 1 },
          { text: '같은 스레드면 안전하다', leadsTo: 0 },
        ],
        rationale:
          'ConcurrentHashMap의 computeIfAbsent처럼 의도를 한 원자 연산으로 표현해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '원자 변수로 부족해지는 지점은?',
        choices: [
          { text: '값이 정수가 아닐 때', leadsTo: 1 },
          { text: '여러 필드에 걸친 불변식을 함께 지켜야 할 때', correct: true },
          { text: '스레드가 넷을 넘을 때', leadsTo: 3 },
          { text: '읽기가 쓰기보다 많을 때', leadsTo: 4 },
        ],
        rationale:
          'AtomicInteger는 한 값의 갱신에는 맞지만 여러 필드를 한 묶음으로 지키지 못한다. 그런 경우 임계 구역이 필요하다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: 'volatile은 무엇을 보장하고 놓치는가?',
    items: [
      {
        kind: 'concept',
        stem: 'volatile이 보장하는 것은?',
        choices: [
          { text: '교착 상태 예방', leadsTo: 1 },
          { text: '복합 연산의 원자성', leadsTo: 3 },
          { text: '해당 접근을 경계로 한 가시성과 재정렬 제약', correct: true },
          { text: '스레드 수 제한', leadsTo: 1 },
        ],
        rationale:
          'volatile 쓰기는 뒤따르는 같은 변수의 읽기보다 먼저 일어난다. 다만 복합 연산을 원자화하지는 않는다.',
      },
      {
        kind: 'misconception',
        stem: 'volatile 변수에 count++는 안전한가?',
        choices: [
          { text: 'volatile이므로 안전하다', leadsTo: 3 },
          { text: '읽기·계산·쓰기 세 단계라 갱신을 잃을 수 있다', correct: true },
          { text: '한 줄이라 원자적이다', leadsTo: 3 },
          { text: '스레드가 둘 이하면 안전하다', leadsTo: 0 },
        ],
        rationale:
          '경쟁 갱신에는 AtomicInteger나 잠금이 필요하다.',
      },
      {
        kind: 'boundary',
        stem: 'volatile 쓰기 앞의 일반 쓰기는 어떻게 되는가?',
        choices: [
          { text: '순서가 뒤바뀐다', leadsTo: 1 },
          { text: '보이지 않는다', leadsTo: 0 },
          { text: 'volatile 필드만 보인다', leadsTo: 0 },
          { text: '그 값을 읽은 스레드에 함께 보인다', correct: true },
        ],
        rationale:
          '이 happens-before 관계가 다른 상태의 전달까지 만든다. 완전히 생성된 객체 참조를 게시할 때 쓰는 이유다.',
      },
    ],
  },
  {
    identityScope: 'python',
    question: '스레드를 늘려도 CPU 병렬성이 없는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '스레드를 늘려도 안 빨라지는 까닭은?',
        choices: [
          { text: '메모리가 부족해서', leadsTo: 2 },
          { text: '스레드 생성 비용이 커서', leadsTo: 2 },
          { text: '코어가 부족해서', leadsTo: 2 },
          { text: '한 시점에 스레드 하나만 바이트코드를 실행한다', correct: true },
        ],
        rationale:
          'CPU 연산 스레드를 늘리면 GIL 경합과 전환 비용만 커질 수 있다. 늘린 만큼 기다리는 줄만 길어진다.',
      },
      {
        kind: 'misconception',
        stem: 'GIL이 있으면 데이터 경쟁도 막아 주는가?',
        choices: [
          { text: '모든 경쟁을 막아 준다', leadsTo: 3 },
          { text: '복합 연산의 논리적 경쟁은 막지 못한다', correct: true },
          { text: '읽기 경쟁만 막는다', leadsTo: 3 },
          { text: '멀티프로세스에서만 경쟁이 생긴다', leadsTo: 2 },
        ],
        rationale:
          '공유 상태는 GIL과 별개로 따로 동기화해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '스레드가 효과를 내는 작업은?',
        choices: [
          { text: '모든 종류의 작업', leadsTo: 0 },
          { text: '순수 CPU 연산', leadsTo: 2 },
          { text: '대기가 긴 I/O와 GIL을 놓는 네이티브 확장', correct: true },
          { text: '효과를 내는 작업이 없다', leadsTo: 1 },
        ],
        rationale:
          '대기하는 많은 I/O 호출과 일부 네이티브 확장은 GIL을 놓는다. 그래서 그 구간은 스레드로도 겹쳐 실행된다.',
      },
    ],
  },
  {
    identityScope: 'python',
    question: '참조 횟수가 0이 아닌 객체도 왜 수거되는가?',
    items: [
      {
        kind: 'concept',
        stem: '참조 카운팅만으로 못 푸는 것은?',
        choices: [
          { text: '큰 객체', leadsTo: 1 },
          { text: '서로를 가리키는 순환', correct: true },
          { text: '전역 변수', leadsTo: 0 },
          { text: '지역 변수', leadsTo: 0 },
        ],
        rationale:
          '외부에서 닿지 않는 순환은 별도 순환 수집기가 찾아 수거한다.',
      },
      {
        kind: 'misconception',
        stem: '자동 순환 수집을 끄면 메모리 회수가 멈추는가?',
        choices: [
          { text: '참조 카운팅은 계속 동작한다', correct: true },
          { text: '모든 회수가 멈춘다', leadsTo: 2 },
          { text: '즉시 메모리가 새기 시작한다', leadsTo: 2 },
          { text: '수집기가 다시 켜진다', leadsTo: 2 },
        ],
        rationale:
          '수집 빈도를 낮추면 정지는 줄지만 순환 객체의 메모리 회수는 늦어진다.',
      },
      {
        kind: 'boundary',
        stem: '순환 수집기가 회수를 정하는 기준은?',
        choices: [
          { text: '외부에서 도달할 수 없는가', correct: true },
          { text: '참조 수가 0인가', leadsTo: 0 },
          { text: '생성된 지 오래됐는가', leadsTo: 1 },
          { text: '크기가 큰가', leadsTo: 1 },
        ],
        rationale:
          '추적 대상 컨테이너를 세대별 정책으로 검사한다. 오래 살아남은 객체는 덜 자주 본다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: 'Promise와 타이머 중 무엇이 먼저 실행되는가?',
    items: [
      {
        kind: 'concept',
        stem: '같은 턴에 예약됐을 때 순서는?',
        choices: [
          { text: 'Promise 콜백이 타이머보다 먼저', correct: true },
          { text: '타이머가 먼저', leadsTo: 2 },
          { text: '예약한 순서대로', leadsTo: 2 },
          { text: '매번 달라진다', leadsTo: 3 },
        ],
        rationale:
          '현재 태스크가 끝난 뒤 마이크로태스크 큐를 비우고, 그 다음에 타이머 태스크를 하나 꺼낸다.',
      },
      {
        kind: 'misconception',
        stem: 'await 뒤의 코드는 어느 큐로 재개되는가?',
        choices: [
          { text: '마이크로태스크로 재개된다', correct: true },
          { text: '타이머와 같은 태스크로 재개된다', leadsTo: 3 },
          { text: '동기적으로 이어진다', leadsTo: 0 },
          { text: '렌더링 뒤에 재개된다', leadsTo: 0 },
        ],
        rationale:
          'Promise.then과 queueMicrotask도 마이크로태스크다. setTimeout 콜백만 태스크다.',
      },
      {
        kind: 'boundary',
        stem: '마이크로태스크가 계속 새 작업을 넣으면?',
        choices: [
          { text: '렌더링과 타이머가 굶는다', correct: true },
          { text: '자동으로 중단된다', leadsTo: 0 },
          { text: '타이머가 우선권을 가져간다', leadsTo: 2 },
          { text: '아무 영향이 없다', leadsTo: 4 },
        ],
        rationale:
          '마이크로태스크 큐는 비워질 때까지 렌더링 기회로 넘어가지 않는다. 긴 동기 코드도 같은 결과를 만든다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '함수가 끝난 뒤 지역 변수가 남는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '변수가 남는 까닭은?',
        choices: [
          { text: '전역으로 옮겨져서', leadsTo: 2 },
          { text: '내부 함수가 그 렉시컬 환경을 계속 참조해서', correct: true },
          { text: '가비지 컬렉터가 지역 변수를 못 봐서', leadsTo: 3 },
          { text: '값이 상수로 바뀌어서', leadsTo: 0 },
        ],
        rationale:
          '바깥 함수 호출이 끝나도 내부 함수가 살아 있으면 캡처한 바인딩도 유지된다.',
      },
      {
        kind: 'misconception',
        stem: '클로저가 잡는 것은 값인가 바인딩인가?',
        choices: [
          { text: '만든 시점의 복사본이다', leadsTo: 0 },
          { text: '바인딩이라 나중 변경도 함께 본다', correct: true },
          { text: '원시값만 복사한다', leadsTo: 1 },
          { text: '호출할 때마다 새로 읽는다', leadsTo: 1 },
        ],
        rationale:
          '같은 바인딩을 공유한 함수들은 변경을 함께 본다. let의 블록별 바인딩이 루프 문제를 피하는 이유가 여기 있다.',
      },
      {
        kind: 'boundary',
        stem: '클로저가 메모리에 부담이 되는 때는?',
        choices: [
          { text: '큰 객체를 캡처한 채 리스너나 타이머가 남아 있을 때', correct: true },
          { text: '함수가 작을 때', leadsTo: 2 },
          { text: '중첩이 두 단계를 넘을 때', leadsTo: 0 },
          { text: '부담이 되는 경우가 없다', leadsTo: 3 },
        ],
        rationale:
          '참조된 객체는 도달 가능한 동안 메모리에 남는다. 이벤트 리스너와 타이머를 해제해 불필요한 참조를 끊어야 한다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '속성이 없을 때 엔진은 어디까지 찾는가?',
    items: [
      {
        kind: 'concept',
        stem: '자체 속성에 없으면 어디를 보는가?',
        choices: [
          { text: '같은 파일의 다른 객체', leadsTo: 1 },
          { text: '전역 객체', leadsTo: 3 },
          { text: '프로토타입을 따라 null에 닿을 때까지', correct: true },
          { text: '더 찾지 않고 바로 오류를 낸다', leadsTo: 0 },
        ],
        rationale:
          '체인의 끝인 null에 닿으면 undefined가 된다.',
      },
      {
        kind: 'misconception',
        stem: '속성 대입은 언제나 자체 속성을 만드는가?',
        choices: [
          { text: '언제나 자체 속성을 만든다', leadsTo: 4 },
          { text: '상속된 setter가 있으면 결과가 달라진다', correct: true },
          { text: '언제나 프로토타입을 고친다', leadsTo: 1 },
          { text: '읽을 때와 똑같은 경로를 그대로 탄다', leadsTo: 0 },
        ],
        rationale:
          '하위 객체에 같은 키가 있으면 상속 속성을 가린다. 다만 대입 경로는 읽기와 규칙이 다르다.',
      },
      {
        kind: 'boundary',
        stem: 'class의 static 메서드는 어디에 놓이는가?',
        choices: [
          { text: '전역 객체', leadsTo: 3 },
          { text: 'prototype', leadsTo: 2 },
          { text: '인스턴스마다 하나씩', leadsTo: 2 },
          { text: '클래스 생성자 자체', correct: true },
        ],
        rationale:
          '인스턴스 메서드는 prototype에 둔다. 각 위치에서 같은 속성 탐색 규칙을 따른다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: 'let도 끌어올려지는데 왜 바로 읽지 못하는가?',
    items: [
      {
        kind: 'concept',
        stem: '스코프 시작 시점의 let 바인딩 상태는?',
        choices: [
          { text: '만들어졌지만 초기화되지 않았다', correct: true },
          { text: 'undefined로 초기화됐다', leadsTo: 0 },
          { text: '아직 존재하지 않는다', leadsTo: 1 },
          { text: '선언한 값으로 채워져 있다', leadsTo: 1 },
        ],
        rationale:
          '선언문을 평가하기 전에는 초기화되지 않는다. 이 시간적 사각지대에서 읽으면 ReferenceError가 난다. var는 undefined로 초기화된다는 점이 다르다.',
      },
      {
        kind: 'misconception',
        stem: '호이스팅은 코드를 위로 옮기는가?',
        choices: [
          { text: '실제로 소스가 위로 이동한다', leadsTo: 1 },
          { text: '옮기지 않는다. 선언 등록과 초기화 시점을 설명하는 모델이다', correct: true },
          { text: 'var만 이동한다', leadsTo: 0 },
          { text: '컴파일러가 파일을 다시 쓴다', leadsTo: 4 },
        ],
        rationale:
          '실행 컨텍스트를 만들 때 선언을 등록하고 각 종류의 초기화 시점을 달리한다.',
      },
      {
        kind: 'boundary',
        stem: '사각지대의 let에 typeof를 쓰면?',
        choices: [
          { text: '선언한 타입이 나온다', leadsTo: 1 },
          { text: 'undefined가 나온다', leadsTo: 3 },
          { text: '"let"이 나온다', leadsTo: 3 },
          { text: 'ReferenceError가 난다', correct: true },
        ],
        rationale:
          '아예 선언되지 않은 이름에 typeof를 썼을 때 undefined가 나오는 것과 다르다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '같은 함수를 불렀는데 this가 달라지는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '일반 함수의 this를 정하는 것은?',
        choices: [
          { text: '파일의 모듈 종류', leadsTo: 3 },
          { text: '함수를 정의한 위치', leadsTo: 4 },
          { text: '호출 형태', correct: true },
          { text: '선언 순서', leadsTo: 0 },
        ],
        rationale:
          '메서드 호출과 일반 호출은 수신자가 다르다. 화살표 함수만 바깥 this를 캡처한다.',
      },
      {
        kind: 'misconception',
        stem: '객체에서 메서드를 떼어 콜백으로 넘기면?',
        choices: [
          { text: '수신자 정보가 사라진다', correct: true },
          { text: '원래 객체가 그대로 따라간다', leadsTo: 2 },
          { text: '자동으로 bind된다', leadsTo: 0 },
          { text: '오류가 나서 넘길 수 없다', leadsTo: 2 },
        ],
        rationale:
          'bind로 고정하거나 수신자를 보존하는 래퍼를 써야 한다.',
      },
      {
        kind: 'boundary',
        stem: '화살표 함수로 할 수 없는 것은?',
        choices: [
          { text: '매개변수로 인자를 받는 것', leadsTo: 1 },
          { text: '다른 함수에 콜백으로 넘기는 것', leadsTo: 2 },
          { text: '계산한 값을 반환하는 것', leadsTo: 1 },
          { text: 'call로 this를 바꾸거나 new로 만드는 것', correct: true },
        ],
        rationale:
          '화살표 함수에는 자체 this와 arguments가 없다. 동적 수신자가 필요한 메서드에는 일반 함수가 맞다.',
      },
    ],
  },
  {
    identityScope: 'typescript',
    question: '이름이 다른 두 타입이 호환되는 기준은?',
    items: [
      {
        kind: 'concept',
        stem: '호환을 판정하는 기준은?',
        choices: [
          { text: '같은 인터페이스를 구현한다고 적었는가', leadsTo: 2 },
          { text: '같은 이름으로 선언됐는가', leadsTo: 2 },
          { text: '같은 파일에 있는가', leadsTo: 2 },
          { text: '대상이 요구하는 멤버를 갖췄는가', correct: true },
        ],
        rationale:
          '이름이나 선언 계보가 달라도 구조가 맞으면 대입할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '속성이 더 많으면 대입이 막히는가?',
        choices: [
          { text: '대체로 허용된다. 새 객체 리터럴을 바로 넣을 때만 검사한다', correct: true },
          { text: '언제나 막힌다. 속성 수가 다르면 대입이 안 된다', leadsTo: 0 },
          { text: '언제나 허용된다. 속성 수는 검사하지 않는다', leadsTo: 0 },
          { text: '선택 속성으로 선언한 경우에만 허용된다', leadsTo: 1 },
        ],
        rationale:
          '초과 속성 검사는 오타 가능성을 잡으려고 리터럴을 바로 대입하는 자리에만 걸린다.',
      },
      {
        kind: 'boundary',
        stem: '구조가 우연히 같은 식별자 타입을 가르려면?',
        choices: [
          { text: '가를 방법이 없다', leadsTo: 2 },
          { text: '이름만 다르게 짓는다', leadsTo: 0 },
          { text: 'readonly를 붙인다', leadsTo: 3 },
          { text: '브랜드 필드를 더해 명목적 구분을 흉내 낸다', correct: true },
        ],
        rationale:
          '타입 검사는 컴파일 시 사라진다. 외부 입력의 실제 구조는 런타임 검증이 따로 필요하다.',
      },
    ],
  },
  {
    identityScope: 'kotlin',
    question: '널 검사를 했는데도 안전 호출이 필요한 때는?',
    items: [
      {
        kind: 'concept',
        stem: '스마트 캐스트가 보장되지 않는 조건은?',
        choices: [
          { text: '검사를 두 번 했을 때', leadsTo: 4 },
          { text: '값이 원시 타입일 때', leadsTo: 1 },
          { text: '함수가 길 때', leadsTo: 2 },
          { text: '검사와 사용 사이에 값이 바뀔 수 있을 때', correct: true },
        ],
        rationale:
          '지역 val로 고정하거나 안전 호출로 접근해야 한다. getter 결과가 달라질 수 있는 프로퍼티가 대표적이다.',
      },
      {
        kind: 'misconception',
        stem: 'Java에서 온 값의 널 가능성은?',
        choices: [
          { text: '항상 널 가능으로 확정된다', leadsTo: 0 },
          { text: '항상 널이 아닌 것으로 확정된다', leadsTo: 0 },
          { text: '플랫폼 타입이라 타입에 확정되지 않는다', correct: true },
          { text: '컴파일러가 자동으로 검사를 넣는다', leadsTo: 1 },
        ],
        rationale:
          '경계에서 어노테이션과 검증으로 불확실성을 좁혀야 내부의 널 안전성이 유지된다.',
      },
      {
        kind: 'boundary',
        stem: '안전 호출을 길게 잇는 방식의 문제는?',
        choices: [
          { text: '성능이 크게 나빠진다', leadsTo: 1 },
          { text: '실패 원인을 숨긴다', correct: true },
          { text: '컴파일이 안 된다', leadsTo: 2 },
          { text: '문제가 없다', leadsTo: 4 },
        ],
        rationale:
          '반드시 있어야 하는 값은 초기에 검사하고 의미 있는 오류로 바꾸는 편이 낫다.',
      },
    ],
  },
  {
    identityScope: 'types',
    question: '대입 뒤 한쪽을 바꿀 때 결과가 갈리는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '참조 타입을 대입하면 복사되는 것은?',
        choices: [
          { text: '같은 객체를 가리키는 참조', correct: true },
          { text: '객체 전체', leadsTo: 1 },
          { text: '객체의 첫 필드만', leadsTo: 1 },
          { text: '아무것도 복사되지 않는다', leadsTo: 0 },
        ],
        rationale:
          '값 타입 대입은 값 자체를 복사한다. 값 안의 참조 필드는 여전히 같은 객체를 가리킬 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '값 의미론과 참조 의미론은 저장 위치와 같은 구분인가?',
        choices: [
          { text: '언어마다 항상 스택에만 둔다', leadsTo: 4 },
          { text: '같다. 값은 스택, 참조는 힙이다', leadsTo: 0 },
          { text: '다르다. 값도 힙에 놓일 수 있다', correct: true },
          { text: '컴파일러가 정하므로 구분이 없다', leadsTo: 0 },
        ],
        rationale:
          '값도 최적화나 캡처에 따라 힙에 놓일 수 있고, 참조 값 자체는 스택 프레임에 놓일 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '인자를 항상 값으로 전달하는 언어에서 호출자가 보는 것은?',
        choices: [
          { text: '변경도 재대입도 모두 보인다', leadsTo: 0 },
          { text: '같은 객체의 변경은 보지만 재대입은 안 보인다', correct: true },
          { text: '둘 다 안 보인다', leadsTo: 1 },
          { text: '재대입만 보인다', leadsTo: 0 },
        ],
        rationale:
          '객체 참조 값을 복사해 넘기기 때문이다. 참조를 통한 변경은 공유되지만 변수 자체를 바꾸는 것은 지역적이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '고정 소수점과 부동 소수점은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 기준은?',
        choices: [
          { text: '비트 수가 몇인가', leadsTo: 1 },
          { text: '정수인가 실수인가', leadsTo: 1 },
          { text: '소수점 위치를 고정하는가, 값에 따라 옮기는가', correct: true },
          { text: '하드웨어가 지원하는가', leadsTo: 3 },
        ],
        rationale:
          '고정 소수점은 정수부와 소수부의 비트 수를 미리 정해둔다. 부동 소수점은 가수부와 지수부를 나눈다.',
      },
      {
        kind: 'misconception',
        stem: '2진 부동 소수점으로 정확히 표현되는 값은?',
        choices: [
          { text: '비트를 늘리면 모두 정확해진다', leadsTo: 1 },
          { text: '10진 소수는 모두 정확하다', leadsTo: 0 },
          { text: '10진 소수는 모두 부정확하다', leadsTo: 0 },
          { text: '0.5는 정확하지만 0.1은 아니다', correct: true },
        ],
        rationale:
          '10진 소수 가운데 2진수로 딱 떨어지지 않는 것이 있다. 그 자리에서 반올림 오차가 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '금융 계산에서 고르는 쪽은?',
        choices: [
          { text: '고정 소수점이나 임의 정밀도 타입', correct: true },
          { text: '더 넓은 부동 소수점', leadsTo: 0 },
          { text: '정수만 쓴다', leadsTo: 2 },
          { text: '어느 쪽이든 상관없다', leadsTo: 0 },
        ],
        rationale:
          '오차를 허용하기 어려운 곳에서는 표현 범위보다 정확성이 먼저다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: 'volatile 키워드는 가시성 문제를 어떻게 해결하는가?',
    items: [
      {
        kind: 'concept',
        stem: '가시성 문제가 생기는 까닭은?',
        choices: [
          { text: '컴파일러가 변수를 지워서', leadsTo: 0 },
          { text: '스레드가 너무 많아서', leadsTo: 4 },
          { text: '메모리가 부족해서', leadsTo: 4 },
          { text: '각 스레드가 값을 캐시에 복사해 쓰기 때문', correct: true },
        ],
        rationale:
          '여러 스레드가 같은 변수를 수정할 때 각자 캐시만 보면 다른 값을 가지게 된다.',
      },
      {
        kind: 'misconception',
        stem: 'volatile을 붙여도 캐시는 그대로 쓰이는가?',
        choices: [
          { text: '아니다. 캐시를 완전히 우회한다', leadsTo: 4 },
          { text: '그렇다. 메모리 장벽으로 가시성과 순서만 강제한다', correct: true },
          { text: '아니다. 캐시를 매번 비운다', leadsTo: 4 },
          { text: '아니다. 캐시를 읽기 전용으로 만든다', leadsTo: 0 },
        ],
        rationale:
          '캐시를 실제로 어떻게 다룰지는 JVM과 CPU가 정한다.',
      },
      {
        kind: 'boundary',
        stem: 'volatile로 해결되지 않는 것은?',
        choices: [
          { text: '값의 가시성', leadsTo: 0 },
          { text: '읽기·수정·쓰기로 나뉘는 연산의 원자성', correct: true },
          { text: '명령 재정렬', leadsTo: 0 },
          { text: '해결되지 않는 것이 없다', leadsTo: 2 },
        ],
        rationale:
          'count++ 같은 연산은 세 단계로 나뉘어 여전히 데이터 경쟁이 발생한다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '클로저를 사용해 상태를 은닉하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '은닉으로 얻는 것은?',
        choices: [
          { text: '메모리를 아낀다', leadsTo: 1 },
          { text: '정의된 함수만 통해 접근하게 해 무결성을 지킨다', correct: true },
          { text: '실행 속도가 빨라진다', leadsTo: 3 },
          { text: '타입 검사가 생긴다', leadsTo: 0 },
        ],
        rationale:
          '내부 함수로 변수에 접근하는 통로만 열어두면 외부에서는 값을 직접 바꿀 수 없다. 객체 지향의 캡슐화와 유사한 효과다.',
      },
      {
        kind: 'misconception',
        stem: '클로저가 변수를 붙잡고 있는 것은 메모리 누수인가?',
        choices: [
          { text: '누수라서 프로세스가 끝날 때까지 남는다', leadsTo: 1 },
          { text: '누수가 아니다. 닿을 길이 끊기면 걷힌다', correct: true },
          { text: '엔진이 자동으로 끊어 준다', leadsTo: 3 },
          { text: '클로저는 변수를 붙잡지 않는다', leadsTo: 0 },
        ],
        rationale:
          '클로저가 오래 살아 있으면 그것이 잡은 값도 같이 남는다. 문제는 붙잡은 채로 오래 사는 구조다.',
      },
      {
        kind: 'boundary',
        stem: '전역 변수 대신 클로저를 쓰면 함께 줄어드는 것은?',
        choices: [
          { text: '코드 길이', leadsTo: 2 },
          { text: '함수 호출 횟수', leadsTo: 3 },
          { text: '이름 충돌', correct: true },
          { text: '비동기 처리 비용', leadsTo: 4 },
        ],
        rationale:
          '불필요한 전역 변수 사용을 줄여 상태 변화를 예측 가능하게 만든다.',
      },
    ],
  },
  {
    identityScope: 'typescript',
    question: '타입스크립트의 구조적 타이핑은 무엇을 기준으로 판별하는가?',
    items: [
      {
        kind: 'concept',
        stem: '판별 근거는?',
        choices: [
          { text: '선언 순서', leadsTo: 1 },
          { text: '선언된 이름', leadsTo: 0 },
          { text: '객체의 형태와 멤버 타입', correct: true },
          { text: '파일 경로', leadsTo: 4 },
        ],
        rationale:
          '이름이 달라도 가지고 있는 멤버의 타입과 형태가 같다면 동일한 타입으로 간주한다.',
      },
      {
        kind: 'misconception',
        stem: '인터페이스를 명시적으로 상속해야 통과하는가?',
        choices: [
          { text: '이름이 같아야 한다', leadsTo: 0 },
          { text: '반드시 상속해야 한다', leadsTo: 1 },
          { text: '같은 파일에 있어야 한다', leadsTo: 4 },
          { text: '요구 속성만 갖추면 상속 없이도 통과한다', correct: true },
        ],
        rationale:
          '덕분에 외부 라이브러리와의 타입 호환성을 확보하기 쉽다.',
      },
      {
        kind: 'boundary',
        stem: '구조적 타이핑이 만드는 위험은?',
        choices: [
          { text: '런타임 성능이 나빠진다', leadsTo: 3 },
          { text: '컴파일이 느려진다', leadsTo: 3 },
          { text: '뜻이 다른 타입이 우연히 일치해 섞인다', correct: true },
          { text: '상속을 쓸 수 없다', leadsTo: 1 },
        ],
        rationale:
          '뜻이 다른 타입에는 브랜드 태그나 고유 식별자를 붙여 구분한다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: 'JVM 메모리 영역은 어떻게 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '나누는 기준은?',
        choices: [
          { text: '스레드 간 공유 여부', correct: true },
          { text: '데이터 크기', leadsTo: 0 },
          { text: '읽기 전용인지 여부', leadsTo: 2 },
          { text: '생성 순서', leadsTo: 3 },
        ],
        rationale:
          '공유 영역은 모든 스레드가 접근 가능하고, 개별 영역은 스레드 생성 시 함께 생기고 종료 시 사라진다.',
      },
      {
        kind: 'misconception',
        stem: '개별 영역에서 동기화가 필요한가?',
        choices: [
          { text: '스레드가 넷을 넘으면 필요하다', leadsTo: 3 },
          { text: '공유 영역과 똑같이 필요하다', leadsTo: 1 },
          { text: '읽을 때만 필요하다', leadsTo: 1 },
          { text: '그 스레드만 접근하므로 필요 없다', correct: true },
        ],
        rationale:
          'Stack과 PC Register는 스레드마다 따로 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '클래스 메타데이터까지 회수되는가?',
        choices: [
          { text: 'JVM과 설정에 따라 다르다', correct: true },
          { text: '언제나 회수된다', leadsTo: 2 },
          { text: '절대 회수되지 않는다', leadsTo: 2 },
          { text: '힙과 함께 항상 회수된다', leadsTo: 0 },
        ],
        rationale:
          '힙이 가비지 컬렉션의 주된 대상이다. Method Area에 담긴 것의 회수는 그와 별개다.',
      },
    ],
  },
  {
    identityScope: 'python',
    question: '파이썬의 가비지 컬렉션은 무엇으로 동작하는가?',
    items: [
      {
        kind: 'concept',
        stem: '기본이 되는 메커니즘은?',
        choices: [
          { text: '표시하고 쓸기', leadsTo: 0 },
          { text: '세대별 수집', leadsTo: 1 },
          { text: '참조 횟수 세기', correct: true },
          { text: '수동 해제', leadsTo: 2 },
        ],
        rationale:
          '참조 횟수가 0이 되면 즉시 메모리에서 제거한다. 세대별 수집기는 순환을 걷어 내는 보조 수단이다.',
      },
      {
        kind: 'misconception',
        stem: '참조 횟수만으로 충분한가?',
        choices: [
          { text: '큰 객체만 놓친다', leadsTo: 0 },
          { text: '충분하다. 모든 객체를 해제한다', leadsTo: 0 },
          { text: '순환 참조는 횟수가 0이 되지 않아 남는다', correct: true },
          { text: '스레드가 많을 때만 놓친다', leadsTo: 3 },
        ],
        rationale:
          '두 객체가 서로를 가리키면 외부에서 닿지 않아도 횟수가 남는다. 그래서 세대별 수집기가 주기적으로 찾아낸다.',
      },
      {
        kind: 'boundary',
        stem: '세대를 몇 개로 두는지는?',
        choices: [
          { text: '사용자가 반드시 정해야 한다', leadsTo: 1 },
          { text: '언제나 셋으로 고정이다', leadsTo: 1 },
          { text: '객체 수에 따라 자동으로 늘어난다', leadsTo: 1 },
          { text: '판마다 바뀌어 왔다', correct: true },
        ],
        rationale:
          '객체를 세대로 나눠 오래 살아남은 것은 덜 자주 훑는다는 원칙이 핵심이고, 그 개수는 구현 세부다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '호이스팅으로 인한 부작용을 어떻게 막는가?',
    items: [
      {
        kind: 'concept',
        stem: 'var로 선언한 변수를 할당 전에 읽으면?',
        choices: [
          { text: '오류가 나서 바로 잡힌다', leadsTo: 0 },
          { text: 'undefined가 나와 조용히 지나간다', correct: true },
          { text: '할당될 값이 미리 들어 있다', leadsTo: 2 },
          { text: '이름을 찾지 못한다', leadsTo: 0 },
        ],
        rationale:
          '선언문이 스코프 최상단으로 끌어올려져 이름만 예약된다. 값은 할당문 단계에서 결정되므로 그 틈이 논리적 오류를 만든다.',
      },
      {
        kind: 'misconception',
        stem: 'let과 const를 쓰면 무엇이 달라지는가?',
        choices: [
          { text: '함수 스코프로 바뀐다', leadsTo: 2 },
          { text: '호이스팅 자체가 사라진다', leadsTo: 4 },
          { text: 'undefined 대신 null이 나온다', leadsTo: 0 },
          { text: '선언 전 접근이 런타임 오류로 드러난다', correct: true },
        ],
        rationale:
          '잘못된 접근을 조용히 넘기지 않고 즉시 알게 한다. 스코프도 블록 단위로 좁아진다.',
      },
      {
        kind: 'boundary',
        stem: '함수 선언문이 만드는 위험은?',
        choices: [
          { text: '의도치 않은 덮어쓰기', correct: true },
          { text: '선언 전 호출이 막힌다', leadsTo: 1 },
          { text: '스코프를 벗어난다', leadsTo: 2 },
          { text: '위험이 없다', leadsTo: 1 },
        ],
        rationale:
          '함수 선언문은 본문까지 일찍 바인딩되어 선언 앞에서 호출할 수 있다. 그래서 같은 이름이 조용히 덮일 수 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '값 타입과 참조 타입은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '참조 타입 변수가 담는 것은?',
        choices: [
          { text: '값이 저장된 메모리 주소', correct: true },
          { text: '값 자체', leadsTo: 3 },
          { text: '값의 복사본', leadsTo: 3 },
          { text: '타입 이름', leadsTo: 4 },
        ],
        rationale:
          '값 타입은 실제 값을 직접 저장한다. 이 차이가 복사와 변경 전파의 차이를 만든다.',
      },
      {
        kind: 'misconception',
        stem: '값 타입은 언제나 스택에 놓이는가?',
        choices: [
          { text: '언제나 스택이다', leadsTo: 0 },
          { text: '객체의 필드나 배열 원소면 힙에 놓인다', correct: true },
          { text: '언제나 힙이다', leadsTo: 0 },
          { text: '컴파일러가 무작위로 정한다', leadsTo: 4 },
        ],
        rationale:
          '값이 그 자리에 직접 들어간다는 것이 핵심이고, 그 자리가 어디인지는 담긴 위치에 달렸다.',
      },
      {
        kind: 'boundary',
        stem: '참조 타입이 주는 이점과 대가는?',
        choices: [
          { text: '효율도 추적도 모두 낫다', leadsTo: 1 },
          { text: '메모리 효율은 높지만 상태 변경 추적이 어렵다', correct: true },
          { text: '효율이 나쁘고 추적은 쉽다', leadsTo: 1 },
          { text: '값 타입과 차이가 없다', leadsTo: 3 },
        ],
        rationale:
          '여러 변수가 동일한 객체를 가리키므로 한 곳에서 수정하면 다른 변수에도 반영된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '함수형 프로그래밍을 적용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '얻으려는 것은?',
        choices: [
          { text: '코드 줄 수를 줄이는 것', leadsTo: 3 },
          { text: '실행 속도를 높이는 것', leadsTo: 1 },
          { text: '상태 변경을 줄여 예측 가능성을 높이는 것', correct: true },
          { text: '메모리를 아끼는 것', leadsTo: 1 },
        ],
        rationale:
          '순수 함수는 외부 상태를 바꾸지 않고 오직 입력값으로만 결과를 만든다.',
      },
      {
        kind: 'misconception',
        stem: '순수 함수가 시험하기 쉬운 까닭은?',
        choices: [
          { text: '코드가 짧기 때문', leadsTo: 0 },
          { text: '입력과 출력만 비교하면 되기 때문', correct: true },
          { text: '오류를 던지지 않기 때문', leadsTo: 4 },
          { text: '자동으로 검증되기 때문', leadsTo: 0 },
        ],
        rationale:
          '바깥 상태를 준비하고 되돌릴 일이 없다. 같은 입력이면 같은 결과라는 성질이 그것을 가능하게 한다.',
      },
      {
        kind: 'boundary',
        stem: '불변성이 동시성에서 주는 것은?',
        choices: [
          { text: '락 비용 없이 경쟁 상태를 피한다', correct: true },
          { text: '락을 더 촘촘히 걸게 한다', leadsTo: 1 },
          { text: '스레드 수를 늘려 준다', leadsTo: 2 },
          { text: '동시성과 무관하다', leadsTo: 1 },
        ],
        rationale:
          '바뀌지 않는 값은 여러 스레드가 함께 읽어도 어긋날 자리가 없다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: 'GC 알고리즘 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '선택을 가르는 핵심 축은?',
        choices: [
          { text: '힙 크기가 큰가 작은가', leadsTo: 4 },
          { text: '처리량 중심인가 응답 속도 중심인가', correct: true },
          { text: 'JDK 버전이 높은가', leadsTo: 2 },
          { text: '스레드가 많은가', leadsTo: 3 },
        ],
        rationale:
          '애플리케이션의 서비스 특성과 지연 시간 허용 범위에 따라 결정한다.',
      },
      {
        kind: 'misconception',
        stem: '초저지연 수집기의 몇 밀리초는 무엇인가?',
        choices: [
          { text: '모든 환경에서 보장되는 상한이다', leadsTo: 2 },
          { text: '목표이지 어떤 환경에서든 지켜지는 약속은 아니다', correct: true },
          { text: '평균값이라 절반은 넘는다', leadsTo: 2 },
          { text: '힙 크기와 무관한 상수다', leadsTo: 3 },
        ],
        rationale:
          '힙이 커져도 멈추는 시간이 잘 늘지 않도록 만들어졌지만, 그것이 어떤 부하에서도 성립한다는 뜻은 아니다.',
      },
      {
        kind: 'boundary',
        stem: '리전으로 나눠 수집하는 방식이 노리는 것은?',
        choices: [
          { text: '회수 가치가 큰 곳부터 처리해 목표 지연을 맞추는 것', correct: true },
          { text: '힙을 물리적으로 줄이는 것', leadsTo: 3 },
          { text: '수집을 아예 없애는 것', leadsTo: 0 },
          { text: '스레드를 늘리는 것', leadsTo: 3 },
        ],
        rationale:
          '설정한 목표 지연 시간을 맞추기 위해 수집 효율이 높은 영역부터 먼저 처리한다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '같은 문자열 리터럴이 같은 객체인 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '같은 리터럴이 같은 자리를 가리키는 까닭은?',
        choices: [
          { text: '컴파일러가 매번 새로 만들기 때문', leadsTo: 4 },
          { text: '내용이 같으면 자동으로 합쳐지기 때문', leadsTo: 0 },
          { text: '문자열이 값 타입이기 때문', leadsTo: 0 },
          { text: '풀에 한 벌만 두고 함께 쓰기 때문', correct: true },
        ],
        rationale:
          '리터럴은 문자열 풀에 한 벌만 있고 변수는 그 자리를 가리킨다.',
      },
      {
        kind: 'misconception',
        stem: 'new로 만든 문자열은 풀에 있으면 재사용되는가?',
        choices: [
          { text: '오류가 난다', leadsTo: 2 },
          { text: '풀에 있으면 그것을 쓴다', leadsTo: 1 },
          { text: '내용이 같으면 합쳐진다', leadsTo: 0 },
          { text: '풀에 있든 없든 힙에 새로 하나를 만든다', correct: true },
        ],
        rationale:
          '그래서 참조로 견주면 거짓이고 내용으로 견줘야 참이다.',
      },
      {
        kind: 'boundary',
        stem: '참조 비교가 문자열에서 헷갈리는 근본 이유는?',
        choices: [
          { text: '문자열만 특별한 규칙을 쓰기 때문', leadsTo: 2 },
          { text: '내용이 아니라 참조를 견주기 때문', correct: true },
          { text: '길이에 따라 다르게 동작하기 때문', leadsTo: 0 },
          { text: '인코딩이 다르기 때문', leadsTo: 4 },
        ],
        rationale:
          '문자열이 특별해서가 아니라 참조 비교라서 그렇다. 리터럴이 풀을 공유하는 것이 우연히 참을 만들 뿐이다.',
      },
    ],
  },
  {
    identityScope: 'js',
    question: '한 줄짜리 코드가 화면을 멈추게 하는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '화면이 굳는 까닭은?',
        choices: [
          { text: '클릭 처리와 화면 갱신이 같은 자리를 쓰기 때문', correct: true },
          { text: '메모리가 모자라서', leadsTo: 4 },
          { text: '네트워크가 느려서', leadsTo: 2 },
          { text: '화면 갱신 주기가 길어서', leadsTo: 4 },
        ],
        rationale:
          '자바스크립트를 도는 자리가 하나뿐이라 거기서 오래 걸리면 그동안 아무것도 못 한다.',
      },
      {
        kind: 'misconception',
        stem: '느린 API 호출도 화면을 멈추는가?',
        choices: [
          { text: '기다리는 동안에는 자리를 내놓아 멈추지 않는다', correct: true },
          { text: '멈춘다. 오래 걸리는 것은 모두 같다', leadsTo: 2 },
          { text: '응답 크기가 클 때만 멈춘다', leadsTo: 2 },
          { text: '워커로 옮겨야만 안 멈춘다', leadsTo: 0 },
        ],
        rationale:
          '느린 것과 오래 도는 것을 구분해야 한다. 느린 API 호출은 화면을 안 멈추지만 100만 번 도는 반복문은 멈춘다.',
      },
      {
        kind: 'boundary',
        stem: '멈춘 동안에도 움직일 수 있는 것은?',
        choices: [
          { text: '클릭 처리', leadsTo: 3 },
          { text: '합성만으로 도는 애니메이션', correct: true },
          { text: '모든 화면 갱신', leadsTo: 4 },
          { text: '움직이는 것이 없다', leadsTo: 4 },
        ],
        rationale:
          '그것은 다른 자리에서 돌기 때문이다. 나머지는 같은 자리를 기다린다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '한글이 깨져 보이는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '깨짐의 원인은?',
        choices: [
          { text: '저장할 때 쓴 규칙과 읽을 때 쓴 규칙이 다르다', correct: true },
          { text: '바이트가 손상됐다', leadsTo: 1 },
          { text: '글꼴이 없다', leadsTo: 4 },
          { text: '한글이 유니코드에 없다', leadsTo: 0 },
        ],
        rationale:
          '바이트는 그대로인데 그것을 글자로 자르는 방법이 어긋난다.',
      },
      {
        kind: 'misconception',
        stem: '유니코드와 UTF-8의 관계는?',
        choices: [
          { text: 'UTF-8이 유니코드를 대체했다', leadsTo: 0 },
          { text: '같은 말이다', leadsTo: 0 },
          { text: '유니코드는 번호표, UTF-8은 그 번호를 바이트로 적는 방법', correct: true },
          { text: '유니코드가 바이트 표현까지 정한다', leadsTo: 4 },
        ],
        rationale:
          '둘은 다른 층이다. 같은 번호를 적는 방법이 여럿이라 규칙이 어긋날 여지가 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '어긋남을 먼저 의심할 자리는?',
        choices: [
          { text: '화면에 그리는 코드', leadsTo: 3 },
          { text: 'DB 연결·응답 헤더·파일 읽기 같은 경계', correct: true },
          { text: '문자열을 만드는 코드', leadsTo: 1 },
          { text: '어디든 무작위다', leadsTo: 2 },
        ],
        rationale:
          '깨지는 자리는 대개 경계다. 이 중 하나만 어긋나도 그 지점부터 어긋난다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '0.1을 더했는데 왜 딱 안 떨어지는가?',
    items: [
      {
        kind: 'concept',
        stem: '0.1이 정확히 저장되지 않는 까닭은?',
        choices: [
          { text: '저장하는 사이에 메모리가 손상되기 때문에', leadsTo: 0 },
          { text: '표현할 자릿수가 모자라 뒤가 잘리기 때문에', leadsTo: 3 },
          { text: '언어마다 소수를 다루는 방식이 달라서', leadsTo: 3 },
          { text: '이진에서 끝나지 않아 가까운 값으로 반올림된다', correct: true },
        ],
        rationale:
          '십진에서 1을 3으로 나눈 값을 끝없이 적는 것과 같은 일이다. 밑이 2인 자리로는 10분의 1을 유한하게 적을 수 없다.',
      },
      {
        kind: 'misconception',
        stem: '정밀도를 올리면 해결되는가?',
        choices: [
          { text: '완전히 해결된다', leadsTo: 3 },
          { text: '오차가 작아질 뿐 성질은 그대로다', correct: true },
          { text: '오히려 나빠진다', leadsTo: 3 },
          { text: '언어를 바꾸면 해결된다', leadsTo: 1 },
        ],
        rationale:
          '표현의 한계와 계산 실수는 구분해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '돈을 다룰 때 고르는 방식은?',
        choices: [
          { text: '반올림을 마지막에만 하면 된다', leadsTo: 4 },
          { text: '배정밀도로 충분하다', leadsTo: 3 },
          { text: '십진 소수 타입을 쓰거나 최소 단위 정수로 계산한다', correct: true },
          { text: '문자열로 저장한다', leadsTo: 1 },
        ],
        rationale:
          '이자나 환율처럼 나눗셈이 끼면 중간 계산을 몇 자리까지 들고 갈지와 어디서 반올림할지도 함께 정해야 한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '정규식 하나가 서버를 멈추게 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '멈추게 되는 원리는?',
        choices: [
          { text: '메모리를 많이 써서', leadsTo: 1 },
          { text: '식이 길어서 파싱이 오래 걸린다', leadsTo: 0 },
          { text: '안 맞으면 되돌아가 다시 맞춰 보느라 경우의 수가 폭발한다', correct: true },
          { text: '엔진이 매번 다시 컴파일해서', leadsTo: 1 },
        ],
        rationale:
          '글자가 하나 늘 때마다 시도 수가 배로 늘어 금세 멈춘 것처럼 보인다.',
      },
      {
        kind: 'misconception',
        stem: '위험한 식만 있으면 바로 터지는가?',
        choices: [
          { text: '식만 있으면 언제나 터진다', leadsTo: 0 },
          { text: '뒤쪽에서 실패가 겹쳐야 되돌아가기가 폭발한다', correct: true },
          { text: '입력이 짧아도 터진다', leadsTo: 2 },
          { text: '엔진 종류와 무관하다', leadsTo: 1 },
        ],
        rationale:
          '반복 안에 반복이 있거나 같은 것을 받는 갈래가 나란히 놓여 한 입력을 여러 방법으로 나눌 수 있을 때, 거기에 실패가 겹쳐야 터진다.',
      },
      {
        kind: 'boundary',
        stem: '가장 위험한 자리는?',
        choices: [
          { text: '검증을 두 번 하는 자리', leadsTo: 2 },
          { text: '식을 상수로 박아 둔 자리', leadsTo: 0 },
          { text: '식이 짧은 자리', leadsTo: 0 },
          { text: '우리가 쓴 식에 남의 문자열이 들어가는 자리', correct: true },
        ],
        rationale:
          '한 요청이 CPU를 붙잡으면 그 자리가 통째로 막힌다. 막는 길은 위험한 모양을 피하고, 입력 길이를 제한하고, 시간 제한이 있는 실행을 쓰는 것이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '메모리 관점에서 값 타입과 참조 타입의 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '고르는 기준 셋은?',
        choices: [
          { text: '언어, 버전, 플랫폼', leadsTo: 2 },
          { text: '수명, 크기, 바꿀 일이 있는지', correct: true },
          { text: '스레드 수, 코어 수, 힙 크기', leadsTo: 3 },
          { text: '이름, 접근 제어, 상속 여부', leadsTo: 0 },
        ],
        rationale:
          '작고 수명이 짧고 바꿀 일이 없으면 값 타입이 유리한 편이다.',
      },
      {
        kind: 'misconception',
        stem: '값 타입은 언제나 스택에 놓이는가?',
        choices: [
          { text: '언제나 스택이다', leadsTo: 4 },
          { text: '객체의 필드나 배열 원소면 힙에 놓인다', correct: true },
          { text: '언제나 힙이다', leadsTo: 4 },
          { text: '박싱해야 힙에 간다', leadsTo: 1 },
        ],
        rationale:
          '흔히 그리는 스택·힙 구조는 관념 모델이고 실제 배치는 언어와 런타임 최적화에 달렸다.',
      },
      {
        kind: 'boundary',
        stem: '참조 타입이 치르는 대가는?',
        choices: [
          { text: '전달할 때마다 전체가 복사된다', leadsTo: 0 },
          { text: '힙에 쌓이고 GC가 그만큼 일한다', correct: true },
          { text: '여러 곳에서 공유할 수 없다', leadsTo: 3 },
          { text: '대가가 없다', leadsTo: 1 },
        ],
        rationale:
          '넘길 때 주소만 복사하니 전달은 싸다. 비용은 할당과 회수 쪽에 있다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '자바의 원시 타입과 래퍼 클래스는 메모리 구조상 어떤 차이가 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '래퍼 클래스 변수가 담는 것은?',
        choices: [
          { text: '캐시된 정수', leadsTo: 0 },
          { text: '실제 데이터 값', leadsTo: 2 },
          { text: '값의 복사본', leadsTo: 2 },
          { text: '힙에 있는 객체를 가리키는 참조', correct: true },
        ],
        rationale:
          '원시 타입은 변수 공간에 실제 값을 직접 저장한다. 래퍼는 객체 헤더까지 함께 힙에 놓인다.',
      },
      {
        kind: 'misconception',
        stem: '래퍼 객체의 크기는 값 크기와 같은가?',
        choices: [
          { text: '객체 머리와 정렬 때문에 더 크다', correct: true },
          { text: '감싸기만 하므로 값과 똑같다', leadsTo: 2 },
          { text: '언제나 정확히 두 배다', leadsTo: 2 },
          { text: '압축돼 들어가 값보다 작다', leadsTo: 0 },
        ],
        rationale:
          '값 자체는 4바이트지만 객체로 감싸면 구현과 옵션에 따라 그보다 훨씬 커진다.',
      },
      {
        kind: 'boundary',
        stem: '반복문에서 오토박싱이 위험해지는 이유는?',
        choices: [
          { text: '값이 잘못 변환된다', leadsTo: 0 },
          { text: '짧은 시간에 많은 객체가 생겨 GC 부담이 는다', correct: true },
          { text: '컴파일이 실패한다', leadsTo: 1 },
          { text: '스레드가 늘어난다', leadsTo: 3 },
        ],
        rationale:
          '참조를 거치는 간접 접근이라 CPU 캐시 효율도 떨어진다. 캐시 범위 밖 값이면 매번 새 객체가 된다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '데드락은 어떤 조건이 모두 모여야 생기는가?',
    items: [
      {
        kind: 'concept',
        stem: '실무에서 가장 없애기 쉬운 조건은?',
        choices: [
          { text: '점유하며 대기', leadsTo: 3 },
          { text: '상호 배제', leadsTo: 4 },
          { text: '비선점', leadsTo: 4 },
          { text: '순환 대기', correct: true },
        ],
        rationale:
          '여러 자원을 잡는 모든 경로가 같은 전역 순서를 따르면 기다림 고리를 만들지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '긴 작업이나 자원 고갈은 데드락과 따로 구분해야 하는가?',
        choices: [
          { text: '아니다. 기다림이 길면 데드락이다', leadsTo: 1 },
          { text: '아니다. 스레드가 둘 이상이면 데드락이다', leadsTo: 2 },
          { text: '그렇다. 기다림이 길다고 데드락은 아니다', correct: true },
          { text: '아니다. 타임아웃이 나면 데드락이다', leadsTo: 4 },
        ],
        rationale:
          'wait-for graph의 고리, 스레드 덤프나 데이터베이스 잠금 정보를 확인해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '재시도에 무작위 지연이 없으면 생기는 것은?',
        choices: [
          { text: '데드락이 확정된다', leadsTo: 0 },
          { text: '두 작업이 계속 양보하는 livelock', correct: true },
          { text: '아무 일도 없다', leadsTo: 2 },
          { text: '자원이 자동 회수된다', leadsTo: 4 },
        ],
        rationale:
          '한쪽만 계속 실패하면 starvation이다. 둘 다 데드락과는 다른 상태다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '가상 메모리는 무엇을 해결하는가?',
    items: [
      {
        kind: 'concept',
        stem: '프로그램이 하지 않아도 되게 만든 일은?',
        choices: [
          { text: '디스크에 저장하는 일', leadsTo: 4 },
          { text: '메모리를 해제하는 일', leadsTo: 1 },
          { text: '물리 메모리의 배치와 수명을 직접 관리하는 일', correct: true },
          { text: '스레드를 만드는 일', leadsTo: 0 },
        ],
        rationale:
          '커널은 주소 범위마다 권한과 어떤 데이터를 연결할지 정한다. 서로 다른 프로세스의 같은 가상 주소가 다른 물리 페이지를 가리킬 수 있어 격리도 쉬워진다.',
      },
      {
        kind: 'misconception',
        stem: '디스크를 읽지 않는 page fault도 있는가?',
        choices: [
          { text: '아니다. fault가 나면 언제나 디스크를 읽는다', leadsTo: 1 },
          { text: '아니다. 스왑이 켜져 있을 때만 fault가 난다', leadsTo: 2 },
          { text: '아니다. fault는 오류라서 프로그램이 죽는다', leadsTo: 1 },
          { text: '그렇다. 익명 페이지와 copy-on-write도 fault다', correct: true },
        ],
        rationale:
          '매핑이 없거나 권한 처리가 필요할 때 커널로 넘어가는 것이고, 해결 방법은 여러 가지다.',
      },
      {
        kind: 'boundary',
        stem: '큰 가상 주소 범위를 잡으면?',
        choices: [
          { text: '스왑이 그만큼 늘어난다', leadsTo: 2 },
          { text: '그만큼 물리 메모리가 즉시 잡힌다', leadsTo: 2 },
          { text: '그만큼 물리 메모리가 확보된 것은 아니다', correct: true },
          { text: '반드시 성공이 보장된다', leadsTo: 2 },
        ],
        rationale:
          'demand paging은 실제로 접근한 페이지만 올린다. 작업 집합이 자원 한도를 넘으면 할당이 실패할 수 있다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '사용자 모드에서 커널 모드로 진입하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '모드를 나눈 목적은?',
        choices: [
          { text: '하드웨어를 직접 건드리지 못하게 하려고', correct: true },
          { text: '권한 검사를 줄여 실행 속도를 높이려고', leadsTo: 3 },
          { text: '영역을 나눠 메모리를 아끼려고', leadsTo: 3 },
          { text: '커널 스레드와 사용자 스레드를 나누려고', leadsTo: 1 },
        ],
        rationale:
          '권한을 분리해 하드웨어 제어권을 독점한다. 커널 모드만 모든 하드웨어 권한을 가진다.',
      },
      {
        kind: 'misconception',
        stem: '허락받지 않은 메모리를 건드리면 어떻게 되는가?',
        choices: [
          { text: '자동으로 시스템 콜로 바뀐다', leadsTo: 0 },
          { text: '커널 권한을 얻는다', leadsTo: 0 },
          { text: '조용히 무시된다', leadsTo: 1 },
          { text: 'CPU가 예외를 일으켜 커널에 붙잡힌다', correct: true },
        ],
        rationale:
          '권한을 얻는 것이 아니라 붙잡히는 것이다. 시스템 콜도 커널이 요청의 정당성을 검사한 뒤 대신 수행한다.',
      },
      {
        kind: 'boundary',
        stem: '모드 전환은 컨텍스트 스위칭인가?',
        choices: [
          { text: '다른 프로세스로 넘어가지 않으면 아니다', correct: true },
          { text: '언제나 컨텍스트 스위칭이다', leadsTo: 3 },
          { text: '비용이 없어서 구분할 필요가 없다', leadsTo: 3 },
          { text: '인터럽트일 때만 스위칭이다', leadsTo: 1 },
        ],
        rationale:
          '모드를 바꾸고 상태를 갈무리하는 비용은 들지만 그것과 프로세스 교체는 다른 일이다. 그래도 비용이 있으니 호출 횟수는 줄여야 한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '프로세스 주소공간을 나누어 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '영역을 나누는 근거는?',
        choices: [
          { text: '접근 속도가 다르기 때문', leadsTo: 0 },
          { text: '크기가 다르기 때문', leadsTo: 0 },
          { text: '데이터의 성격과 생명주기가 다르기 때문', correct: true },
          { text: '언어마다 다르기 때문', leadsTo: 2 },
        ],
        rationale:
          '메모리 사용 목적에 따라 영역을 구분하고 각각 다르게 관리한다.',
      },
      {
        kind: 'misconception',
        stem: '스택과 힙의 시작 위치는 어디인가?',
        choices: [
          { text: '주소가 고정돼 있다', leadsTo: 2 },
          { text: '언제나 스택이 위, 힙이 아래다', leadsTo: 1 },
          { text: '언제나 힙이 위, 스택이 아래다', leadsTo: 1 },
          { text: '운영체제와 규약에 따라 다르다', correct: true },
        ],
        rationale:
          '흔한 배치에서 둘이 마주 보고 자라 가용 공간을 유동적으로 나눠 쓴다는 것이 요점이다.',
      },
      {
        kind: 'boundary',
        stem: '한 프로세스의 오류가 다른 프로세스를 오염시키지 않는 근거는?',
        choices: [
          { text: '스택이 아래로 자라기 때문', leadsTo: 1 },
          { text: '영역을 넷으로 나눴기 때문', leadsTo: 4 },
          { text: '가상 메모리로 독립된 주소 공간을 가지기 때문', correct: true },
          { text: '오염은 실제로 일어난다', leadsTo: 3 },
        ],
        rationale:
          '영역 구분은 한 주소 공간 안의 정리이고, 프로세스 사이의 격리는 주소 공간 자체가 다르기 때문에 성립한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '스레드 풀을 사용하는 주된 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '풀이 없애는 비용은?',
        choices: [
          { text: '메모리 할당 비용 전부', leadsTo: 1 },
          { text: '작업 큐를 유지하는 비용', leadsTo: 0 },
          { text: '컨텍스트 스위칭 비용', leadsTo: 1 },
          { text: '요청마다 스레드를 만들고 없애는 비용', correct: true },
        ],
        rationale:
          '처리가 끝나면 스레드는 소멸하지 않고 다시 풀로 돌아가 다음 작업을 기다린다.',
      },
      {
        kind: 'misconception',
        stem: '풀을 크게 잡으면 처리량이 계속 오르는가?',
        choices: [
          { text: '크게 잡을수록 항상 좋다', leadsTo: 1 },
          { text: '컨텍스트 스위칭 비용이 커져 오히려 떨어진다', correct: true },
          { text: '크기와 처리량은 무관하다', leadsTo: 1 },
          { text: '큐 크기만 맞추면 된다', leadsTo: 0 },
        ],
        rationale:
          '너무 작으면 요청이 큐에 쌓여 응답이 느려지고, 너무 크면 전환 비용이 이긴다.',
      },
      {
        kind: 'boundary',
        stem: '풀이 너무 작으면 무엇이 나빠지는가?',
        choices: [
          { text: '요청이 큐에 쌓여 응답 시간이 느려진다', correct: true },
          { text: '전체 처리량이 올라간다', leadsTo: 1 },
          { text: '스레드가 저절로 늘어난다', leadsTo: 0 },
          { text: '아무 차이가 없다', leadsTo: 2 },
        ],
        rationale:
          '큰 쪽과 작은 쪽이 각각 다른 값을 깎는다. 그래서 적절한 크기를 찾는 일이 남는다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '프로세스 주소 공간을 나누는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '코드 영역을 읽기 전용으로 두는 까닭은?',
        choices: [
          { text: '더 빨리 읽기 위해', leadsTo: 1 },
          { text: '실행 파일의 내용을 그대로 지키기 위해', correct: true },
          { text: '크기를 줄이기 위해', leadsTo: 4 },
          { text: '스택과 구분하기 위해', leadsTo: 0 },
        ],
        rationale:
          '데이터 영역은 프로그램 시작부터 종료까지 유지되는 상태를 담고, 힙은 런타임에 크기가 결정된다.',
      },
      {
        kind: 'misconception',
        stem: '함수가 끝나면 스택이 사라지는가?',
        choices: [
          { text: '스택이 절반으로 준다', leadsTo: 0 },
          { text: '스택 전체가 사라진다', leadsTo: 0 },
          { text: '사라지는 것은 스택이 아니라 그 위의 프레임이다', correct: true },
          { text: '힙으로 옮겨진다', leadsTo: 1 },
        ],
        rationale:
          '스택은 스레드마다 하나씩 있다. 함수를 부를 때마다 그 위에 프레임이 쌓이고 돌아올 때 걷힌다.',
      },
      {
        kind: 'boundary',
        stem: '스택은 무엇마다 하나씩 있는가?',
        choices: [
          { text: '프로세스', leadsTo: 2 },
          { text: '스레드', correct: true },
          { text: '함수', leadsTo: 0 },
          { text: '코어', leadsTo: 1 },
        ],
        rationale:
          '그래서 스레드를 늘리면 그만큼 스택 공간도 함께 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '데드락을 해결하기 위한 회피 전략은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '회피가 매 요청마다 따지는 것은?',
        choices: [
          { text: '요청한 프로세스의 우선순위가 높은가', leadsTo: 2 },
          { text: '요청한 자원이 지금 비어 있는가', leadsTo: 3 },
          { text: '지금 내주고도 모두가 끝날 수 있는 순서가 남는가', correct: true },
          { text: '이미 고리가 생겼는가', leadsTo: 2 },
        ],
        rationale:
          '남을 때만 준다. 남지 않으면 줄 수 있는 자원이어도 기다리게 한다.',
      },
      {
        kind: 'misconception',
        stem: '회피와 예방은 같은 것인가?',
        choices: [
          { text: '둘 다 탐지 뒤에 하는 일이다', leadsTo: 2 },
          { text: '부르는 이름만 다른 같은 말이다', leadsTo: 1 },
          { text: '회피가 조건을 없애고 예방은 판단한다', leadsTo: 1 },
          { text: '예방은 조건을 막고 회피는 그때그때 판단한다', correct: true },
        ],
        rationale:
          '회피는 네 조건을 그대로 둔 채 요청마다 따진다.',
      },
      {
        kind: 'boundary',
        stem: '은행원 알고리즘의 쓰임이 좁은 까닭은?',
        choices: [
          { text: '탐지를 함께 해야 해서', leadsTo: 2 },
          { text: '계산이 너무 느려서', leadsTo: 3 },
          { text: '자원이 하나뿐일 때만 되어서', leadsTo: 0 },
          { text: '프로세스마다 최대 사용량을 미리 알아야 해서', correct: true },
        ],
        rationale:
          '그 값을 내놓을 수 없는 환경이 많다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '가상 메모리를 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '운영체제가 물리 메모리에 올리는 것은?',
        choices: [
          { text: '실행 파일 전체', leadsTo: 0 },
          { text: '프로세스 전체', leadsTo: 1 },
          { text: '필요한 페이지만', correct: true },
          { text: '스왑에 있는 것 전부', leadsTo: 4 },
        ],
        rationale:
          '나머지는 스왑에 있을 수도, 실행 파일이나 매핑한 파일에 그대로 있을 수도, 아직 아무 데도 없을 수도 있다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 넉넉하면 페이지 폴트가 안 나는가?',
        choices: [
          { text: '스왑이 꽉 찼을 때만 난다', leadsTo: 4 },
          { text: '넉넉하면 나지 않는다', leadsTo: 0 },
          { text: '아직 안 올렸으면 넉넉해도 난다', correct: true },
          { text: '폴트는 오류라서 프로그램이 죽는다', leadsTo: 0 },
        ],
        rationale:
          '건드린 가상 페이지가 지금 물리 메모리에 없으면 난다. 그때 운영체제가 가져온다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스 간 격리가 성립하는 근거는?',
        choices: [
          { text: '페이지 크기가 같기 때문', leadsTo: 1 },
          { text: '각자 독립된 주소 공간을 가지기 때문', correct: true },
          { text: '스왑이 분리돼 있기 때문', leadsTo: 4 },
          { text: '커널이 매번 검사하기 때문', leadsTo: 3 },
        ],
        rationale:
          '서로의 영역을 침범할 수 있는 주소 자체가 없다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '사용자 모드와 커널 모드 전환의 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '두 모드를 가르는 것은?',
        choices: [
          { text: '실행 파일 형식', leadsTo: 0 },
          { text: '프로세스 우선순위', leadsTo: 3 },
          { text: '메모리 영역 크기', leadsTo: 1 },
          { text: 'CPU의 모드 비트', correct: true },
        ],
        rationale:
          '사용자 모드는 제한된 권한, 커널 모드는 하드웨어 제어와 메모리 보호까지 맡는다.',
      },
      {
        kind: 'misconception',
        stem: '시스템 콜은 프로그램이 스스로 일으키는가?',
        choices: [
          { text: '그렇다. 전용 명령으로 커널 모드에 들어간다', correct: true },
          { text: '아니다. 하드웨어가 일으킨다', leadsTo: 2 },
          { text: '아니다. 타이머가 대신 일으킨다', leadsTo: 2 },
          { text: '아니다. 커널이 주기적으로 검사한다', leadsTo: 0 },
        ],
        rationale:
          '하드웨어 인터럽트는 바깥에서 들어오지만 시스템 콜은 안에서 부른다.',
      },
      {
        kind: 'boundary',
        stem: '잦은 시스템 콜을 줄이려고 쓰는 것은?',
        choices: [
          { text: '스레드 수를 늘리는 것', leadsTo: 3 },
          { text: 'io_uring 같은 기술', correct: true },
          { text: '커널 모드로 계속 머무는 것', leadsTo: 1 },
          { text: '버퍼를 없애는 것', leadsTo: 4 },
        ],
        rationale:
          '전환마다 비용이 붙으므로 호출 횟수 자체를 줄이는 쪽이 답이다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: 'CPU 스케줄러의 단계별 역할은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '준비 큐에서 CPU를 줄 프로세스를 고르는 것은?',
        choices: [
          { text: '장기 스케줄러', leadsTo: 0 },
          { text: '단기 스케줄러', correct: true },
          { text: '중기 스케줄러', leadsTo: 1 },
          { text: '셋이 번갈아 한다', leadsTo: 2 },
        ],
        rationale:
          '장기는 메모리로 올릴 프로세스를, 중기는 내보낼 프로세스를 정한다. 셋은 결정 범위와 호출 주기가 다르다.',
      },
      {
        kind: 'misconception',
        stem: '실행 결정을 자주 내릴수록 좋은가?',
        choices: [
          { text: '주기와 처리량은 무관하다', leadsTo: 3 },
          { text: '자주 내릴수록 언제나 낫다', leadsTo: 3 },
          { text: '너무 자주면 문맥 교환 비용이 처리량을 깎는다', correct: true },
          { text: '장기 스케줄러가 조절해 준다', leadsTo: 0 },
        ],
        rationale:
          '단기 스케줄러는 밀리초 단위로 동작하며 응답 시간과 처리량에 가장 큰 영향을 미친다.',
      },
      {
        kind: 'boundary',
        stem: '중기 스케줄러가 메모리를 확보하는 방법은?',
        choices: [
          { text: '프로세스를 잠시 디스크로 내린다', correct: true },
          { text: '프로세스를 강제 종료한다', leadsTo: 1 },
          { text: '페이지 크기를 줄인다', leadsTo: 0 },
          { text: '우선순위를 낮춘다', leadsTo: 4 },
        ],
        rationale:
          '스와핑으로 물리 메모리 자리를 확보한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '소스 코드가 실행 파일로 변하는 과정은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '여러 오브젝트 파일을 하나로 합치는 단계는?',
        choices: [
          { text: '컴파일러', leadsTo: 2 },
          { text: '전처리기', leadsTo: 2 },
          { text: '링커', correct: true },
          { text: '어셈블러', leadsTo: 2 },
        ],
        rationale:
          '외부 함수 호출부의 실제 메모리 주소를 연결해 최종 실행 파일을 만든다.',
      },
      {
        kind: 'misconception',
        stem: '컴파일러가 잡아 주는 오류의 범위는?',
        choices: [
          { text: '논리 오류까지 모두 잡는다', leadsTo: 1 },
          { text: '구문과 타입 같은 정적 오류까지. 논리는 못 잡는다', correct: true },
          { text: '실행 중 오류도 잡는다', leadsTo: 1 },
          { text: '아무 오류도 안 잡는다', leadsTo: 1 },
        ],
        rationale:
          '전처리된 코드를 어셈블리로 바꾸면서 정적 오류를 잡고 최적화한다. 의도가 틀린 것은 그 범위 밖이다.',
      },
      {
        kind: 'boundary',
        stem: '어셈블러가 만든 파일에 없는 것은?',
        choices: [
          { text: '기계어', leadsTo: 2 },
          { text: '다른 모듈과의 연결 정보', correct: true },
          { text: '함수 본문', leadsTo: 2 },
          { text: '없는 것이 없다', leadsTo: 0 },
        ],
        rationale:
          '그래서 링커가 필요하다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '가상 메모리 관리 시 페이징과 세그멘테이션은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 기준은?',
        choices: [
          { text: '읽기인가 쓰기인가', leadsTo: 1 },
          { text: '가상인가 물리인가', leadsTo: 3 },
          { text: '고정 크기로 나누는가, 논리적 단위로 나누는가', correct: true },
          { text: '커널이 하는가 사용자가 하는가', leadsTo: 2 },
        ],
        rationale:
          '페이징은 같은 크기로, 세그멘테이션은 코드·데이터·스택처럼 의미론적 단위로 나눈다.',
      },
      {
        kind: 'misconception',
        stem: '페이징에서 생기는 단편화는?',
        choices: [
          { text: '단편화가 없다', leadsTo: 0 },
          { text: '조각 사이에 생기는 외부 단편화', leadsTo: 0 },
          { text: '마지막 페이지에 남는 내부 단편화', correct: true },
          { text: '둘 다 심하게 생긴다', leadsTo: 0 },
        ],
        rationale:
          '크기가 같으니 사이에 못 쓰는 틈은 안 생긴다. 대신 마지막으로 할당된 페이지에 공간이 남는다.',
      },
      {
        kind: 'boundary',
        stem: '세그멘테이션이 보호와 공유에 유리한 까닭은?',
        choices: [
          { text: '단편화가 없기 때문', leadsTo: 0 },
          { text: '크기가 고정이기 때문', leadsTo: 0 },
          { text: '논리적 구조를 그대로 반영하기 때문', correct: true },
          { text: '주소 변환이 필요 없기 때문', leadsTo: 3 },
        ],
        rationale:
          '코드와 데이터가 각각 한 조각이라 권한을 조각 단위로 줄 수 있다. 대신 크기가 달라 사이에 빈틈이 생긴다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '동기/비동기 및 블로킹/논블로킹의 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '동기·비동기가 가르는 것은?',
        choices: [
          { text: '스레드를 몇 개 쓰느냐', leadsTo: 2 },
          { text: '제어권을 언제 돌려주느냐', leadsTo: 2 },
          { text: '작업 완료를 누가 확인하느냐', correct: true },
          { text: '커널을 거치느냐', leadsTo: 4 },
        ],
        rationale:
          '블로킹·논블로킹은 호출된 쪽이 제어권을 언제 돌려주는지의 구분이라 축이 다르다.',
      },
      {
        kind: 'misconception',
        stem: '논블로킹이면 완료를 저절로 알게 되는가?',
        choices: [
          { text: '완료 여부를 알 수 없다', leadsTo: 0 },
          { text: '완료되면 자동으로 값이 채워진다', leadsTo: 0 },
          { text: '블로킹과 같은 방식으로 기다린다', leadsTo: 2 },
          { text: '직접 물어보거나 알림을 받아야 한다', correct: true },
        ],
        rationale:
          '계속 물어보는 것을 폴링이라 하고, 콜백이나 이벤트 루프로 알림을 받을 수도 있다.',
      },
      {
        kind: 'boundary',
        stem: '블로킹 방식이 주는 이점은?',
        choices: [
          { text: '이점이 없다', leadsTo: 3 },
          { text: '자원 효율이 높다', leadsTo: 2 },
          { text: '처리량이 항상 크다', leadsTo: 2 },
          { text: '코드가 직관적이다', correct: true },
        ],
        rationale:
          '작업이 끝날 때까지 아무것도 못 하고 대기하므로 시스템 자원 효율은 떨어진다. 맞바꾸는 값이 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '데이터 오류로 인한 손실을 어떻게 방지하는가?',
    items: [
      {
        kind: 'concept',
        stem: '패리티 비트로 할 수 있는 일은?',
        choices: [
          { text: '오류가 있다는 것을 아는 것까지', correct: true },
          { text: '오류 위치를 찾아 되돌리는 것', leadsTo: 1 },
          { text: '여러 비트를 한꺼번에 고치는 것', leadsTo: 1 },
          { text: '오류를 아예 막는 것', leadsTo: 0 },
        ],
        rationale:
          '데이터 끝에 1비트를 추가해 합을 맞춘다. 어디가 틀렸는지는 모르고 데이터는 버려야 한다.',
      },
      {
        kind: 'misconception',
        stem: '해밍 코드는 몇 비트까지 되돌리는가?',
        choices: [
          { text: '되돌리지 못하고 검출만 한다', leadsTo: 0 },
          { text: '몇 비트든 되돌린다', leadsTo: 1 },
          { text: '한 비트가 뒤집힌 경우까지', correct: true },
          { text: '체크 비트 수만큼 되돌린다', leadsTo: 3 },
        ],
        rationale:
          '두 비트가 뒤집히면 있다는 것만 알고 자리는 못 찾는다.',
      },
      {
        kind: 'boundary',
        stem: '검출만으로 충분하지 않은 자리는?',
        choices: [
          { text: '어디서나 검출로 충분하다', leadsTo: 2 },
          { text: '데이터가 작은 곳', leadsTo: 0 },
          { text: '네트워크로 보내는 곳', leadsTo: 4 },
          { text: '지연이 길거나 재전송이 불가능한 곳', correct: true },
        ],
        rationale:
          '검출만 해도 재전송을 요청해 데이터를 살릴 수 있다. 그 길이 막힌 곳에서 직접 복구가 필요해진다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '블로킹과 논블로킹 I/O의 결정적 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '가르는 기준은?',
        choices: [
          { text: '제어권의 반환 시점', correct: true },
          { text: '데이터 크기', leadsTo: 2 },
          { text: '스레드 개수', leadsTo: 4 },
          { text: '커널 모드 진입 여부', leadsTo: 4 },
        ],
        rationale:
          '블로킹은 작업 완료까지 기다리고, 논블로킹은 호출 즉시 돌려준다.',
      },
      {
        kind: 'misconception',
        stem: '논블로킹 호출이 바로 돌아오면 데이터가 온 것인가?',
        choices: [
          { text: '아직 없으면 EAGAIN 같은 표시로 바로 돌아온다', correct: true },
          { text: '돌아왔으면 데이터가 있다', leadsTo: 0 },
          { text: '돌아왔으면 오류다', leadsTo: 0 },
          { text: '데이터가 올 때까지 안 돌아온다', leadsTo: 1 },
        ],
        rationale:
          '그래서 대기 시간 동안 다른 일을 할 수 있다. 대신 완료를 확인하는 로직이 따로 필요하다.',
      },
      {
        kind: 'boundary',
        stem: '논블로킹이 치르는 대가는?',
        choices: [
          { text: '대가가 없다', leadsTo: 0 },
          { text: '처리량이 반드시 떨어진다', leadsTo: 2 },
          { text: '스레드를 더 써야 한다', leadsTo: 4 },
          { text: '완료 확인이 필요해 로직이 복잡해진다', correct: true },
        ],
        rationale:
          '블로킹 쪽 코드가 직관적인 것과 맞바꾼 값이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '경쟁 상태를 막으려면 무엇을 고려해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '경쟁 상태란?',
        choices: [
          { text: '스레드가 많은 상황', leadsTo: 0 },
          { text: '접근 순서가 결과를 바꾸는 상황', correct: true },
          { text: '락이 걸린 상황', leadsTo: 0 },
          { text: '메모리가 부족한 상황', leadsTo: 2 },
        ],
        rationale:
          '둘 다 같은 값을 읽은 뒤 각자 계산하면 나중에 쓴 쪽이 앞의 결과를 덮는다.',
      },
      {
        kind: 'misconception',
        stem: '락 범위를 넓게 잡으면 안전한가?',
        choices: [
          { text: '넓을수록 언제나 낫다', leadsTo: 0 },
          { text: '안전해지지만 성능이 떨어진다', correct: true },
          { text: '범위와 성능은 무관하다', leadsTo: 2 },
          { text: '넓으면 오히려 경쟁이 는다', leadsTo: 1 },
        ],
        rationale:
          '꼭 필요한 구간만 묶거나 하드웨어 수준의 원자적 명령을 써서 오버헤드를 줄여야 한다.',
      },
      {
        kind: 'boundary',
        stem: '락 없이 오버헤드를 줄이는 길은?',
        choices: [
          { text: '방법이 없다', leadsTo: 2 },
          { text: '스레드를 줄인다', leadsTo: 2 },
          { text: '임계 구역을 없앤다', leadsTo: 0 },
          { text: '원자적 변수처럼 하드웨어 수준 명령을 쓴다', correct: true },
        ],
        rationale:
          '원자적 연산으로 처리하거나 상호 배제 기법을 쓰는 두 갈래가 있다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '인터럽트와 폴링의 결정적인 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 것은?',
        choices: [
          { text: '속도가 빠른가 느린가', leadsTo: 2 },
          { text: 'CPU가 직접 확인하는가, 장치가 깨우는가', correct: true },
          { text: '하드웨어인가 소프트웨어인가', leadsTo: 1 },
          { text: '커널인가 사용자인가', leadsTo: 0 },
        ],
        rationale:
          '폴링은 루프를 돌며 상태를 계속 확인하므로 그동안 자원을 쓴다.',
      },
      {
        kind: 'misconception',
        stem: '인터럽트는 하드웨어에서만 오는가?',
        choices: [
          { text: '하드웨어에서만 온다', leadsTo: 1 },
          { text: '소프트웨어 명령이나 예외로도 온다', correct: true },
          { text: '타이머에서만 온다', leadsTo: 1 },
          { text: '커널이 스스로 만든다', leadsTo: 0 },
        ],
        rationale:
          '운영체제는 하드웨어 인터럽트와 소프트웨어 인터럽트를 구분해 알맞은 처리 루틴으로 보낸다.',
      },
      {
        kind: 'boundary',
        stem: '인터럽트가 가능하게 한 것은?',
        choices: [
          { text: '네트워크 통신', leadsTo: 2 },
          { text: '가상 메모리', leadsTo: 3 },
          { text: '파일 시스템', leadsTo: 0 },
          { text: '현대 운영체제의 멀티태스킹', correct: true },
        ],
        rationale:
          'CPU는 다른 작업을 수행하다가 신호가 오면 처리 루틴으로 점프한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '컨텍스트 스위칭 시 CPU는 무엇을 저장하고 복원하는가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇에 저장하는가?',
        choices: [
          { text: '다음 프로세스의 스택', leadsTo: 0 },
          { text: '디스크의 스왑 영역', leadsTo: 4 },
          { text: '현재 프로세스의 PCB', correct: true },
          { text: '커널 힙', leadsTo: 0 },
        ],
        rationale:
          '프로그램 카운터와 레지스터 값을 옮겨 적어야 나중에 중단된 지점부터 이어 갈 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '전환할 때 CPU 캐시는 지워지는가?',
        choices: [
          { text: '그대로 보존된다', leadsTo: 1 },
          { text: '통째로 지워진다', leadsTo: 1 },
          { text: '지워지는 것이 아니라 새 작업의 데이터에 밀린다', correct: true },
          { text: '프로세스마다 따로 있어 영향이 없다', leadsTo: 2 },
        ],
        rationale:
          'TLB도 꼬리표를 달 수 있으면 통째로 비우지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '비용이 더 큰 쪽은?',
        choices: [
          { text: '전환 뒤 캐시 미스가 늘어나는 쪽', correct: true },
          { text: '레지스터를 복원하는 쪽', leadsTo: 4 },
          { text: '스케줄러가 고르는 쪽', leadsTo: 4 },
          { text: '둘이 같다', leadsTo: 1 },
        ],
        rationale:
          '단순한 레지스터 복원보다 이 초기화 비용이 더 크다. 그 사이 CPU는 실제 연산을 하지 않는다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '메모리 연속할당 방식 중 무엇을 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '할당이 가장 빠른 방식은?',
        choices: [
          { text: 'Worst-fit', leadsTo: 0 },
          { text: 'Best-fit', leadsTo: 0 },
          { text: 'First-fit', correct: true },
          { text: '셋이 같다', leadsTo: 2 },
        ],
        rationale:
          '리스트의 처음부터 찾다가 멈추므로 오버헤드가 적다.',
      },
      {
        kind: 'misconception',
        stem: '딱 맞는 조각을 고르면 낭비가 줄어드는가?',
        choices: [
          { text: '빈자리에 딱 맞으니 낭비가 확실히 준다', leadsTo: 1 },
          { text: '쓸 수 없을 만큼 작은 조각이 남는다', correct: true },
          { text: '고를 후보가 줄어 탐색도 함께 빨라진다', leadsTo: 0 },
          { text: '남는 공간이 없어 단편화가 사라진다', leadsTo: 2 },
        ],
        rationale:
          '모든 조각을 확인해야 해서 느리기까지 하다.',
      },
      {
        kind: 'boundary',
        stem: '가장 큰 조각을 내주는 방식의 치명적 단점은?',
        choices: [
          { text: '큰 프로세스가 들어올 자리를 미리 없앤다', correct: true },
          { text: '탐색이 가장 느리다', leadsTo: 0 },
          { text: '내부 단편화가 생긴다', leadsTo: 1 },
          { text: '단점이 없다', leadsTo: 0 },
        ],
        rationale:
          '남은 공간을 유의미하게 쓰려는 의도지만 결과가 반대로 나온다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: 'TLB 미스가 발생했을 때 처리 과정은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'TLB를 두는 까닭은?',
        choices: [
          { text: '물리 메모리를 아끼려고', leadsTo: 2 },
          { text: '페이지 테이블을 매번 보러 가는 것이 느려서', correct: true },
          { text: '페이지 폴트를 막으려고', leadsTo: 4 },
          { text: '프로세스를 격리하려고', leadsTo: 1 },
        ],
        rationale:
          '페이지 테이블은 메인 메모리에 있다. TLB는 주소 변환을 빨리 하려고 두는 캐시다.',
      },
      {
        kind: 'misconception',
        stem: '컨텍스트 스위칭 때 TLB는 항상 비워지는가?',
        choices: [
          { text: '절대 비우지 않는다', leadsTo: 0 },
          { text: '언제나 통째로 비운다', leadsTo: 1 },
          { text: '주소 공간에 꼬리표를 달 수 있으면 앞 항목을 남긴다', correct: true },
          { text: '페이지 폴트가 날 때만 비운다', leadsTo: 4 },
        ],
        rationale:
          'PCID나 ASID가 있으면 프로세스별로 갈라 둔다. 없는 시스템이면 전환할 때 비운다.',
      },
      {
        kind: 'boundary',
        stem: '페이지 테이블을 타고 내려갔는데 페이지가 없으면?',
        choices: [
          { text: '페이지 폴트로 이어진다', correct: true },
          { text: 'TLB에 다시 물어본다', leadsTo: 0 },
          { text: '변환을 포기하고 오류를 낸다', leadsTo: 3 },
          { text: '아무 일도 없다', leadsTo: 2 },
        ],
        rationale:
          '단계가 여러 겹이면 그만큼 더 걸리고, 그 끝에 매핑이 없으면 커널이 개입한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '컨텍스트 스위칭은 왜 비용이 발생하는가?',
    items: [
      {
        kind: 'concept',
        stem: '전환 동안 CPU는 무엇을 하는가?',
        choices: [
          { text: '스케줄러와 상태 저장 코드를 실행한다', correct: true },
          { text: '아무것도 하지 않고 멈춰 있다', leadsTo: 3 },
          { text: '사용자 작업을 그대로 이어 간다', leadsTo: 0 },
          { text: '캐시를 정리한다', leadsTo: 2 },
        ],
        rationale:
          '사용자 작업은 진행하지 못하지만 CPU가 노는 것은 아니다. 잠금과 실행 대기열을 다루는 시간도 직접 비용에 들어간다.',
      },
      {
        kind: 'misconception',
        stem: '전환 횟수가 많으면 그 자체로 나쁜가?',
        choices: [
          { text: '횟수만 보면 충분하다', leadsTo: 3 },
          { text: '많을수록 항상 나쁘다', leadsTo: 3 },
          { text: '적을수록 항상 좋다', leadsTo: 3 },
          { text: '아니다. 어떤 전환인지와 대기 상황을 함께 봐야 한다', correct: true },
        ],
        rationale:
          '기다리며 CPU를 놓는 voluntary switch와 밀려나는 involuntary switch는 뜻이 다르다. run queue 대기와 CPU 사용률을 함께 본다.',
      },
      {
        kind: 'boundary',
        stem: '간접 비용의 크기를 좌우하는 것은?',
        choices: [
          { text: '전환 명령의 개수', leadsTo: 0 },
          { text: '두 작업의 working set과 코어 이동', correct: true },
          { text: '스레드 이름 길이', leadsTo: 3 },
          { text: '항상 일정하다', leadsTo: 2 },
        ],
        rationale:
          '캐시와 branch predictor가 전환 명령 하나로 지워지지는 않는다. 새 작업이 이전 작업의 것을 밀어낸 만큼 나중에 miss가 는다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '뮤텍스와 세마포어는 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 것은?',
        choices: [
          { text: '속도', leadsTo: 3 },
          { text: '소유권과 카운트가 표현하는 뜻', correct: true },
          { text: '커널 지원 여부', leadsTo: 4 },
          { text: '스레드 개수 제한', leadsTo: 4 },
        ],
        rationale:
          '뮤텍스는 임계 구역을 보호한 스레드가 소유자가 된다. 세마포어는 남은 허가 수나 이벤트 신호를 카운트로 나타낸다.',
      },
      {
        kind: 'misconception',
        stem: '카운트가 1인 세마포어는 뮤텍스와 같은가?',
        choices: [
          { text: '신호 비용 탓에 더 느릴 뿐 같다', leadsTo: 0 },
          { text: '한 번에 하나만 들이므로 같은 도구다', leadsTo: 0 },
          { text: '카운트가 있어 뮤텍스보다 더 안전하다', leadsTo: 0 },
          { text: '소유권이 없어 다르다', correct: true },
        ],
        rationale:
          '한 번에 하나만 통과시키는 것은 같지만 해제할 수 있는 주체가 다르다.',
      },
      {
        kind: 'boundary',
        stem: '동시에 내줄 수 있는 커넥션 수를 나타내려면?',
        choices: [
          { text: '세마포어', correct: true },
          { text: '뮤텍스', leadsTo: 0 },
          { text: '스핀락', leadsTo: 3 },
          { text: '둘 다 안 된다', leadsTo: 4 },
        ],
        rationale:
          '상호 배제, 용량 제한, 순서 알림 중 무엇을 표현하려는지로 고른다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '프로세스 스케줄링 방식은 무엇으로 결정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '선점형이 비선점형과 다른 점은?',
        choices: [
          { text: '우선순위를 쓰지 않는다', leadsTo: 2 },
          { text: '프로세스를 더 많이 만든다', leadsTo: 4 },
          { text: '운영체제가 CPU를 강제로 회수할 수 있다', correct: true },
          { text: '문맥 교환이 없다', leadsTo: 0 },
        ],
        rationale:
          '비선점형은 프로세스가 반납할 때까지 기다린다. 그래서 응답성이 갈린다.',
      },
      {
        kind: 'misconception',
        stem: '시간 조각을 짧게 할수록 좋은가?',
        choices: [
          { text: '길이는 성능과 무관하다', leadsTo: 3 },
          { text: '짧을수록 언제나 낫다', leadsTo: 0 },
          { text: '너무 짧으면 문맥 교환 비용이 커진다', correct: true },
          { text: '짧으면 기아가 사라진다', leadsTo: 2 },
        ],
        rationale:
          '라운드 로빈은 공평한 기회로 응답성을 높이지만 그 대가가 전환 비용이다.',
      },
      {
        kind: 'boundary',
        stem: '우선순위 스케줄링의 기아를 막는 방법은?',
        choices: [
          { text: '오래 기다린 작업의 순위를 올리는 에이징', correct: true },
          { text: '우선순위를 없앤다', leadsTo: 4 },
          { text: '시간 조각을 늘린다', leadsTo: 3 },
          { text: '막을 방법이 없다', leadsTo: 2 },
        ],
        rationale:
          '낮은 우선순위의 작업이 영원히 실행되지 않는 것이 기아 현상이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '멀티스레드 환경에서 스레드 세이프한 코드를 작성하는 방법은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '세 갈래 방법이 공통으로 하는 일은?',
        choices: [
          { text: '공유 자원에 동시에 쓰는 경로를 줄이거나 없앤다', correct: true },
          { text: '스레드 수를 줄인다', leadsTo: 0 },
          { text: '실행 순서를 고정한다', leadsTo: 0 },
          { text: '메모리를 더 준다', leadsTo: 4 },
        ],
        rationale:
          '동기화는 한 번에 하나만 들어가게 하고, 불변성은 바뀔 일 자체를 없애고, 원자성은 읽고 고치는 것을 한 연산으로 만든다.',
      },
      {
        kind: 'misconception',
        stem: '락을 많이 걸수록 안전하고 좋은가?',
        choices: [
          { text: '락을 걸면 전환이 사라진다', leadsTo: 0 },
          { text: '많이 걸수록 좋다', leadsTo: 1 },
          { text: '성능과 무관하다', leadsTo: 1 },
          { text: '기다리는 스레드가 늘고 전환 비용이 붙어 느려진다', correct: true },
        ],
        rationale:
          '안전과 속도를 맞바꾸는 자리라 필요한 만큼만 걸어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '락 없이 일관성을 지키는 길은?',
        choices: [
          { text: '스레드를 하나로 줄인다', leadsTo: 0 },
          { text: '동기화를 두 번 건다', leadsTo: 1 },
          { text: 'CAS 같은 원자적 연산으로 구현한다', correct: true },
          { text: '길이 없다', leadsTo: 2 },
        ],
        rationale:
          '일관성은 지키면서 기다리는 비용을 피하는 길이다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '쓰레싱이 발생하는 원인과 해결책은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '쓰레싱 상태에서 CPU는?',
        choices: [
          { text: '평소와 같다', leadsTo: 4 },
          { text: '가장 바쁘게 돈다', leadsTo: 2 },
          { text: '논다. 디스크 입출력만 계속된다', correct: true },
          { text: '전환만 반복한다', leadsTo: 2 },
        ],
        rationale:
          '페이지 부재가 잦아져 쓸모 있는 일보다 페이지를 갈아 끼우는 데 더 많은 시간을 쓴다.',
      },
      {
        kind: 'misconception',
        stem: 'CPU 이용률이 낮을 때 프로세스를 더 올리면?',
        choices: [
          { text: '페이지 부재가 줄어든다', leadsTo: 2 },
          { text: '이용률이 올라가 해결된다', leadsTo: 0 },
          { text: '아무 변화가 없다', leadsTo: 3 },
          { text: '메모리 경쟁이 심해져 악순환이 깊어진다', correct: true },
        ],
        rationale:
          '각 프로세스에 할당된 메모리 공간이 줄어들어 페이지 부재가 더 심해진다.',
      },
      {
        kind: 'boundary',
        stem: '해결의 방향은?',
        choices: [
          { text: '디스크를 빠른 것으로 바꾼다', leadsTo: 4 },
          { text: '프로세스를 더 많이 올린다', leadsTo: 0 },
          { text: '프로세스가 필요한 최소 프레임을 보장한다', correct: true },
          { text: '가상 메모리 크기만 늘린다', leadsTo: 4 },
        ],
        rationale:
          '워킹셋 모델이나 페이지 부재 빈도로 할당량을 조절한다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '동기화 문제를 하드웨어적으로 어떻게 해결하는가?',
    items: [
      {
        kind: 'concept',
        stem: '원자적 명령어가 보장하는 것은?',
        choices: [
          { text: '실행이 더 빨라진다', leadsTo: 1 },
          { text: '실행 중 다른 프로세스가 끼어들지 못한다', correct: true },
          { text: '메모리를 덜 쓴다', leadsTo: 3 },
          { text: '락이 필요 없어진다', leadsTo: 2 },
        ],
        rationale:
          '읽고 쓰는 작업을 한 번에 처리해 중간에 컨텍스트 스위칭이 끼지 않는다.',
      },
      {
        kind: 'misconception',
        stem: 'CAS는 값이 달라졌을 때 어떻게 하는가?',
        choices: [
          { text: '바꾸지 않고 실패를 알린다', correct: true },
          { text: '기다렸다가 바꾼다', leadsTo: 1 },
          { text: '덮어쓴다', leadsTo: 0 },
          { text: '오류를 던져 프로그램을 멈춘다', leadsTo: 0 },
        ],
        rationale:
          '지금 값이 기대한 값과 같을 때만 바꾼다. 다르면 누가 먼저 손댔다는 뜻이다. 락-프리 알고리즘의 핵심 기반이 된다.',
      },
      {
        kind: 'boundary',
        stem: '인터럽트 비활성화가 실무에서 안 쓰이는 이유는?',
        choices: [
          { text: '원자성을 보장하지 못해서', leadsTo: 3 },
          { text: '단일 코어에서도 동작하지 않아서', leadsTo: 4 },
          { text: '멀티코어에서 모든 CPU를 끄는 비용이 너무 크다', correct: true },
          { text: '커널이 허용하지 않아서', leadsTo: 4 },
        ],
        rationale:
          '단일 코어에서만 유효한 방식이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'CPU와 메모리 중 무엇이 데이터 처리 속도를 결정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘 사이에서 병목이 되는 쪽은?',
        choices: [
          { text: '둘 다 아니다', leadsTo: 2 },
          { text: 'CPU의 연산 속도', leadsTo: 1 },
          { text: '코어 개수', leadsTo: 1 },
          { text: '메모리에서 데이터를 가져오는 지연', correct: true },
        ],
        rationale:
          'CPU 연산보다 메모리 접근 지연이 훨씬 크다. 이를 메모리 벽이라 부른다.',
      },
      {
        kind: 'misconception',
        stem: 'CPU가 빠르면 처리 속도도 그만큼 오르는가?',
        choices: [
          { text: '메모리와 무관하다', leadsTo: 2 },
          { text: '비례해서 오른다', leadsTo: 2 },
          { text: '코어만 늘리면 된다', leadsTo: 1 },
          { text: '데이터가 없으면 아무리 빨라도 논다', correct: true },
        ],
        rationale:
          '연산 속도와 데이터 공급 속도의 균형이 실제 처리 속도를 정한다.',
      },
      {
        kind: 'boundary',
        stem: '캐시가 하는 일은?',
        choices: [
          { text: '자주 쓰는 데이터를 가까이 두어 대기를 줄인다', correct: true },
          { text: '연산 자체를 빠르게 한다', leadsTo: 1 },
          { text: '메모리 용량을 늘린다', leadsTo: 2 },
          { text: '코어를 늘린다', leadsTo: 0 },
        ],
        rationale:
          '메모리 벽을 우회하는 것이 아니라 그 앞에 가까운 층을 하나 두는 것이다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '프로세스와 스레드의 핵심 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 핵심은?',
        choices: [
          { text: '이름이 다를 뿐 같은 것', leadsTo: 0 },
          { text: '생성 속도', leadsTo: 2 },
          { text: '메모리 사용량', leadsTo: 2 },
          { text: '무엇을 공유하고 어디까지 실패를 격리하는가', correct: true },
        ],
        rationale:
          '프로세스는 자원과 보호의 경계이고, 스레드는 그 안에서 스케줄되는 실행 흐름이다.',
      },
      {
        kind: 'misconception',
        stem: '스레드는 스택만 따로 가진다고 해도 되는가?',
        choices: [
          { text: '스택만 따로 가지고 레지스터는 프로세스가 공유한다', leadsTo: 1 },
          { text: '레지스터와 errno 등도 각자 가진다', correct: true },
          { text: '레지스터까지 모두 공유하고 따로 갖는 것이 없다', leadsTo: 1 },
          { text: '스택과 함께 힙도 스레드마다 따로 가진다', leadsTo: 0 },
        ],
        rationale:
          '공유 범위는 언어 런타임과 운영체제에 따라 세부가 달라진다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스 전환은 항상 무겁고 스레드 전환은 항상 싼가?',
        choices: [
          { text: '전환 비용은 없다', leadsTo: 1 },
          { text: '그렇게 고정해도 된다', leadsTo: 1 },
          { text: '반대로 고정해야 한다', leadsTo: 1 },
          { text: '고정하지 않는다. 스레드 전환에도 비용이 남는다', correct: true },
        ],
        rationale:
          '같은 주소 공간을 유지해 더 쌀 수 있지만 레지스터 저장, 스케줄러와 캐시 비용은 남는다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '가상 메모리 관리에서 페이징과 세그먼테이션은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '페이징에서 가상 쪽과 물리 쪽을 부르는 이름은?',
        choices: [
          { text: '블록과 섹터', leadsTo: 1 },
          { text: '세그먼트와 페이지', leadsTo: 0 },
          { text: '페이지와 프레임', correct: true },
          { text: '둘 다 페이지', leadsTo: 2 },
        ],
        rationale:
          '고정 크기로 나눠 할당과 회수를 단순하게 만든다.',
      },
      {
        kind: 'misconception',
        stem: '요즘 범용 운영체제가 중심으로 쓰는 쪽은?',
        choices: [
          { text: '페이징', correct: true },
          { text: '세그먼테이션', leadsTo: 0 },
          { text: '둘을 반씩', leadsTo: 4 },
          { text: '둘 다 쓰지 않는다', leadsTo: 4 },
        ],
        rationale:
          '세그먼테이션을 어디까지 쓰는지는 아키텍처마다 다르다.',
      },
      {
        kind: 'boundary',
        stem: '세그먼트를 다시 페이징으로 관리하면 무엇이 해결되는가?',
        choices: [
          { text: '페이지 부재', leadsTo: 1 },
          { text: '내부 파편화', leadsTo: 0 },
          { text: '외부 파편화', correct: true },
          { text: '주소 변환 비용', leadsTo: 2 },
        ],
        rationale:
          '논리적 영역은 세그먼트로 나누고 그 안을 고정 크기로 다시 나누는 방식이다.',
      },
    ],
  },
  {
    identityScope: 'process',
    question: '좀비 프로세스는 왜 남는가?',
    items: [
      {
        kind: 'concept',
        stem: '좀비가 남겨 두는 것은?',
        choices: [
          { text: '실행 중이던 스레드', leadsTo: 4 },
          { text: '쓰던 메모리 전부', leadsTo: 2 },
          { text: '열린 파일과 소켓', leadsTo: 2 },
          { text: '프로세스 표의 한 줄과 종료 상태, 번호', correct: true },
        ],
        rationale:
          '쓰던 메모리는 이미 내놓았다. 부모가 종료 상태를 가져갈 때까지 커널이 그 자리를 남겨 둔다.',
      },
      {
        kind: 'misconception',
        stem: '고아 프로세스는 좀비인가?',
        choices: [
          { text: '아니다. 부모가 먼저 죽어 init이 거둔다', correct: true },
          { text: '부모가 없다는 점에서 같은 말이다', leadsTo: 4 },
          { text: '거둘 부모가 없어 고아가 더 위험하다', leadsTo: 4 },
          { text: '거두는 쪽이 없어 고아는 영원히 남는다', leadsTo: 4 },
        ],
        rationale:
          '좀비는 오히려 부모가 살아서 방치할 때 남는다.',
      },
      {
        kind: 'boundary',
        stem: '좀비가 실제로 문제가 되는 지점은?',
        choices: [
          { text: 'CPU를 계속 쓴다', leadsTo: 0 },
          { text: '하나만 생겨도 메모리가 샌다', leadsTo: 0 },
          { text: '표 한도를 채워 새 프로세스를 못 만들 때', correct: true },
          { text: '문제가 되지 않는다', leadsTo: 2 },
        ],
        rationale:
          '하나둘로는 표가 안 난다. 자식을 많이 띄우는 서버에서 개수가 쌓일 때 드러난다.',
      },
    ],
  },
  {
    identityScope: 'cpu',
    question: '코어마다 캐시가 따로인데 값이 어긋나지 않는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '값이 어긋나지 않게 지키는 주체는?',
        choices: [
          { text: '프로그래머가 코드로', leadsTo: 2 },
          { text: '컴파일러', leadsTo: 2 },
          { text: '운영체제 커널', leadsTo: 1 },
          { text: '하드웨어', correct: true },
        ],
        rationale:
          '캐시 줄마다 상태를 달아 두고 남이 같은 자리를 건드리면 상태를 바꾼다. 프로그래머가 다루는 것은 순서와 가시성 쪽이다.',
      },
      {
        kind: 'misconception',
        stem: '서로 다른 변수인데 성능이 나빠지는 경우가 있는가?',
        choices: [
          { text: '코어가 하나면 생긴다', leadsTo: 0 },
          { text: '다른 변수면 영향이 없다', leadsTo: 0 },
          { text: '같은 타입일 때만 영향이 있다', leadsTo: 3 },
          { text: '한 캐시 줄에 붙어 있으면 값이 계속 오간다', correct: true },
        ],
        rationale:
          '이것을 거짓 공유라 부른다. 변수 사이를 벌려 다른 줄에 놓으면 사라진다.',
      },
      {
        kind: 'boundary',
        stem: 'Shared 상태에서 쓰려면 무엇이 먼저인가?',
        choices: [
          { text: '메모리에 먼저 내린다', leadsTo: 1 },
          { text: '바로 쓴다', leadsTo: 4 },
          { text: '커널에 알린다', leadsTo: 0 },
          { text: '다른 코어의 사본을 무효로 만든다', correct: true },
        ],
        rationale:
          'Modified나 Exclusive 상태에서는 그 줄을 혼자 쓰므로 그 절차가 필요 없다.',
      },
    ],
  },
  {
    identityScope: 'process',
    question: '급한 일이 안 급한 일에 밀리는 경우가 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '역전이 일어나는 구조는?',
        choices: [
          { text: '급한 일의 우선순위를 잘못 매겼을 때', leadsTo: 1 },
          { text: '급한 쪽이 기다리는 잠금을 느린 쪽이 쥐었을 때', correct: true },
          { text: '스케줄러가 우선순위를 잘못 읽었을 때', leadsTo: 0 },
          { text: '잠금 없이 공유 자원을 함께 만질 때', leadsTo: 4 },
        ],
        rationale:
          '느린 일이 중간 일에 밀려 돌지 못하면 결국 급한 일이 중간 일에 밀린 셈이 된다.',
      },
      {
        kind: 'misconception',
        stem: '이것은 기아 상태와 같은 것인가?',
        choices: [
          { text: '오래 굶는 기아의 더 심한 경우다', leadsTo: 2 },
          { text: '같은 현상의 다른 이름이다', leadsTo: 2 },
          { text: '다르다. 우선순위가 뒤집힌 것이다', correct: true },
          { text: '둘 다 잠금과 무관한 스케줄링 문제다', leadsTo: 4 },
        ],
        rationale:
          '이름이 역전인 이유가 거기 있다.',
      },
      {
        kind: 'boundary',
        stem: '푸는 방법은?',
        choices: [
          { text: '잠금을 쥔 쪽의 우선순위를 잠깐 올린다', correct: true },
          { text: '급한 일의 우선순위를 더 올린다', leadsTo: 0 },
          { text: '중간 일을 없앤다', leadsTo: 1 },
          { text: '잠금 시간을 늘린다', leadsTo: 4 },
        ],
        rationale:
          '급한 쪽만큼 올려 주면 중간 일이 끼어들지 못한다. 화성 탐사선 패스파인더가 이 설정으로 문제를 고쳤다.',
      },
    ],
  },
  {
    identityScope: 'process',
    question: '파일 디스크립터 3은 무엇을 가리키는가?',
    items: [
      {
        kind: 'concept',
        stem: '숫자에서 파일까지 몇 겹을 지나는가?',
        choices: [
          { text: '곧바로 파일을 가리킨다', leadsTo: 1 },
          { text: '프로세스별 표, 열린 파일 표, 아이노드', correct: true },
          { text: '프로세스별 표 하나만 거친다', leadsTo: 1 },
          { text: '커널이 매번 이름으로 찾는다', leadsTo: 4 },
        ],
        rationale:
          '소켓이나 파이프면 마지막 겹이 다르다.',
      },
      {
        kind: 'misconception',
        stem: '같은 파일을 두 번 열면 읽는 위치는?',
        choices: [
          { text: '두 번째 열기가 실패한다', leadsTo: 3 },
          { text: '함께 움직인다', leadsTo: 1 },
          { text: '각자 따로 기억한다', correct: true },
          { text: '운영체제가 하나로 합친다', leadsTo: 1 },
        ],
        rationale:
          '가운데 표가 있는 이유가 그것이다. dup으로 복제하면 반대로 같은 칸을 가리켜 위치가 함께 움직인다.',
      },
      {
        kind: 'boundary',
        stem: '0, 1, 2번은 특별한 번호인가?',
        choices: [
          { text: '닫을 수 없다', leadsTo: 2 },
          { text: '커널이 예약해 둔 특별한 번호다', leadsTo: 0 },
          { text: '먼저 열려 있을 뿐이고 닫으면 다음 열기가 그 번호를 받는다', correct: true },
          { text: '파일이 아니라 장치 전용이다', leadsTo: 4 },
        ],
        rationale:
          '표준 입출력이 그 자리를 쓰기로 약속돼 있을 뿐 번호 자체는 평범하다.',
      },
    ],
  },
  {
    identityScope: 'cpu',
    question: '조건문 하나가 성능을 좌우하는 경우가 있는가?',
    items: [
      {
        kind: 'concept',
        stem: 'CPU가 조건의 답이 나오기 전에 하는 일은?',
        choices: [
          { text: '멈춰서 기다린다', leadsTo: 2 },
          { text: '한쪽을 골라 미리 진행한다', correct: true },
          { text: '양쪽을 모두 끝까지 실행한다', leadsTo: 1 },
          { text: '순서를 뒤로 미룬다', leadsTo: 3 },
        ],
        rationale:
          '틀리면 그동안 한 것을 버리고 다시 채워야 한다.',
      },
      {
        kind: 'misconception',
        stem: '같은 데이터를 정렬만 해도 빨라지는 이유는?',
        choices: [
          { text: '한동안 같은 쪽만 나와 예측이 잘 맞는다', correct: true },
          { text: '비교 횟수가 줄어서', leadsTo: 0 },
          { text: '캐시에 더 잘 들어가서', leadsTo: 0 },
          { text: '정렬해도 빨라지지 않는다', leadsTo: 0 },
        ],
        rationale:
          '하는 일은 똑같은데 예측이 맞는 비율이 달라진다.',
      },
      {
        kind: 'boundary',
        stem: '분기를 아예 없애는 방법의 대가는?',
        choices: [
          { text: '예측이 더 자주 틀린다', leadsTo: 2 },
          { text: '항상 느려진다', leadsTo: 2 },
          { text: '읽기 어려워져 재 보고 정해야 한다', correct: true },
          { text: '대가가 없다', leadsTo: 1 },
        ],
        rationale:
          '조건 대신 산술로 고르면 예측할 것이 없어진다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '읽은 파일이 두 번째부터 빨라지는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '두 번째 읽기가 빠른 까닭은?',
        choices: [
          { text: '운영체제가 내용을 메모리에 들고 있어서', correct: true },
          { text: '디스크가 예열돼 회전이 빨라져서', leadsTo: 4 },
          { text: '파일이 압축돼 읽을 양이 줄어서', leadsTo: 3 },
          { text: '두 번째부터는 검사를 건너뛰어서', leadsTo: 0 },
        ],
        rationale:
          '페이지 캐시가 남는 메모리를 써서 파일 내용을 들고 있는다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 거의 다 찬 것처럼 보이면 문제인가?',
        choices: [
          { text: '캐시를 꺼야 한다', leadsTo: 3 },
          { text: '메모리 누수다', leadsTo: 1 },
          { text: '즉시 비워야 한다', leadsTo: 1 },
          { text: '정상이다. 다른 곳에서 필요하면 그때 내준다', correct: true },
        ],
        rationale:
          '이 자리는 남는 메모리를 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '성능을 잴 때 이 자리를 잊으면?',
        choices: [
          { text: '두 번째 측정이 빠른 것을 코드 덕으로 착각한다', correct: true },
          { text: '측정값이 항상 느려진다', leadsTo: 2 },
          { text: '측정이 실패한다', leadsTo: 2 },
          { text: '아무 영향이 없다', leadsTo: 1 },
        ],
        rationale:
          '쓰기도 일단 이 자리에 적어 두고 나중에 모아 내리므로 빨라 보인다. 갑자기 꺼지면 아직 안 내려간 것이 사라진다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '큰 파일을 통째로 읽으면 무엇이 문제인가?',
    items: [
      {
        kind: 'concept',
        stem: '메모리를 얼마나 잡는가?',
        choices: [
          { text: '항상 일정하다', leadsTo: 0 },
          { text: '파일 크기와 정확히 같다', leadsTo: 0 },
          { text: '파일 크기와 무관하다', leadsTo: 4 },
          { text: '파일 크기에 비례하고 대개 그보다 더 든다', correct: true },
        ],
        rationale:
          '읽어 온 바이트를 문자열이나 객체로 바꾸면 그만큼이 또 든다. 파일 크기만 보고 여유를 재면 모자란다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 넉넉하면 통째로 읽어도 되는가?',
        choices: [
          { text: '파일이 작으면 언제나 안전하다', leadsTo: 1 },
          { text: '넉넉하면 문제없다', leadsTo: 1 },
          { text: '같은 일을 동시에 열 명이 하면 열 배를 잡는다', correct: true },
          { text: '운영체제가 알아서 나눠 준다', leadsTo: 0 },
        ],
        rationale:
          '혼자 시험하면 이 한계가 안 보인다.',
      },
      {
        kind: 'boundary',
        stem: '무엇을 보고 위험을 판단하는가?',
        choices: [
          { text: '파일 확장자', leadsTo: 0 },
          { text: '메모리 사용량이 입력 크기에 비례하는지', correct: true },
          { text: '코드 줄 수', leadsTo: 3 },
          { text: '디스크 여유 공간', leadsTo: 4 },
        ],
        rationale:
          '비례하면 입력이 커질 때 그대로 무너진다. 정렬처럼 전체를 봐야 하는 일은 나눠 처리하고 합치는 방식으로 바꾼다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '프로세스가 죽으면 무엇이 정리되고 무엇이 남는가?',
    items: [
      {
        kind: 'concept',
        stem: '죽은 뒤에도 남는 것은?',
        choices: [
          { text: '부모에게 전할 종료 상태', correct: true },
          { text: '쓰던 메모리', leadsTo: 0 },
          { text: '열어 둔 파일 디스크립터', leadsTo: 3 },
          { text: '실행 중이던 스레드', leadsTo: 0 },
        ],
        rationale:
          '메모리 같은 자원은 커널이 거둬 가고, 종료 상태는 부모가 거둘 때까지 남는다.',
      },
      {
        kind: 'misconception',
        stem: '강제 종료로 죽이면 커널 자원도 안 회수되는가?',
        choices: [
          { text: '자원도 회수되지 않는다', leadsTo: 2 },
          { text: '자원 회수는 된다. 못 도는 것은 정리 코드다', correct: true },
          { text: '파일은 닫히고 메모리만 남는다', leadsTo: 0 },
          { text: '재부팅해야 커널이 회수한다', leadsTo: 2 },
        ],
        rationale:
          '잡을 수 없는 신호로 죽이면 종료 훅과 임시 파일 정리는 못 돌지만, 커널 자원 회수는 그와 무관하다.',
      },
      {
        kind: 'boundary',
        stem: '혼자 쥐고 있던 포트와 잠금은?',
        choices: [
          { text: '부모가 거둬야 풀린다', leadsTo: 0 },
          { text: '재부팅까지 잠긴 채 남는다', leadsTo: 3 },
          { text: '죽음과 함께 풀린다. 해제 코드를 못 돌렸어도 그렇다', correct: true },
          { text: '수동으로 풀어야 한다', leadsTo: 3 },
        ],
        rationale:
          '파일 디스크립터가 닫히기 때문이다. 다른 프로세스와 공유하던 것이면 마지막 참조가 닫힐 때까지 대상은 남는다.',
      },
    ],
  },
  {
    identityScope: 'os',
    question: '데몬 프로세스는 왜 세션 리더로 지정되지 않는가?',
    items: [
      {
        kind: 'concept',
        stem: '세션 리더만 할 수 있는 일은?',
        choices: [
          { text: '신호를 보내는 것', leadsTo: 2 },
          { text: '자식을 만드는 것', leadsTo: 1 },
          { text: '제어 터미널을 획득하는 것', correct: true },
          { text: '파일을 여는 것', leadsTo: 4 },
        ],
        rationale:
          '그래서 리더가 아닌 채로 남으면 터미널 쪽 신호와 엮이지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '한 번 fork해서 setsid()만 부르면 충분한가?',
        choices: [
          { text: 'setsid()만으로 리더가 아니게 된다', leadsTo: 0 },
          { text: '충분하다. 터미널이 떨어진다', leadsTo: 1 },
          { text: '그 자식이 리더가 되므로 한 번 더 fork한다', correct: true },
          { text: 'fork를 세 번 해야 한다', leadsTo: 1 },
        ],
        rationale:
          'setsid()를 부르면 새 세션의 리더가 되면서 제어 터미널이 떨어진다. 여기서 한 번 더 fork해야 최종 데몬이 리더가 아니게 된다.',
      },
      {
        kind: 'boundary',
        stem: 'systemd가 띄우는 요즘 데몬은?',
        choices: [
          { text: '같은 절차를 반드시 밟는다', leadsTo: 1 },
          { text: '이 절차를 밟지 않는다', correct: true },
          { text: 'fork를 세 번 한다', leadsTo: 1 },
          { text: '세션 리더로 남는다', leadsTo: 0 },
        ],
        rationale:
          '더블 포크는 전통적인 방식이고, 요즘은 관리자가 그 역할을 대신한다.',
      },
    ],
  },
  {
    identityScope: 'postgres',
    question: '격리 수준을 올리면 무엇을 잃는가?',
    items: [
      {
        kind: 'concept',
        stem: '수준을 올리면 잃는 것은?',
        choices: [
          { text: '저장 공간', leadsTo: 1 },
          { text: '데이터 정확성', leadsTo: 0 },
          { text: '동시성', correct: true },
          { text: '잃는 것이 없다', leadsTo: 3 },
        ],
        rationale:
          '위로 올라갈수록 막아주는 현상이 늘지만 그만큼 잠금을 오래 넓게 쥔다.',
      },
      {
        kind: 'misconception',
        stem: '수준을 고르는 기준은?',
        choices: [
          { text: '무엇을 견딜 수 있는지', correct: true },
          { text: '무엇을 막고 싶은지', leadsTo: 0 },
          { text: '데이터베이스 기본값', leadsTo: 2 },
          { text: '테이블 크기', leadsTo: 4 },
        ],
        rationale:
          '대부분의 화면은 조금 어긋난 값을 견딘다. 읽은 값을 근거로 판단하는 자리만 위로 올린다.',
      },
      {
        kind: 'boundary',
        stem: '가장 높은 수준을 써도 애플리케이션에 남는 일은?',
        choices: [
          { text: '아무것도 없다', leadsTo: 3 },
          { text: '취소된 트랜잭션을 다시 시도하는 코드', correct: true },
          { text: '잠금을 직접 거는 코드', leadsTo: 4 },
          { text: '버전을 직접 비교하는 코드', leadsTo: 2 },
        ],
        rationale:
          '전부 줄 세우는 것이 아니라 충돌을 감지해 한쪽을 취소하는 방식이다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '데이터베이스 정규화를 수행하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '정규화가 하려는 일에 가까운 것은?',
        choices: [
          { text: '한 사실을 그것을 결정하는 키와 함께 한곳에 두는 것', correct: true },
          { text: '중복을 무조건 없애는 것', leadsTo: 3 },
          { text: '표 개수를 늘리는 것', leadsTo: 1 },
          { text: '조회 속도를 높이는 것', leadsTo: 4 },
        ],
        rationale:
          '변경 규칙과 데이터의 의존 관계를 스키마에 드러내는 일이다.',
      },
      {
        kind: 'misconception',
        stem: '표를 나누면 무결성이 생기는가?',
        choices: [
          { text: '아니다. 키·고유·외래 키 같은 제약을 함께 둬야 한다', correct: true },
          { text: '나누기만 하면 생긴다', leadsTo: 1 },
          { text: '애플리케이션 코드의 약속으로 충분하다', leadsTo: 1 },
          { text: '정규형 단계가 높으면 저절로 생긴다', leadsTo: 2 },
        ],
        rationale:
          '데이터베이스가 검사할 제약을 두어야 참조 관계가 지켜진다.',
      },
      {
        kind: 'boundary',
        stem: '조인이 있으면 느린가?',
        choices: [
          { text: '단정하지 않는다. 질의 계획과 데이터 크기에서 측정한다', correct: true },
          { text: '조인 수에 비례해 항상 느리다', leadsTo: 3 },
          { text: '조인은 언제나 빠르다', leadsTo: 3 },
          { text: '정규형이 높으면 빨라진다', leadsTo: 1 },
        ],
        rationale:
          '읽기 병목 때문에 중복을 두면 원본의 주인, 갱신 방식, 허용 지연과 다시 만드는 절차까지 함께 설계한다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '트랜잭션 격리 수준을 결정하는 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇부터 보는가?',
        choices: [
          { text: '격리 수준의 이름', leadsTo: 4 },
          { text: '깨지면 안 되는 업무 규칙과 재시도 가능 여부', correct: true },
          { text: '데이터베이스 종류', leadsTo: 3 },
          { text: '테이블 개수', leadsTo: 0 },
        ],
        rationale:
          '격리 수준 이름부터 고르지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '같은 이름이면 데이터베이스마다 같은 동작인가?',
        choices: [
          { text: '이름만 다르고 동작은 같다', leadsTo: 2 },
          { text: '표준이라 모두 같다', leadsTo: 2 },
          { text: '다르게 구현한다. 기본값도 제품마다 다르다', correct: true },
          { text: '기본값은 모두 Read Committed다', leadsTo: 3 },
        ],
        rationale:
          'PostgreSQL의 기본값은 Read Committed지만 InnoDB의 기본값은 Repeatable Read다. 기본값이 업무에 맞는다는 뜻도 아니다.',
      },
      {
        kind: 'boundary',
        stem: '수준을 올리면 잠금이 반드시 늘어나는가?',
        choices: [
          { text: '단정할 수 없다. 구현이 다르므로 재고 고른다', correct: true },
          { text: '반드시 비례해서 늘어난다', leadsTo: 3 },
          { text: '오히려 줄어든다', leadsTo: 3 },
          { text: '잠금과 무관하다', leadsTo: 0 },
        ],
        rationale:
          'MVCC, 간격 잠금, 서로 다른 직렬화 구현이 있다. 실제 충돌률·대기 시간·재시도 횟수를 재고 선택한다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '데이터베이스 뷰는 언제 사용하는가?',
    items: [
      {
        kind: 'concept',
        stem: '뷰가 저장하는 것은?',
        choices: [
          { text: '쿼리문 정의', correct: true },
          { text: '조회 결과 데이터', leadsTo: 0 },
          { text: '인덱스', leadsTo: 4 },
          { text: '원본 테이블의 사본', leadsTo: 0 },
        ],
        rationale:
          '가상 테이블로서 실제 데이터를 저장하지 않는다. 그래서 물리적 공간은 정의만큼만 든다.',
      },
      {
        kind: 'misconception',
        stem: '뷰를 쓰면 조회가 빨라지는가?',
        choices: [
          { text: '조회 시마다 정의된 쿼리가 실행된다', correct: true },
          { text: '결과가 저장돼 빨라진다', leadsTo: 0 },
          { text: '인덱스가 자동으로 생긴다', leadsTo: 4 },
          { text: '항상 원본보다 빠르다', leadsTo: 2 },
        ],
        rationale:
          '원본 테이블의 인덱스를 타지 못하는 복잡한 뷰는 오히려 성능 저하를 일으킬 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '보안 측면에서 뷰가 하는 일은?',
        choices: [
          { text: '원본을 읽기 전용으로 만든다', leadsTo: 1 },
          { text: '데이터를 암호화한다', leadsTo: 3 },
          { text: '접근 로그를 남긴다', leadsTo: 3 },
          { text: '민감한 정보를 뺀 컬럼만 노출한다', correct: true },
        ],
        rationale:
          '뷰를 거치면 원본 테이블을 열지 않고 필요한 데이터만 내보낼 수 있다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '데이터베이스 스키마를 설계할 때 고려할 점은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '정규화가 막아 주는 것은?',
        choices: [
          { text: '동시 접근 충돌', leadsTo: 3 },
          { text: '조회 속도 저하', leadsTo: 0 },
          { text: '디스크 용량 초과', leadsTo: 2 },
          { text: '삽입·수정·삭제에서 생기는 이상 현상', correct: true },
        ],
        rationale:
          '중복을 없애 테이블을 쪼개면 데이터 신뢰도가 올라간다.',
      },
      {
        kind: 'misconception',
        stem: '비정규화는 언제 선택하는가?',
        choices: [
          { text: '읽기가 훨씬 많고 조인 비용이 실제 병목일 때', correct: true },
          { text: '테이블이 많아 보일 때', leadsTo: 0 },
          { text: '쓰기가 많을 때', leadsTo: 1 },
          { text: '언제나 성능에 유리하다', leadsTo: 1 },
        ],
        rationale:
          '쓰기가 많다면 중복된 값을 함께 고치는 비용이 더 커진다.',
      },
      {
        kind: 'boundary',
        stem: '비정규화가 늘리는 비용은?',
        choices: [
          { text: '중복 갱신 비용', correct: true },
          { text: '조회 복잡도', leadsTo: 0 },
          { text: '인덱스 개수', leadsTo: 2 },
          { text: '늘어나는 비용이 없다', leadsTo: 1 },
        ],
        rationale:
          '조회는 단순해지지만 같은 값을 여러 곳에서 맞춰야 한다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'JOIN 연산의 성능을 결정하는 핵심 요소는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '인덱스가 있는 소량 데이터에 맞는 방식은?',
        choices: [
          { text: 'Merge Join', leadsTo: 0 },
          { text: 'Hash Join', leadsTo: 1 },
          { text: 'Nested Loop', correct: true },
          { text: '방식과 무관하다', leadsTo: 2 },
        ],
        rationale:
          '바깥쪽 행마다 안쪽을 탐색하는데, 안쪽 조인 컬럼에 인덱스가 있으면 행마다 찾는 비용이 작다.',
      },
      {
        kind: 'misconception',
        stem: 'Hash Join은 어느 쪽으로 해시 맵을 만드는가?',
        choices: [
          { text: '두 테이블 중 작은 쪽', correct: true },
          { text: '큰 쪽', leadsTo: 2 },
          { text: '먼저 쓴 쪽', leadsTo: 0 },
          { text: '인덱스가 있는 쪽', leadsTo: 1 },
        ],
        rationale:
          '이후 큰 테이블을 읽으며 해시 맵에서 일치하는 값을 찾는다.',
      },
      {
        kind: 'boundary',
        stem: '방식을 고르는 주체는?',
        choices: [
          { text: '무작위로 정해진다', leadsTo: 2 },
          { text: '개발자가 쿼리에 적는다', leadsTo: 0 },
          { text: '통계 정보를 보는 옵티마이저', correct: true },
          { text: '항상 같은 방식만 쓴다', leadsTo: 3 },
        ],
        rationale:
          '데이터 양과 인덱스 상태를 보고 가장 싼 비용의 방식을 결정한다. 정렬 상태에 따라 Merge Join이 뽑히기도 한다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '인덱스 생성 시 읽기 성능과 쓰기 성능의 트레이드오프는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '인덱스가 읽기에서 하는 일은?',
        choices: [
          { text: '후보 행을 빨리 좁힌다', correct: true },
          { text: '데이터를 미리 계산해 둔다', leadsTo: 4 },
          { text: '결과를 캐시한다', leadsTo: 4 },
          { text: '테이블을 압축한다', leadsTo: 2 },
        ],
        rationale:
          '맞는 연산과 열 순서면 읽을 범위가 줄어든다. 일부 행만 찾을수록 유리하다.',
      },
      {
        kind: 'misconception',
        stem: '인덱스가 있으면 모든 읽기가 빨라지는가?',
        choices: [
          { text: '조회 컬럼과 무관하게 빨라진다', leadsTo: 0 },
          { text: '모든 읽기가 빨라진다', leadsTo: 0 },
          { text: '아니다. 연산과 열 순서, 선택도가 맞아야 한다', correct: true },
          { text: '개수가 많을수록 빨라진다', leadsTo: 2 },
        ],
        rationale:
          '복합 인덱스는 앞쪽 열의 조건이 탐색 범위를 줄이는 데 특히 중요하다.',
      },
      {
        kind: 'boundary',
        stem: '인덱스를 둘지 결정하는 방법은?',
        choices: [
          { text: '실제 크기와 값 분포에서 계획과 실행 시간을 본다', correct: true },
          { text: '테이블당 개수 상한을 정해 둔다', leadsTo: 0 },
          { text: '조회에 쓰는 모든 컬럼에 만든다', leadsTo: 1 },
          { text: '경험으로 감을 잡는다', leadsTo: 4 },
        ],
        rationale:
          '사용 빈도·쓰기 지연·인덱스 크기도 함께 재고 거의 쓰이지 않는 인덱스는 제거한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'DBSCAN은 K-means보다 어떤 상황에서 더 유리한가?',
    items: [
      {
        kind: 'concept',
        stem: 'DBSCAN이 묶는 기준은?',
        choices: [
          { text: '중심점과의 거리', leadsTo: 0 },
          { text: '밀도', correct: true },
          { text: '클러스터 개수', leadsTo: 0 },
          { text: '데이터 순서', leadsTo: 4 },
        ],
        rationale:
          '설정한 거리 안에 최소 점 개수가 있으면 연결한다. 그래서 길쭉하거나 휘어진 모양도 잡는다.',
      },
      {
        kind: 'misconception',
        stem: 'K-means는 외곽의 드문 점을 어떻게 다루는가?',
        choices: [
          { text: '모든 점을 강제로 클러스터에 넣는다', correct: true },
          { text: '노이즈로 빼 둔다', leadsTo: 1 },
          { text: '새 클러스터를 만든다', leadsTo: 0 },
          { text: '무시하고 버린다', leadsTo: 1 },
        ],
        rationale:
          '밀도가 낮은 외곽의 점들이 중심점과 묶여 클러스터의 모양을 왜곡시킨다.',
      },
      {
        kind: 'boundary',
        stem: '두 방식이 요구하는 파라미터의 차이는?',
        choices: [
          { text: 'K-means는 개수, DBSCAN은 밀도 기준', correct: true },
          { text: '둘 다 나눌 클러스터 개수를 받는다', leadsTo: 0 },
          { text: '둘 다 알아서 정하므로 파라미터가 없다', leadsTo: 1 },
          { text: 'DBSCAN이 개수를 받는다', leadsTo: 0 },
        ],
        rationale:
          '데이터 모양을 미리 정하기 어렵거나 이상치를 따로 가려야 할 때 밀도 기준이 맞다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '테이블 설계 시 기본키를 설정하는 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '기본키가 갖춰야 할 성질은?',
        choices: [
          { text: '사람이 읽기 쉬울 것', leadsTo: 4 },
          { text: '유일하고 바뀌지 않을 것', correct: true },
          { text: '업무 의미를 담을 것', leadsTo: 4 },
          { text: '길이가 길 것', leadsTo: 3 },
        ],
        rationale:
          '후보키 중에서 짧고 변하지 않으며 중복이 없는 키를 고른다.',
      },
      {
        kind: 'misconception',
        stem: '이메일이나 전화번호를 기본키로 쓰면?',
        choices: [
          { text: '바뀔 수 있어 참조가 흔들린다', correct: true },
          { text: '유일하니 적합하다', leadsTo: 4 },
          { text: '인덱스가 빨라진다', leadsTo: 3 },
          { text: '문제가 없다', leadsTo: 4 },
        ],
        rationale:
          '대리 키를 쓰면 실제 데이터가 바뀌어도 외래 키 참조는 그대로 유지된다.',
      },
      {
        kind: 'boundary',
        stem: '기본키가 크면 왜 불리한가?',
        choices: [
          { text: '외래 키를 못 만든다', leadsTo: 1 },
          { text: '유일성이 깨진다', leadsTo: 0 },
          { text: '한 페이지에 적게 담겨 훑을 페이지가 는다', correct: true },
          { text: '불리하지 않다', leadsTo: 3 },
        ],
        rationale:
          'B-Tree에서는 키가 작을수록 한 페이지에 더 많이 담긴다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '인덱스 생성 시 조회 성능과 쓰기 성능의 트레이드오프는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '쓰기가 느려지는 까닭은?',
        choices: [
          { text: '디스크에 두 번 쓰기 때문에만', leadsTo: 3 },
          { text: '넣을 때마다 인덱스의 순서를 유지해야 해서', correct: true },
          { text: '잠금을 더 걸어서', leadsTo: 4 },
          { text: '느려지지 않는다', leadsTo: 0 },
        ],
        rationale:
          '삽입, 수정, 삭제 시 관련 인덱스를 함께 고쳐야 한다.',
      },
      {
        kind: 'misconception',
        stem: '모든 인덱스가 키를 정렬해 두는가?',
        choices: [
          { text: '해시 인덱스는 정렬하지 않는다', correct: true },
          { text: '모두 정렬해 둔다', leadsTo: 0 },
          { text: '클러스터형만 정렬한다', leadsTo: 3 },
          { text: '정렬은 조회할 때만 한다', leadsTo: 4 },
        ],
        rationale:
          'B-Tree 계열 보조 인덱스는 키를 정렬해 따로 두고, 클러스터형은 데이터 자체가 그 순서다.',
      },
      {
        kind: 'boundary',
        stem: '인덱스를 무분별하게 만들면?',
        choices: [
          { text: '옵티마이저가 알아서 무시한다', leadsTo: 2 },
          { text: '조회만 계속 빨라진다', leadsTo: 1 },
          { text: '쓰기만 느려지고 나머지는 같다', leadsTo: 0 },
          { text: '디스크 입출력이 늘어 전체 성능이 떨어진다', correct: true },
        ],
        rationale:
          '데이터 분포와 쿼리 패턴을 보고 필요한 컬럼에만 둔다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '조인으로 인해 성능 저하가 발생하는 원인은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '조인 결과의 크기를 정하는 것은?',
        choices: [
          { text: '컬럼 개수', leadsTo: 0 },
          { text: '조인한 테이블 개수', leadsTo: 3 },
          { text: '키가 얼마나 겹치느냐', correct: true },
          { text: '인덱스 개수', leadsTo: 0 },
        ],
        rationale:
          '겹침이 많으면 중간 결과가 부풀고 정렬과 병합이 따라 는다.',
      },
      {
        kind: 'misconception',
        stem: 'Hash Join은 언제나 대량 데이터에 유리한가?',
        choices: [
          { text: '데이터 양과 무관하게 언제나 빠르다', leadsTo: 1 },
          { text: '메모리가 모자라면 디스크 입출력이 생겨 느려진다', correct: true },
          { text: '인덱스가 있어야만 쓸 수 있다', leadsTo: 0 },
          { text: '정렬이 필요하다', leadsTo: 4 },
        ],
        rationale:
          '작은 테이블을 메모리에 해시 테이블로 올린 뒤 큰 테이블을 스캔하는 방식이라 그 메모리가 전제다.',
      },
      {
        kind: 'boundary',
        stem: 'Merge Join이 유리한 자리는?',
        choices: [
          { text: '이미 정렬돼 있거나 범위 조인을 할 때', correct: true },
          { text: '한쪽이 아주 작을 때', leadsTo: 2 },
          { text: '인덱스가 전혀 없을 때', leadsTo: 1 },
          { text: '언제나 유리하다', leadsTo: 3 },
        ],
        rationale:
          '양쪽을 조인 키로 정렬한 뒤 순차적으로 읽으며 병합한다. 정렬 비용이 이미 치러졌다면 그만큼 이득이다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '커넥션 풀을 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '풀이 하는 일 둘은?',
        choices: [
          { text: '자동 재시도와 로드 밸런싱', leadsTo: 1 },
          { text: '질의 결과 캐시와 재사용', leadsTo: 0 },
          { text: '연결 재사용과 동시 작업 수 제한', correct: true },
          { text: '인덱스 관리와 통계 갱신', leadsTo: 3 },
        ],
        rationale:
          '연결 비용을 줄이는 것과 과부하를 막는 것 모두가 목적이다.',
      },
      {
        kind: 'misconception',
        stem: '풀을 크게 하면 처리량이 계속 오르는가?',
        choices: [
          { text: '데이터베이스가 감당할 수를 넘으면 경합이 커진다', correct: true },
          { text: '크게 할수록 계속 오른다', leadsTo: 0 },
          { text: '크기와 처리량은 무관하다', leadsTo: 0 },
          { text: '연결 수는 제한이 없다', leadsTo: 4 },
        ],
        rationale:
          '풀에 연결이 있다는 이유만으로 느린 질의가 빨라지지도 않는다.',
      },
      {
        kind: 'boundary',
        stem: '풀 대기 제한을 어떻게 두는가?',
        choices: [
          { text: '질의 실행 시간과 같게', leadsTo: 0 },
          { text: '가능한 한 길게', leadsTo: 1 },
          { text: '제한을 두지 않는다', leadsTo: 1 },
          { text: '사용자 요청의 남은 시간보다 짧게', correct: true },
        ],
        rationale:
          '오래 기다린 뒤 질의를 시작하면 이미 응답할 시간이 없다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'RDB와 NoSQL 중 무엇을 기준으로 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇부터 적어야 하는가?',
        choices: [
          { text: '데이터 관계, 함께 지킬 규칙, 주로 읽는 모양', correct: true },
          { text: '제품 이름과 버전', leadsTo: 1 },
          { text: '팀이 익숙한 기술', leadsTo: 1 },
          { text: '예상 데이터 크기', leadsTo: 2 },
        ],
        rationale:
          'NoSQL은 하나의 방식이 아니라 문서·키-값·와이드 컬럼·그래프 모델을 묶어 부르는 이름이다.',
      },
      {
        kind: 'misconception',
        stem: '관계형은 수직 확장, NoSQL은 수평 확장인가?',
        choices: [
          { text: '맞지 않는 구분이다. 둘 다 복제와 분할을 쓴다', correct: true },
          { text: '정확한 구분이다', leadsTo: 2 },
          { text: '반대로 알려져 있다', leadsTo: 2 },
          { text: '제품마다 다르다고만 할 수 있다', leadsTo: 4 },
        ],
        rationale:
          '차이는 그 경계를 넘는 조인·트랜잭션·질의에 드는 비용이다.',
      },
      {
        kind: 'boundary',
        stem: '스키마와 트랜잭션을 제품 분류로 단정할 수 있는가?',
        choices: [
          { text: '없다. 문서 데이터베이스도 검증과 트랜잭션을 제공한다', correct: true },
          { text: '분류만 알면 단정할 수 있다', leadsTo: 1 },
          { text: '관계형만 트랜잭션이 있다', leadsTo: 1 },
          { text: '스키마는 관계형 전용 개념이다', leadsTo: 1 },
        ],
        rationale:
          '그 보장의 범위와 운영 비용은 데이터 모델에 달려 있다. 팀이 안전하게 운영할 수 있는지까지 보고 고른다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '데이터베이스 복제와 클러스터링의 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '복제의 주된 쓰임은?',
        choices: [
          { text: '쓰기 처리량을 늘린다', leadsTo: 1 },
          { text: '사본을 두어 가용성과 읽기를 늘린다', correct: true },
          { text: '저장 공간을 줄인다', leadsTo: 2 },
          { text: '질의를 자동으로 최적화한다', leadsTo: 4 },
        ],
        rationale:
          '주로 읽기 전용 복제본을 늘려 읽기 트래픽을 분산시킨다.',
      },
      {
        kind: 'misconception',
        stem: '복제하면 모든 사본이 즉시 같은 값을 갖는가?',
        choices: [
          { text: '읽기 요청이 있어야 맞춰진다', leadsTo: 4 },
          { text: '언제나 즉시 같다', leadsTo: 0 },
          { text: '영원히 어긋난 채로 남는다', leadsTo: 0 },
          { text: '복제를 동기로 걸었는지에 따라 다르다', correct: true },
        ],
        rationale:
          '데이터가 복사되는 시점차로 복제 지연이 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '쓰기가 잦고 중단 없는 운영이 우선이면?',
        choices: [
          { text: '읽기 전용으로 바꾼다', leadsTo: 4 },
          { text: '복제본을 더 늘린다', leadsTo: 0 },
          { text: '클러스터링을 검토한다', correct: true },
          { text: '둘 다 도움이 안 된다', leadsTo: 2 },
        ],
        rationale:
          '노드 하나가 죽어도 서비스가 중단되지 않는 고가용성이 클러스터링의 핵심이다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '낙관적 락과 비관적 락은 무엇으로 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: '두 방식의 진짜 차이는?',
        choices: [
          { text: '충돌을 언제 발견하고 누가 기다리느냐', correct: true },
          { text: '최종 데이터의 정확성', leadsTo: 0 },
          { text: '쓸 수 있는 데이터베이스 종류', leadsTo: 3 },
          { text: '트랜잭션을 쓰는지 여부', leadsTo: 3 },
        ],
        rationale:
          '정확성은 두 방식 모두 만들 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '낙관적 방식은 잠금을 전혀 쓰지 않는가?',
        choices: [
          { text: '최종 갱신에서 데이터베이스 잠금을 쓰고 기다릴 수 있다', correct: true },
          { text: '잠금을 전혀 쓰지 않는다', leadsTo: 0 },
          { text: '읽을 때만 잠근다', leadsTo: 1 },
          { text: '잠금 대신 격리 수준을 올린다', leadsTo: 3 },
        ],
        rationale:
          '이름이 낙관적일 뿐 갱신 순간에는 같은 자원을 두고 겨룬다.',
      },
      {
        kind: 'boundary',
        stem: '재고나 결제라면 비관적 방식으로 고정하는가?',
        choices: [
          { text: '반드시 낙관적이어야 한다', leadsTo: 0 },
          { text: '돈이 걸렸으니 반드시 비관적이어야 한다', leadsTo: 1 },
          { text: '고정하지 않는다. 조건부 갱신과도 비교한다', correct: true },
          { text: '여러 서버라면 분산 락만이 답이다', leadsTo: 2 },
        ],
        rationale:
          '무엇이 업무 규칙을 더 작고 분명하게 지키는지로 고른다. 잠금을 잡은 채 외부 호출을 하면 대기와 교착 위험이 커진다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '인덱스 범위 스캔과 전체 스캔 중 무엇을 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '두 방식의 입출력이 갈리는 지점은?',
        choices: [
          { text: '흩어진 읽기인가 순차 읽기인가', correct: true },
          { text: '읽는 총 바이트 수', leadsTo: 2 },
          { text: '컬럼 개수', leadsTo: 1 },
          { text: '테이블 이름 길이', leadsTo: 3 },
        ],
        rationale:
          '인덱스만으로 필요한 칸이 다 채워지지 않으면 데이터 페이지를 따로 읽어야 하고 그 자리에서 흩어진 읽기가 생긴다.',
      },
      {
        kind: 'misconception',
        stem: '읽을 양이 많아도 인덱스가 유리한가?',
        choices: [
          { text: '데이터 양과 무관하다', leadsTo: 0 },
          { text: '언제나 인덱스가 빠르다', leadsTo: 2 },
          { text: '언제나 전체 스캔이 빠르다', leadsTo: 2 },
          { text: '일정 비율을 넘으면 전체 스캔이 빠르다', correct: true },
        ],
        rationale:
          '흩어진 읽기의 오버헤드가 순차적으로 읽는 쪽보다 커지는 지점이 있다.',
      },
      {
        kind: 'boundary',
        stem: '엉뚱한 스캔이 선택됐을 때 먼저 볼 것은?',
        choices: [
          { text: '통계 정보를 새로 모은다', correct: true },
          { text: '힌트부터 붙인다', leadsTo: 3 },
          { text: '인덱스를 지운다', leadsTo: 1 },
          { text: '테이블을 나눈다', leadsTo: 4 },
        ],
        rationale:
          '통계가 오래되면 옵티마이저의 비용 계산이 틀어진다. 통계를 갱신하고 쿼리와 인덱스를 살핀 뒤에야 힌트를 본다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'SQL과 NoSQL은 어떤 기준으로 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'SQL과 NoSQL은 같은 층위의 말인가?',
        choices: [
          { text: '둘 다 저장 엔진 이름이다', leadsTo: 3 },
          { text: '같은 층위의 두 제품군이다', leadsTo: 1 },
          { text: '둘 다 질의 언어다', leadsTo: 1 },
          { text: '아니다. 하나는 질의 언어, 하나는 여러 모델을 묶은 이름', correct: true },
        ],
        rationale:
          '둘을 하나의 성질로 단정하면 선택 기준이 흐려진다.',
      },
      {
        kind: 'misconception',
        stem: '문서 데이터베이스도 검증 규칙을 둘 수 있는가?',
        choices: [
          { text: '아니다. 아무 형태나 넣을 수 있다', leadsTo: 2 },
          { text: '아니다. 스키마는 관계형에만 있는 개념이다', leadsTo: 2 },
          { text: '그렇다. 스키마 유연성이 규칙 없음은 아니다', correct: true },
          { text: '아니다. 검증은 애플리케이션만 할 수 있다', leadsTo: 2 },
        ],
        rationale:
          '유연하다는 것은 규칙을 나중에 바꿀 수 있다는 뜻이지 규칙이 없다는 뜻이 아니다.',
      },
      {
        kind: 'boundary',
        stem: '용도만 보고 고를 수 있는가?',
        choices: [
          { text: '로그는 무조건 비관계형이다', leadsTo: 1 },
          { text: '없다. 대표 읽기·쓰기를 작게 시험해 비교한다', correct: true },
          { text: '결제는 무조건 관계형이다', leadsTo: 1 },
          { text: '팀 취향대로 고르면 된다', leadsTo: 0 },
        ],
        rationale:
          '지연 시간, 충돌률, 운영 복잡도를 함께 비교한다. 여러 저장소를 쓰면 동기화와 장애 대응 비용도 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'transaction',
    question: '갑자기 꺼져도 커밋한 것이 남는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '무엇을 먼저 디스크에 내리는가?',
        choices: [
          { text: '고쳐진 데이터 페이지', leadsTo: 3 },
          { text: '무엇을 고칠지 적은 로그', correct: true },
          { text: '인덱스', leadsTo: 0 },
          { text: '둘을 동시에', leadsTo: 2 },
        ],
        rationale:
          '데이터를 고치기 전에 바꿀 내용을 로그에 적고 그 로그를 먼저 내린다.',
      },
      {
        kind: 'misconception',
        stem: '커밋이 끝났다고 답하는 시점은?',
        choices: [
          { text: '체크포인트가 돈 시점', leadsTo: 0 },
          { text: '데이터 페이지가 디스크에 닿은 시점', leadsTo: 2 },
          { text: '메모리에서 고친 시점', leadsTo: 2 },
          { text: '로그가 디스크에 닿은 시점', correct: true },
        ],
        rationale:
          '데이터는 아직 메모리에만 있어도 된다. 여기저기 흩어진 페이지를 매번 내리는 대신 로그를 한 줄로 이어 붙이는 편이 빠르다.',
      },
      {
        kind: 'boundary',
        stem: '체크포인트가 없으면?',
        choices: [
          { text: '재시작 때 처음부터 다 읽어야 해 복구가 길어진다', correct: true },
          { text: '커밋한 것이 사라진다', leadsTo: 1 },
          { text: '로그를 못 쓴다', leadsTo: 1 },
          { text: '아무 차이가 없다', leadsTo: 0 },
        ],
        rationale:
          '체크포인트는 다시 읽기 시작할 지점을 앞으로 당긴다.',
      },
    ],
  },
  {
    identityScope: 'db',
    question: '읽기만 하는데도 잠금이 걸리는 경우가 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '읽기가 남을 기다리게 만드는 조건은?',
        choices: [
          { text: '읽는 행의 개수', leadsTo: 1 },
          { text: '고른 격리 수준', correct: true },
          { text: '테이블 크기', leadsTo: 4 },
          { text: '인덱스 유무', leadsTo: 1 },
        ],
        rationale:
          '위로 갈수록 남을 더 많이 막고 대신 이상한 현상이 줄어든다.',
      },
      {
        kind: 'misconception',
        stem: '요즘 데이터베이스는 읽을 때 잠그는가?',
        choices: [
          { text: '격리 수준과 무관하게 안 잠근다', leadsTo: 0 },
          { text: '언제나 잠근다', leadsTo: 2 },
          { text: '쓰기만 잠근다면 읽기도 막힌다', leadsTo: 2 },
          { text: '대부분 옛 버전을 남겨 두고 자기 시점을 읽는다', correct: true },
        ],
        rationale:
          '그래서 읽기가 쓰기를 안 막는다. 다만 가장 높은 수준에서는 겹치면 잠그거나 커밋 때 검사해 어긋난 쪽을 되돌린다.',
      },
      {
        kind: 'boundary',
        stem: '가장 먼저 확인할 것은?',
        choices: [
          { text: '표준이 정한 기본값', leadsTo: 3 },
          { text: '쓰는 데이터베이스의 기본 격리 수준', correct: true },
          { text: '테이블마다의 설정', leadsTo: 0 },
          { text: '확인할 것이 없다', leadsTo: 2 },
        ],
        rationale:
          '표준이 정한 기본은 SERIALIZABLE인데 그대로 쓰는 제품은 드물다. MySQL InnoDB는 REPEATABLE READ, PostgreSQL은 READ COMMITTED다.',
      },
    ],
  },
  {
    identityScope: 'db',
    question: '인덱스를 어느 칸부터 놓아야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '앞에 놓아야 하는 칸은?',
        choices: [
          { text: '값이 가장 큰 칸', leadsTo: 4 },
          { text: '범위로 걸리는 칸', leadsTo: 0 },
          { text: '정렬에 쓰는 칸', leadsTo: 2 },
          { text: '등호로 걸리는 칸', correct: true },
        ],
        rationale:
          '거기서 범위를 좁히고, 범위로 걸리는 칸을 뒤에 둔다.',
      },
      {
        kind: 'misconception',
        stem: '범위 조건 뒤의 칸은 어떻게 되는가?',
        choices: [
          { text: '똑같이 범위를 좁힌다', leadsTo: 0 },
          { text: '찾아 들어갈 범위를 더 못 좁힌다', correct: true },
          { text: '인덱스에서 아예 무시된다', leadsTo: 0 },
          { text: '정렬에만 쓰인다', leadsTo: 2 },
        ],
        rationale:
          '읽어 온 것을 거르는 데는 쓰이고, 제품에 따라 건너뛰며 훑어 살려 쓰기도 한다.',
      },
      {
        kind: 'boundary',
        stem: '인덱스를 늘릴수록 커지는 위험은?',
        choices: [
          { text: '정렬 실패', leadsTo: 2 },
          { text: '조회 속도 저하만', leadsTo: 4 },
          { text: '쓰기 비용과 옵티마이저의 선택 오류', correct: true },
          { text: '위험이 없다', leadsTo: 3 },
        ],
        rationale:
          '쓰기마다 인덱스를 다 손봐야 하고, 고를 후보가 늘어 엉뚱한 것을 고르기도 한다.',
      },
    ],
  },
  {
    identityScope: 'db',
    question: '데이터가 한 대에 안 들어가면 어떻게 나누는가?',
    items: [
      {
        kind: 'concept',
        stem: '어느 조각으로 보낼지 정하는 값은?',
        choices: [
          { text: '샤드 키', correct: true },
          { text: '기본 키의 크기', leadsTo: 0 },
          { text: '조각의 남은 용량', leadsTo: 3 },
          { text: '요청이 온 시각', leadsTo: 0 },
        ],
        rationale:
          '이것을 잘못 고르면 한쪽만 뜨거워진다. 가입일로 나누면 최근 가입자가 몰린 조각만 일한다.',
      },
      {
        kind: 'misconception',
        stem: '나눈 뒤에도 모든 질의가 똑같이 싼가?',
        choices: [
          { text: '조각을 걸치는 질의는 모든 조각에 묻고 합쳐야 한다', correct: true },
          { text: '똑같이 싸다', leadsTo: 1 },
          { text: '오히려 더 싸진다', leadsTo: 1 },
          { text: '라우터가 알아서 하나로 만든다', leadsTo: 1 },
        ],
        rationale:
          '사용자로 나눴는데 상품별 집계를 물으면 그렇게 된다. 조각 사이의 트랜잭션도 어렵다.',
      },
      {
        kind: 'boundary',
        stem: '조각 수를 바꾸면?',
        choices: [
          { text: '샤드 키를 바꿔야 한다', leadsTo: 0 },
          { text: '새 조각만 채우면 된다', leadsTo: 2 },
          { text: '아무 영향이 없다', leadsTo: 2 },
          { text: '키를 다시 배치해야 한다', correct: true },
        ],
        rationale:
          '나머지 연산으로 나눴다면 대수가 바뀔 때 키가 대거 옮겨 간다.',
      },
    ],
  },
  {
    identityScope: 'db',
    question: '목록을 나눌 때 번호와 커서는 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: '번호 방식이 뒤로 갈수록 느린 까닭은?',
        choices: [
          { text: '건너뛰는 행도 읽어야 하기 때문', correct: true },
          { text: '정렬을 매번 다시 하기 때문', leadsTo: 1 },
          { text: '인덱스를 쓸 수 없기 때문', leadsTo: 4 },
          { text: '전체 개수를 세기 때문', leadsTo: 2 },
        ],
        rationale:
          '백만 번째부터 스무 개를 달라고 하면 백만 개를 세고 버린다.',
      },
      {
        kind: 'misconception',
        stem: '커서 방식은 그 자체로 싼가?',
        choices: [
          { text: '언제나 일정한 시간이 걸린다', leadsTo: 4 },
          { text: '방식 자체가 싸다', leadsTo: 4 },
          { text: '인덱스를 쓸 수 있게 묻는 방식이라 싼 것이다', correct: true },
          { text: '인덱스와 무관하게 빠르다', leadsTo: 4 },
        ],
        rationale:
          '인덱스가 안 받쳐 주면 커서도 처음부터 훑는다.',
      },
      {
        kind: 'boundary',
        stem: '정렬 키 값이 겹칠 때 해야 할 일은?',
        choices: [
          { text: '고유한 값을 함께 묶어 총순서를 만든다', correct: true },
          { text: '겹치는 행을 지운다', leadsTo: 0 },
          { text: '정렬을 포기한다', leadsTo: 3 },
          { text: '페이지 크기를 늘린다', leadsTo: 2 },
        ],
        rationale:
          '커서에도 두 값을 모두 담아야 경계에서 겹치거나 빠지지 않는다.',
      },
    ],
  },
  {
    identityScope: 'mysql',
    question: '커넥션 풀 크기를 CPU 코어 수로 잡는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '코어 수가 기준이 되는 까닭은?',
        choices: [
          { text: '연결 하나가 코어 하나를 쓰기 때문', leadsTo: 2 },
          { text: '동시에 돌릴 수 있는 CPU 작업 수를 정하기 때문', correct: true },
          { text: '메모리가 코어 수에 비례하기 때문', leadsTo: 0 },
          { text: '디스크 수와 같기 때문', leadsTo: 0 },
        ],
        rationale:
          '서버의 CPU는 실행 계획을 짜고 데이터를 연산한다. 그것이 연산 처리의 실제 한계다.',
      },
      {
        kind: 'misconception',
        stem: 'I/O 대기가 긴 작업도 코어 수로 묶이는가?',
        choices: [
          { text: '대기 시간과 무관하다', leadsTo: 0 },
          { text: '언제나 코어 수를 넘으면 안 된다', leadsTo: 4 },
          { text: 'I/O 작업은 풀을 쓰지 않는다', leadsTo: 4 },
          { text: '아니다. 다른 병목이 없다면 더 크게 잡을 수 있다', correct: true },
        ],
        rationale:
          '풀 크기는 코어 수와 디스크 대기 시간을 함께 보고 정한다.',
      },
      {
        kind: 'boundary',
        stem: '공식으로 나온 값을 그대로 쓰는가?',
        choices: [
          { text: '두 배로 늘려 쓴다', leadsTo: 3 },
          { text: '그대로 쓰면 된다', leadsTo: 3 },
          { text: '출발점일 뿐이고 부하 시험으로 확정한다', correct: true },
          { text: '공식이 유일한 근거다', leadsTo: 1 },
        ],
        rationale:
          '연결 한도와 서비스 인스턴스 수까지 반영해야 한다.',
      },
    ],
  },
  {
    identityScope: 'mysql',
    question: 'DB 락은 분산 환경에서 무엇이 한계인가?',
    items: [
      {
        kind: 'concept',
        stem: 'DB 락이 지켜 주지 못하는 것은?',
        choices: [
          { text: '같은 DB의 다른 테이블', leadsTo: 3 },
          { text: '그 DB가 모르는 캐시나 외부 자원', correct: true },
          { text: '같은 트랜잭션 안의 행', leadsTo: 3 },
          { text: '지켜 주지 못하는 것이 없다', leadsTo: 0 },
        ],
        rationale:
          '서버가 여러 대여도 DB가 하나면 그 DB가 관리하는 자원은 막힌다. 문제는 DB 밖이다.',
      },
      {
        kind: 'misconception',
        stem: '외부 저장소로 락을 옮기면 안전이 보장되는가?',
        choices: [
          { text: '알고리즘과 무관하다', leadsTo: 1 },
          { text: '옮기기만 하면 완전히 안전하다', leadsTo: 1 },
          { text: '오히려 더 위험해진다', leadsTo: 0 },
          { text: '저장소의 일관성 모델과 락 알고리즘만큼만 강하다', correct: true },
        ],
        rationale:
          '모든 서버가 같은 저장소를 바라보고 누가 락을 쥐었는지 한 자리에서 정한다는 것이 요점이다.',
      },
      {
        kind: 'boundary',
        stem: '만료된 소유자의 뒤늦은 쓰기를 막으려면?',
        choices: [
          { text: '만료 시간을 넉넉히 늘려 겹치지 않게 한다', leadsTo: 1 },
          { text: '보호 대상이 fencing token을 검증해 거부해야 한다', correct: true },
          { text: '쓰기 직전에 락을 다시 잡아 확인한다', leadsTo: 2 },
          { text: '락이 만료된 뒤에는 막을 방법이 없다', leadsTo: 1 },
        ],
        rationale:
          '토큰을 발급하는 것만으로는 완성되지 않는다. 쓰기를 받는 쪽이 검증해야 한다.',
      },
    ],
  },
  {
    identityScope: 'redis',
    question: 'Redis 분산 락의 스핀과 Pub/Sub 방식 차이는?',
    items: [
      {
        kind: 'concept',
        stem: '두 방식의 차이는?',
        choices: [
          { text: '만료 시간이 다르다', leadsTo: 1 },
          { text: '락을 거는 곳이 다르다', leadsTo: 4 },
          { text: '풀릴 때까지 두드리는가, 풀릴 때 깨우는가', correct: true },
          { text: '알고리즘이 다르다', leadsTo: 4 },
        ],
        rationale:
          '스핀은 반복 요청으로 Redis 부하를 키우고, Pub/Sub은 해제할 때 알림을 발행해 헛된 왕복을 줄인다.',
      },
      {
        kind: 'misconception',
        stem: 'Pub/Sub 방식은 알림만 기다리면 되는가?',
        choices: [
          { text: '알림을 못 받으면 영원히 기다린다', leadsTo: 2 },
          { text: '알림은 반드시 도착한다', leadsTo: 2 },
          { text: '알림이 유실될 수 있어 시간 제한을 두고 다시 확인한다', correct: true },
          { text: '확인이 필요 없다', leadsTo: 2 },
        ],
        rationale:
          '대신 구독을 관리하는 비용이 붙는다.',
      },
      {
        kind: 'boundary',
        stem: '두 방식 모두 따로 확인해야 하는 것은?',
        choices: [
          { text: '만료 시간과 장애 시 락 안전성', correct: true },
          { text: '네트워크 대역폭', leadsTo: 3 },
          { text: '키 이름 규칙', leadsTo: 0 },
          { text: '확인할 것이 없다', leadsTo: 1 },
        ],
        rationale:
          '경합이 심할수록 Pub/Sub의 이점이 커지지만 안전성은 별개 문제다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '낙관적 락 충돌은 어떻게 재시도하는가?',
    items: [
      {
        kind: 'concept',
        stem: '재시도는 어디에서 도는가?',
        choices: [
          { text: '트랜잭션 바깥에서, 매 시도가 새 트랜잭션으로', correct: true },
          { text: '예외가 난 트랜잭션 안에서', leadsTo: 1 },
          { text: '같은 트랜잭션을 이어서', leadsTo: 1 },
          { text: '데이터베이스가 알아서 한다', leadsTo: 4 },
        ],
        rationale:
          '예외가 난 트랜잭션 안에서 루프를 돌면 그 트랜잭션이 롤백 전용으로 표시돼 재시도가 먹지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '충돌하면 바로 다시 걸어도 되는가?',
        choices: [
          { text: '바로 거는 편이 빠르다', leadsTo: 2 },
          { text: '같은 충돌이 연달아 나므로 백오프와 지터를 둔다', correct: true },
          { text: '기다리면 오히려 나빠진다', leadsTo: 2 },
          { text: '순서를 정해 두면 된다', leadsTo: 4 },
        ],
        rationale:
          '무작위 지터를 섞어 몰리는 것을 흩는다.',
      },
      {
        kind: 'boundary',
        stem: '상한을 반드시 두는 까닭은?',
        choices: [
          { text: '예외가 쌓여서', leadsTo: 0 },
          { text: '코드가 길어져서', leadsTo: 3 },
          { text: '무한 재시도가 몰리면 커넥션을 다 써 버린다', correct: true },
          { text: '상한은 없어도 된다', leadsTo: 3 },
        ],
        rationale:
          '상한을 넘기면 실패로 알리거나 큐로 넘겨 보상한다. 무엇을 고를지는 업무가 정한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '데이터베이스 격리 수준을 높이면 전체 처리량은 어떻게 변화하는가?',
    items: [
      {
        kind: 'concept',
        stem: '처리량이 깎이는 까닭은?',
        choices: [
          { text: '동시성 제어에 드는 비용이 늘어서', correct: true },
          { text: '질의 자체가 느려져서', leadsTo: 1 },
          { text: '인덱스를 못 써서', leadsTo: 1 },
          { text: '디스크 입출력이 늘어서', leadsTo: 0 },
        ],
        rationale:
          '잠금 방식이면 잠금 범위와 유지 시간이, 스냅샷 방식이면 관리와 충돌 검사 비용이 는다.',
      },
      {
        kind: 'misconception',
        stem: '얼마나 깎이는지는 정해져 있는가?',
        choices: [
          { text: '전혀 깎이지 않는다', leadsTo: 2 },
          { text: '수준마다 정해진 비율이 있다', leadsTo: 1 },
          { text: '항상 절반으로 준다', leadsTo: 1 },
          { text: '구현과 부딪히는 빈도에 달렸다', correct: true },
        ],
        rationale:
          '충돌이 드물면 높은 수준을 써도 체감이 작을 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '충돌이 잦아지면 무엇이 늘어나는가?',
        choices: [
          { text: '인덱스 크기', leadsTo: 0 },
          { text: '캐시 적중률', leadsTo: 3 },
          { text: '롤백과 대기 시간', correct: true },
          { text: '늘어나는 것이 없다', leadsTo: 4 },
        ],
        rationale:
          '단위 시간당 처리량이 그만큼 떨어진다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '서브쿼리를 언제 조인으로 재작성해야 성능이 향상되는가?',
    items: [
      {
        kind: 'concept',
        stem: '조인 쪽이 유리할 수 있는 근거는?',
        choices: [
          { text: '결과가 더 정확해진다', leadsTo: 1 },
          { text: '읽는 행 수가 줄어든다', leadsTo: 3 },
          { text: '인덱스가 자동으로 생긴다', leadsTo: 0 },
          { text: '옵티마이저가 살펴볼 경로가 넓어진다', correct: true },
        ],
        rationale:
          '서브쿼리로 두면 언네스팅되지 않는 한 블록 안으로 최적화가 제한된다.',
      },
      {
        kind: 'misconception',
        stem: '있는지만 보는 서브쿼리를 단순 조인으로 바꾸면?',
        choices: [
          { text: '안쪽 중복 탓에 바깥 행이 늘어난다', correct: true },
          { text: '행 수가 그대로라 결과가 똑같다', leadsTo: 1 },
          { text: '조인이 서브쿼리보다 항상 빨라진다', leadsTo: 3 },
          { text: '안쪽 열을 못 써서 문법 오류가 난다', leadsTo: 1 },
        ],
        rationale:
          'IN이나 EXISTS는 안쪽에 중복이 있어도 바깥 행 수를 안 늘린다. DISTINCT나 GROUP BY를 붙이면 오히려 느려질 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '손으로 바꾸기 전에 할 일은?',
        choices: [
          { text: '실행 계획을 보고 자동 최적화 여부를 확인한다', correct: true },
          { text: '무조건 조인으로 바꾼다', leadsTo: 0 },
          { text: '서브쿼리를 없앤다', leadsTo: 3 },
          { text: '인덱스를 먼저 추가한다', leadsTo: 2 },
        ],
        rationale:
          '옵티마이저는 조건이 맞는 서브쿼리를 언네스팅해 조인으로 바꿀 수 있다. 실측에서 이득이 확인될 때만 손으로 바꾼다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '서브쿼리 언네스팅은 언제 발생하는가?',
    items: [
      {
        kind: 'concept',
        stem: '언네스팅으로 얻는 것은?',
        choices: [
          { text: '읽는 행 수 감소', leadsTo: 1 },
          { text: '조인 순서와 기법을 고를 자유', correct: true },
          { text: '중복 자동 제거', leadsTo: 1 },
          { text: '인덱스 자동 생성', leadsTo: 4 },
        ],
        rationale:
          '서브쿼리가 메인쿼리와 동등한 조인 대상이 되면 옵티마이저의 선택지가 넓어진다.',
      },
      {
        kind: 'misconception',
        stem: '어떤 서브쿼리든 펼 수 있는가?',
        choices: [
          { text: '상관 서브쿼리만 펼 수 있다', leadsTo: 3 },
          { text: '모든 서브쿼리를 펼 수 있다', leadsTo: 3 },
          { text: '뜻이 보존될 때만, 그리고 DBMS마다 범위가 다르다', correct: true },
          { text: '제품과 무관하게 같다', leadsTo: 0 },
        ],
        rationale:
          '집계나 LIMIT 같은 요소가 끼면 제약에 걸린다.',
      },
      {
        kind: 'boundary',
        stem: '1:N 관계인 서브쿼리를 펼 때 옵티마이저가 쓰는 방법은?',
        choices: [
          { text: '펴지 않고 그대로 둔다', leadsTo: 2 },
          { text: '단순 조인 뒤 중복을 제거한다', leadsTo: 1 },
          { text: '있는지만 보는 세미 조인으로 바꾼다', correct: true },
          { text: '결과가 부푼 채로 둔다', leadsTo: 1 },
        ],
        rationale:
          '그러면 따로 중복을 걷어내지 않아도 바깥 행이 안 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '서브쿼리 언네스팅과 뷰 병합의 차이는?',
    items: [
      {
        kind: 'concept',
        stem: '두 기법이 다루는 자리는?',
        choices: [
          { text: '언네스팅이 FROM절, 뷰 병합이 WHERE절', leadsTo: 2 },
          { text: '둘 다 FROM절만 다시 쓴다', leadsTo: 2 },
          { text: '둘 다 WHERE절만 다시 쓴다', leadsTo: 0 },
          { text: '언네스팅은 WHERE절, 뷰 병합은 FROM절', correct: true },
        ],
        rationale:
          '변환 대상절이 다르다는 것이 두 기법을 가르는 첫 기준이다.',
      },
      {
        kind: 'misconception',
        stem: '두 기법의 목적이 같은가?',
        choices: [
          { text: '언네스팅은 반복 수행 방지, 뷰 병합은 중간 집합 방지', correct: true },
          { text: '완전히 같은 목적이다', leadsTo: 2 },
          { text: '둘 다 인덱스를 만들려는 것이다', leadsTo: 0 },
          { text: '둘 다 중복 제거가 목적이다', leadsTo: 1 },
        ],
        rationale:
          '언네스팅은 서브쿼리를 조인 구조로 흡수하고, 뷰 병합은 뷰의 쿼리 블록을 메인 쿼리로 흡수한다.',
      },
      {
        kind: 'boundary',
        stem: '두 기법의 공통점은?',
        choices: [
          { text: '임시 테이블을 만든다', leadsTo: 2 },
          { text: '쿼리 블록을 단순화해 최적화 공간을 넓힌다', correct: true },
          { text: '반드시 함께 적용된다', leadsTo: 1 },
          { text: '공통점이 없다', leadsTo: 0 },
        ],
        rationale:
          '작동하는 대상절과 조인 구조 생성 방식에서는 명확히 구분된다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'EXISTS와 IN을 조인으로 바꾸면 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: 'IN과 EXISTS가 갖는 의미는?',
        choices: [
          { text: '모든 짝을 만드는 내부 조인', leadsTo: 0 },
          { text: '있는지만 보는 세미 조인', correct: true },
          { text: '없는 것만 고르는 안티 조인', leadsTo: 2 },
          { text: '중복을 제거하는 연산', leadsTo: 3 },
        ],
        rationale:
          '그래서 서브쿼리에 중복이 있어도 결과 행이 늘지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '중복을 막으려면 언제나 중복 제거를 붙여야 하는가?',
        choices: [
          { text: '우측 키가 유일하면 안 붙여도 된다', correct: true },
          { text: '언제나 붙여야 한다', leadsTo: 3 },
          { text: '붙이면 항상 빨라진다', leadsTo: 3 },
          { text: '붙일 수 없다', leadsTo: 0 },
        ],
        rationale:
          '최신 옵티마이저는 IN과 EXISTS를 세미 조인으로 자동 최적화하므로 무조건 바꿀 필요도 없다.',
      },
      {
        kind: 'boundary',
        stem: 'NOT IN 서브쿼리에 NULL이 섞이면?',
        choices: [
          { text: 'NULL만 빠지고 나머지는 정상이다', leadsTo: 1 },
          { text: '결과가 전부 비어 버릴 수 있다', correct: true },
          { text: '오류가 난다', leadsTo: 1 },
          { text: 'NOT EXISTS와 결과가 같다', leadsTo: 1 },
        ],
        rationale:
          'NOT EXISTS는 NULL 비교를 일치로 세지 않아 기대대로 평가된다. LEFT OUTER JOIN 변환은 NULL이 될 수 없는 우측 컬럼으로 검사해야 같은 결과가 된다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'ANTI JOIN과 SEMI JOIN의 차이는?',
    items: [
      {
        kind: 'concept',
        stem: '둘의 차이는?',
        choices: [
          { text: '읽는 테이블 순서가 다르다', leadsTo: 3 },
          { text: '조인 알고리즘이 다르다', leadsTo: 4 },
          { text: '일치하는 행을 내보내느냐, 일치하지 않는 행을 내보내느냐', correct: true },
          { text: '결과에 붙는 컬럼이 다르다', leadsTo: 2 },
        ],
        rationale:
          '두 조인 모두 우측 데이터를 결과에 붙이지 않고 일치 여부만 검사한다.',
      },
      {
        kind: 'misconception',
        stem: '두 조인에 중복 제거가 필요한가?',
        choices: [
          { text: 'ANTI JOIN에만 필요하다', leadsTo: 2 },
          { text: '언제나 필요하다', leadsTo: 2 },
          { text: '필요 없다. 메인 테이블의 고유성이 유지된다', correct: true },
          { text: 'SEMI JOIN에만 필요하다', leadsTo: 2 },
        ],
        rationale:
          '일반 INNER JOIN처럼 중복 행이 늘어나지 않는다.',
      },
      {
        kind: 'boundary',
        stem: 'ANTI JOIN에서 특히 조심할 것은?',
        choices: [
          { text: '우측 컬럼의 NULL 의미론', correct: true },
          { text: '조인 순서', leadsTo: 0 },
          { text: '인덱스 유무', leadsTo: 4 },
          { text: '조심할 것이 없다', leadsTo: 1 },
        ],
        rationale:
          '우측에 NULL이 있으면 NOT IN 서브쿼리가 변환될 때 전체 결과가 빈 집합이 될 수 있다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: 'Hash Anti Join은 내부에서 어떻게 동작하는가?',
    items: [
      {
        kind: 'concept',
        stem: '해시 표를 만드는 쪽은?',
        choices: [
          { text: '좌측 집합', leadsTo: 1 },
          { text: '우측 집합', correct: true },
          { text: '더 큰 쪽', leadsTo: 1 },
          { text: '둘 다', leadsTo: 2 },
        ],
        rationale:
          'Build 단계에서 조인 키 기준으로 표를 만들고, Probe 단계에서 좌측 행을 읽으며 탐색한다.',
      },
      {
        kind: 'misconception',
        stem: '좌측 행에서 키를 찾으면 어떻게 되는가?',
        choices: [
          { text: '해시 표에 추가한다', leadsTo: 0 },
          { text: '결과에 포함한다', leadsTo: 4 },
          { text: '끝까지 탐색한 뒤 판단한다', leadsTo: 1 },
          { text: '즉시 검색을 멈추고 그 행을 버린다', correct: true },
        ],
        rationale:
          '안티 조인은 없는 행만 내보내므로 찾은 순간 결론이 난다. 이 조기 종료 덕에 등가 조건의 NOT EXISTS를 빠르게 처리한다.',
      },
      {
        kind: 'boundary',
        stem: 'NOT IN이 그대로 이 방식을 타지 못하는 까닭은?',
        choices: [
          { text: 'NULL 의미론을 따로 다뤄야 해서', correct: true },
          { text: '해시 함수를 못 써서', leadsTo: 1 },
          { text: '메모리를 더 써서', leadsTo: 2 },
          { text: '탈 수 있다. 제약이 없다', leadsTo: 3 },
        ],
        rationale:
          '메모리가 모자라면 나눠 디스크로 흘리는 것과는 별개의 제약이다.',
      },
    ],
  },
  {
    identityScope: 'sql',
    question: '뷰 쿼리의 성능 저하는 무엇을 확인해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '가장 먼저 의심할 것은?',
        choices: [
          { text: '뷰 정의가 긴 것', leadsTo: 4 },
          { text: '뷰에 인덱스가 없는 것', leadsTo: 0 },
          { text: '옵티마이저의 뷰 병합 실패', correct: true },
          { text: '뷰를 여러 번 쓴 것', leadsTo: 1 },
        ],
        rationale:
          '병합하지 못하면 별도 쿼리 블록으로 처리하고, 계획에 따라 결과를 구체화하기도 한다.',
      },
      {
        kind: 'misconception',
        stem: '병합에 실패하면 조건도 뷰 안으로 못 들어가는가?',
        choices: [
          { text: '조건 전달은 없는 개념이다', leadsTo: 2 },
          { text: '실패하면 조건도 못 들어간다', leadsTo: 2 },
          { text: '조건은 언제나 들어간다', leadsTo: 2 },
          { text: '병합과 푸시다운은 별개라 전달될 수 있다', correct: true },
        ],
        rationale:
          '푸시다운에 실패하면 뷰 전체를 가져온 뒤 필터링하므로 그것도 따로 확인한다.',
      },
      {
        kind: 'boundary',
        stem: '병합을 어렵게 만드는 요소는?',
        choices: [
          { text: '단순 WHERE 조건', leadsTo: 2 },
          { text: 'GROUP BY나 DISTINCT', correct: true },
          { text: '컬럼 개수', leadsTo: 0 },
          { text: '뷰 이름 길이', leadsTo: 3 },
        ],
        rationale:
          '뷰 결과를 먼저 만들어야 하고, 집계가 크거나 디스크로 흘리면 부담이 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '고차원 데이터에서 거리 계산 시 발생하는 문제는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '차원이 늘면 거리에 무슨 일이 생기는가?',
        choices: [
          { text: '거리가 정확해진다', leadsTo: 3 },
          { text: '모든 거리가 0에 가까워진다', leadsTo: 1 },
          { text: '거리 계산이 불가능해진다', leadsTo: 1 },
          { text: '가장 가까운 것과 먼 것의 차이가 상대적으로 준다', correct: true },
        ],
        rationale:
          '그러면 이웃을 정의하거나 밀도를 측정하는 기존 방식이 무력화된다.',
      },
      {
        kind: 'misconception',
        stem: '고차원이면 언제나 이 현상이 나타나는가?',
        choices: [
          { text: '거리 함수와 무관하다', leadsTo: 1 },
          { text: '차원만 높으면 반드시 나타난다', leadsTo: 3 },
          { text: '표본이 많으면 절대 안 나타난다', leadsTo: 0 },
          { text: '늘 그런 것은 아니고 조건이 붙는다', correct: true },
        ],
        rationale:
          '차원이 높고 값들이 비슷하게 흩어졌을 때 두드러진다.',
      },
      {
        kind: 'boundary',
        stem: '거리 집중이 나타나면 무엇이 흔들리는가?',
        choices: [
          { text: '흔들리는 것이 없다', leadsTo: 2 },
          { text: '데이터 저장 용량', leadsTo: 0 },
          { text: '읽기 속도', leadsTo: 0 },
          { text: '거리 기반 군집 알고리즘의 구분력', correct: true },
        ],
        rationale:
          '차원을 줄이거나 코사인 유사도 같은 다른 척도를 쓰는 이유다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: 'useEffect 의존성 배열을 잘못 넣으면 어떤 문제가 생기는가?',
    items: [
      {
        kind: 'concept',
        stem: '의존성을 빠뜨리면 이펙트가 보는 값은?',
        choices: [
          { text: '첫 렌더의 값으로 고정', leadsTo: 0 },
          { text: '언제나 최신 값', leadsTo: 0 },
          { text: '마지막으로 실행된 렌더의 값', correct: true },
          { text: '정의되지 않은 값', leadsTo: 0 },
        ],
        rationale:
          '최신 상태를 읽는 줄 알았는데 옛 값이 나오는 상황이 여기서 생긴다.',
      },
      {
        kind: 'misconception',
        stem: '두 실수 중 발견이 늦는 쪽은?',
        choices: [
          { text: '둘 다 즉시 드러난다', leadsTo: 1 },
          { text: '너무 많이 넣은 쪽', leadsTo: 1 },
          { text: '너무 적게 넣은 쪽. 오류가 안 난다', correct: true },
          { text: '둘 다 드러나지 않는다', leadsTo: 3 },
        ],
        rationale:
          '너무 많이 넣으면 매 렌더마다 실행되고 무한 루프로 가서 바로 티가 난다.',
      },
      {
        kind: 'boundary',
        stem: '너무 자주 실행될 때 올바른 처방은?',
        choices: [
          { text: '값 자체를 안정화한다', correct: true },
          { text: '의존성에서 빼 버린다', leadsTo: 3 },
          { text: '배열을 비운다', leadsTo: 0 },
          { text: '이펙트를 두 개로 쪼갠다', leadsTo: 4 },
        ],
        rationale:
          '의존성을 빼서 해결하는 것은 증상만 가리는 것이다. 이펙트 안에서 쓰는 모든 외부 값은 넣는 것이 기준이다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '브라우저가 화면을 그리기까지 무슨 일이 일어나는가?',
    items: [
      {
        kind: 'concept',
        stem: '너비나 위치를 바꾸면 어디부터 다시 하는가?',
        choices: [
          { text: '레이아웃부터', correct: true },
          { text: '페인트부터', leadsTo: 0 },
          { text: '파싱부터', leadsTo: 4 },
          { text: '합성 단계만', leadsTo: 1 },
        ],
        rationale:
          '색만 바꾸면 페인트만 다시 한다. 어느 단계를 건드리느냐에 따라 비용이 크게 갈린다.',
      },
      {
        kind: 'misconception',
        stem: 'transform과 opacity가 싼 까닭은?',
        choices: [
          { text: '브라우저가 무시해서', leadsTo: 0 },
          { text: '계산이 단순해서', leadsTo: 1 },
          { text: '합성 단계에서만 처리돼 앞 단계를 건너뛴다', correct: true },
          { text: '싸지 않다', leadsTo: 1 },
        ],
        rationale:
          '레이아웃과 페인트를 다시 하지 않는다는 것이 핵심이다.',
      },
      {
        kind: 'boundary',
        stem: '스타일을 바꾼 직후 크기 값을 읽으면?',
        choices: [
          { text: '이전 값을 준다', leadsTo: 2 },
          { text: '캐시된 값을 준다', leadsTo: 2 },
          { text: '그 자리에서 레이아웃을 다시 계산한다', correct: true },
          { text: '오류가 난다', leadsTo: 0 },
        ],
        rationale:
          '반복문 안에서 쓰기와 읽기를 번갈아 하면 매 회전마다 그 비용이 든다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '리렌더링이 필요 이상으로 도는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '인라인 객체나 함수를 넘기면?',
        choices: [
          { text: '내용이 같으면 같은 것으로 본다', leadsTo: 0 },
          { text: '내용이 같아도 참조가 달라 매번 바뀐 것으로 본다', correct: true },
          { text: '문자열처럼 값으로 비교된다', leadsTo: 0 },
          { text: '비교되지 않는다', leadsTo: 4 },
        ],
        rationale:
          '문자열이나 숫자는 같은 값이면 다시 안 그린다.',
      },
      {
        kind: 'misconception',
        stem: '자식을 memo로 감싸기만 하면 되는가?',
        choices: [
          { text: '감싸기만 하면 충분하다', leadsTo: 0 },
          { text: '인라인 객체를 계속 넘기면 비교만 늘고 효과가 없다', correct: true },
          { text: '감싸면 부모도 안 그려진다', leadsTo: 2 },
          { text: 'memo는 함수에만 쓴다', leadsTo: 1 },
        ],
        rationale:
          '자식을 감싸는 것과 넘기는 값을 고정하는 것이 한 벌이다.',
      },
      {
        kind: 'boundary',
        stem: '메모를 먼저 뿌리는 것이 손해인 까닭은?',
        choices: [
          { text: '렌더가 아예 멈춘다', leadsTo: 0 },
          { text: '메모리를 두 배로 쓴다', leadsTo: 4 },
          { text: '비교에도 값이 들고 코드가 읽기 어려워진다', correct: true },
          { text: '손해가 아니다', leadsTo: 4 },
        ],
        rationale:
          '프로파일러로 실제 느린 곳을 찾은 뒤에 붙인다. 대부분의 리렌더는 싸서 문제가 안 된다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '변경점을 비교하면 언제 비용이 줄어드는가?',
    items: [
      {
        kind: 'concept',
        stem: '이득이 나는 조건은?',
        choices: [
          { text: '노드 수가 적을 때', leadsTo: 3 },
          { text: '언제나 이득이다', leadsTo: 3 },
          { text: '변경이 아주 작을 때', leadsTo: 3 },
          { text: '비교 비용보다 직접 조작 비용이 클 때', correct: true },
        ],
        rationale:
          '메모리의 트리에서 변경점을 모아 실제 노드 갱신 횟수를 줄이는 방식이다.',
      },
      {
        kind: 'misconception',
        stem: '렌더링마다 화면 전체를 다시 그리는가?',
        choices: [
          { text: '전체를 다시 그린다', leadsTo: 0 },
          { text: '아니다. 필요한 변경만 커밋한다', correct: true },
          { text: '절반만 그린다', leadsTo: 0 },
          { text: '아무것도 안 그린다', leadsTo: 1 },
        ],
        rationale:
          '이전 트리와 새 트리를 비교해 필요한 변경만 반영한다.',
      },
      {
        kind: 'boundary',
        stem: '가상 트리를 무조건 빠른 기술로 볼 수 있는가?',
        choices: [
          { text: '속도와는 아무 상관 없는 개념이다', leadsTo: 0 },
          { text: '직접 만지는 것보다 언제나 더 빠르다', leadsTo: 3 },
          { text: '한 겹을 더 거치므로 언제나 더 느리다', leadsTo: 3 },
          { text: '없다. 상태 기반 UI를 위한 절충이다', correct: true },
        ],
        rationale:
          '업데이트가 작고 구조가 단순하면 직접 조작이 더 싸다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '계산 단계와 반영 단계를 왜 나누는가?',
    items: [
      {
        kind: 'concept',
        stem: '나누는 목적은?',
        choices: [
          { text: '코드를 나누려고', leadsTo: 3 },
          { text: '메모리를 아끼려고', leadsTo: 1 },
          { text: '계산을 중단해도 화면이 중간 상태에 안 놓이게', correct: true },
          { text: '테스트를 쉽게 하려고', leadsTo: 3 },
        ],
        rationale:
          'DOM과 ref는 커밋에서 일관되게 반영한다.',
      },
      {
        kind: 'misconception',
        stem: '렌더 단계에 부작용을 두면?',
        choices: [
          { text: '중단되거나 폐기될 수 있어 위험하다', correct: true },
          { text: '문제없다. 한 번만 돈다', leadsTo: 0 },
          { text: '커밋에서 되돌려 준다', leadsTo: 1 },
          { text: '오류로 막힌다', leadsTo: 3 },
        ],
        rationale:
          '렌더 단계는 우선순위에 따라 중단되거나 폐기될 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '커밋 단계는 쪼개질 수 있는가?',
        choices: [
          { text: '렌더처럼 쪼개진다', leadsTo: 1 },
          { text: '중간에 쪼개지 않는다', correct: true },
          { text: '우선순위에 따라 다르다', leadsTo: 1 },
          { text: '항상 두 번에 나눠 한다', leadsTo: 4 },
        ],
        rationale:
          'useLayoutEffect는 페인트 전, useEffect는 대체로 페인트 뒤에 실행된다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '공유 상태는 어느 컴포넌트에 두는가?',
    items: [
      {
        kind: 'concept',
        stem: '어디에 두는가?',
        choices: [
          { text: '읽거나 바꾸는 컴포넌트들의 가장 가까운 공통 조상', correct: true },
          { text: '최상위 루트', leadsTo: 1 },
          { text: '가장 자주 쓰는 자식', leadsTo: 0 },
          { text: '각 자식이 따로 보관', leadsTo: 0 },
        ],
        rationale:
          '한 출처에서 값을 내려주고 변경 의도를 올려보낸다.',
      },
      {
        kind: 'misconception',
        stem: '각 자식이 같은 값을 따로 들면?',
        choices: [
          { text: '독립적이라 더 안전하다', leadsTo: 0 },
          { text: '동기화 코드가 생기고 상태 불일치가 난다', correct: true },
          { text: '성능이 좋아진다', leadsTo: 1 },
          { text: '차이가 없다', leadsTo: 3 },
        ],
        rationale:
          '한쪽 갱신이 빠지면 화면마다 다른 값을 보여준다.',
      },
      {
        kind: 'boundary',
        stem: '너무 높이 올리면?',
        choices: [
          { text: '상태가 사라진다', leadsTo: 3 },
          { text: '문제가 없다. 높을수록 안전하다', leadsTo: 1 },
          { text: '관련 없는 자식까지 의존하고 전달 경로가 길어진다', correct: true },
          { text: '렌더가 멈춘다', leadsTo: 1 },
        ],
        rationale:
          '상태가 넓게 공유되면 Context나 외부 저장소가 더 적합할 수 있다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '목록 항목의 정체성을 어떻게 보존하는가?',
    items: [
      {
        kind: 'concept',
        stem: '키가 하는 일은?',
        choices: [
          { text: '항목을 화면에 표시한다', leadsTo: 1 },
          { text: '정렬 순서를 정한다', leadsTo: 2 },
          { text: '기존 인스턴스와 상태를 새 항목에 대응시킨다', correct: true },
          { text: '중복을 걸러낸다', leadsTo: 3 },
        ],
        rationale:
          '같은 부모 아래에서 키와 타입이 같으면 기존 컴포넌트와 DOM을 재사용한다.',
      },
      {
        kind: 'misconception',
        stem: '인덱스 키는 언제 안전한가?',
        choices: [
          { text: '항목이 적을 때만', leadsTo: 2 },
          { text: '언제나 안전하다', leadsTo: 2 },
          { text: '절대 쓰면 안 된다', leadsTo: 2 },
          { text: '이미 있는 항목의 자리가 안 바뀔 때만', correct: true },
        ],
        rationale:
          '끝에만 붙이는 목록이면 괜찮고, 중간에 끼우거나 지우거나 정렬하면 어긋난다.',
      },
      {
        kind: 'boundary',
        stem: '매번 난수로 키를 만들면?',
        choices: [
          { text: '전부 다시 마운트해 입력 상태까지 잃는다', correct: true },
          { text: '고유하니 가장 안전하다', leadsTo: 4 },
          { text: '성능이 좋아진다', leadsTo: 4 },
          { text: '경고만 뜬다', leadsTo: 3 },
        ],
        rationale:
          '키가 바뀌면 새로 마운트해 내부 상태도 초기화된다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '계산 결과와 함수 참조는 언제 기억해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '두 도구가 각각 지키는 것은?',
        choices: [
          { text: 'useMemo는 함수 참조, useCallback은 계산한 값', leadsTo: 0 },
          { text: '둘 다 계산한 값만 지키고 참조는 안 지킨다', leadsTo: 0 },
          { text: '둘 다 함수 참조만 지키고 값은 안 지킨다', leadsTo: 0 },
          { text: 'useMemo는 계산한 값, useCallback은 함수 참조', correct: true },
        ],
        rationale:
          '의존성이 같을 때 이전 결과나 참조를 재사용한다.',
      },
      {
        kind: 'misconception',
        stem: '이것들은 동작을 보장하는 장치인가?',
        choices: [
          { text: '의존성을 자동으로 채운다', leadsTo: 1 },
          { text: '보장 장치라 믿고 써도 된다', leadsTo: 1 },
          { text: '렌더 횟수를 확정한다', leadsTo: 0 },
          { text: '아니다. 성능 최적화이지 의미 보장이 아니다', correct: true },
        ],
        rationale:
          '값 계산이 싸거나 소비자가 참조를 비교하지 않으면 메모리와 의존성 관리 비용만 늘어난다.',
      },
      {
        kind: 'boundary',
        stem: '의존성을 빠뜨리면?',
        choices: [
          { text: '즉시 오류가 난다', leadsTo: 1 },
          { text: '함수가 오래된 상태를 잡는다', correct: true },
          { text: '매번 새로 계산된다', leadsTo: 1 },
          { text: '아무 일도 없다', leadsTo: 1 },
        ],
        rationale:
          '비교는 의존성만 보므로 빠진 값은 옛것에 묶인다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '클라이언트 경계는 어디에 두는가?',
    items: [
      {
        kind: 'concept',
        stem: '클라이언트로 두어야 하는 것은?',
        choices: [
          { text: '가능한 한 많은 영역', leadsTo: 0 },
          { text: '데이터 조회 전부', leadsTo: 0 },
          { text: '무거운 의존성', leadsTo: 0 },
          { text: '상호작용과 브라우저 API가 필요한 최소 영역', correct: true },
        ],
        rationale:
          '서버 컴포넌트 코드는 브라우저 번들에 포함되지 않아 자바스크립트를 줄인다.',
      },
      {
        kind: 'misconception',
        stem: '서버에서 클라이언트로 아무 값이나 넘길 수 있는가?',
        choices: [
          { text: '원시값만 넘길 수 있다', leadsTo: 1 },
          { text: '무엇이든 넘길 수 있다', leadsTo: 1 },
          { text: '직렬화할 수 있어야 한다', correct: true },
          { text: '넘길 수 없다', leadsTo: 2 },
        ],
        rationale:
          '함수처럼 직렬화되지 않는 값은 경계를 넘지 못한다.',
      },
      {
        kind: 'boundary',
        stem: '서버로 옮겨도 남는 비용은?',
        choices: [
          { text: '남는 비용이 없다', leadsTo: 3 },
          { text: '번들 크기', leadsTo: 0 },
          { text: '클라이언트 메모리', leadsTo: 0 },
          { text: '요청 지연', correct: true },
        ],
        rationale:
          '서버 자원에 직접 접근할 수 있다는 이점과 맞바꾸는 값이다.',
      },
    ],
  },
  {
    identityScope: 'browser',
    question: '첫 화면을 막는 리소스는 어떻게 줄이는가?',
    items: [
      {
        kind: 'concept',
        stem: 'CSS와 스크립트가 각각 막는 지점은?',
        choices: [
          { text: '둘 다 HTML 파싱', leadsTo: 1 },
          { text: 'CSS는 렌더 트리 구성, 스크립트는 HTML 파싱', correct: true },
          { text: '둘 다 렌더 트리', leadsTo: 1 },
          { text: '반대다', leadsTo: 1 },
        ],
        rationale:
          '외부 스타일시트는 CSSOM이 준비될 때까지 첫 페인트를 늦춘다.',
      },
      {
        kind: 'misconception',
        stem: 'defer와 async의 차이는?',
        choices: [
          { text: 'defer는 순서대로, async는 순서가 없다', correct: true },
          { text: '둘 다 문서에 적힌 순서를 지킨다', leadsTo: 0 },
          { text: '둘 다 내려받은 순서대로 실행된다', leadsTo: 0 },
          { text: '실행 시점만 다르고 순서는 같다', leadsTo: 0 },
        ],
        rationale:
          'async는 다운로드 즉시 실행하므로 독립적인 코드에 알맞다.',
      },
      {
        kind: 'boundary',
        stem: 'CSS의 차단 범위를 줄이는 방법은?',
        choices: [
          { text: '줄일 방법이 없다', leadsTo: 1 },
          { text: '한 파일로 합친다', leadsTo: 3 },
          { text: '전부 인라인으로 넣는다', leadsTo: 3 },
          { text: '안 쓰는 것을 빼고 미디어 조건으로 나눈다', correct: true },
        ],
        rationale:
          '필수 CSS만 먼저 제공하고 나머지는 늦게 불러온다.',
      },
    ],
  },
  {
    identityScope: 'browser',
    question: '레이아웃 계산과 픽셀 갱신은 언제 생기는가?',
    items: [
      {
        kind: 'concept',
        stem: '레이아웃 계산이 생기는 조건은?',
        choices: [
          { text: '크기나 위치가 바뀔 때', correct: true },
          { text: '색상이 바뀔 때', leadsTo: 1 },
          { text: '스크롤할 때마다', leadsTo: 0 },
          { text: '항상 매 프레임', leadsTo: 0 },
        ],
        rationale:
          '기하에 영향 없는 속성이 바뀌면 픽셀만 다시 그린다.',
      },
      {
        kind: 'misconception',
        stem: '쓰기 뒤 곧바로 크기를 읽으면?',
        choices: [
          { text: '미뤄 둔 계산을 즉시 끝내야 한다', correct: true },
          { text: '캐시된 값을 준다', leadsTo: 0 },
          { text: '다음 프레임까지 미룬다', leadsTo: 2 },
          { text: '값이 틀리게 나온다', leadsTo: 0 },
        ],
        rationale:
          '읽기와 쓰기를 섞어 반복하면 레이아웃 스래싱이 된다.',
      },
      {
        kind: 'boundary',
        stem: '합성으로 처리하는 애니메이션의 대가는?',
        choices: [
          { text: '레이어 메모리가 늘 수 있다', correct: true },
          { text: '레이아웃이 매번 돈다', leadsTo: 1 },
          { text: '색을 못 바꾼다', leadsTo: 0 },
          { text: '대가가 없다', leadsTo: 3 },
        ],
        rationale:
          'transform과 opacity는 별도 레이어에서 합성할 수 있어 레이아웃과 페인트를 피한다.',
      },
    ],
  },
  {
    identityScope: 'css',
    question: '선택자 최적화는 실제로 언제 필요한가?',
    items: [
      {
        kind: 'concept',
        stem: '브라우저는 선택자를 어느 쪽부터 맞춰 보는가?',
        choices: [
          { text: '규칙을 쓴 순서대로 전부 검사한다', leadsTo: 0 },
          { text: '왼쪽 조상부터 자식으로 내려온다', leadsTo: 0 },
          { text: '오른쪽 항에서 후보를 찾고 조상을 거슬러 확인한다', correct: true },
          { text: '자주 쓰는 규칙을 먼저 검사한다', leadsTo: 3 },
        ],
        rationale:
          '오른쪽 항이 넓고 조합이 깊으면 후보 탐색과 조상 확인이 늘어난다.',
      },
      {
        kind: 'misconception',
        stem: '스타일이 느릴 때 선택자부터 단순화하면 되는가?',
        choices: [
          { text: '아니다. 스타일 비용은 손댈 수 없다', leadsTo: 4 },
          { text: '그렇다. 선택자 길이가 스타일 비용을 결정한다', leadsTo: 1 },
          { text: '그렇다. 깊은 후손 선택자는 항상 병목이다', leadsTo: 0 },
          { text: '아니다. 보통 DOM 규모와 잦은 클래스 변경을 줄이는 편이 효과가 크다', correct: true },
        ],
        rationale:
          '현대 엔진은 선택자 매칭을 강하게 최적화해서 단순화만으로 얻는 몫이 작다.',
      },
      {
        kind: 'boundary',
        stem: '선택자를 손대야 할 때인지 무엇으로 판단하는가?',
        choices: [
          { text: '성능 기록에서 스타일 재계산 비중과 영향받는 요소 수를 본다', correct: true },
          { text: '규칙 개수가 일정 수를 넘는지 본다', leadsTo: 4 },
          { text: '선택자 문자열 길이를 잰다', leadsTo: 0 },
          { text: '느리다고 느껴지면 바로 고친다', leadsTo: 4 },
        ],
        rationale:
          '스타일 재계산이 병목으로 측정되고 DOM이 클 때라야 선택자 손질이 값을 한다.',
      },
    ],
  },
  {
    identityScope: 'css',
    question: '선언한 너비와 실제 크기가 왜 달라지는가?',
    items: [
      {
        kind: 'concept',
        stem: '기본값인 content-box에서 width는 어디까지를 가리키는가?',
        choices: [
          { text: '마진까지 포함한 바깥 크기', leadsTo: 0 },
          { text: '콘텐츠와 패딩까지', leadsTo: 0 },
          { text: '콘텐츠·패딩·테두리 전부', leadsTo: 0 },
          { text: '콘텐츠 영역만 가리킨다', correct: true },
        ],
        rationale:
          'content-box에서는 선언한 너비 밖에 패딩과 테두리가 더해져 바깥 크기가 값보다 커진다.',
      },
      {
        kind: 'misconception',
        stem: 'border-box를 걸면 안쪽 콘텐츠 폭도 그대로 유지되는가?',
        choices: [
          { text: '아니다. 패딩과 테두리가 늘수록 콘텐츠 영역이 줄어든다', correct: true },
          { text: '그렇다. 콘텐츠 폭은 선언값으로 고정된다', leadsTo: 2 },
          { text: '그렇다. 패딩이 바깥으로 밀려난다', leadsTo: 0 },
          { text: '아니다. 테두리가 무시된다', leadsTo: 3 },
        ],
        rationale:
          'border-box는 선언한 너비 안에 패딩과 테두리를 넣어 바깥 크기를 고정한다.',
      },
      {
        kind: 'boundary',
        stem: '마진은 박스 크기 계산에서 어떻게 다뤄지는가?',
        choices: [
          { text: '박스 크기에 포함되지 않고 주변 간격을 만든다', correct: true },
          { text: 'content-box에서만 너비에 더해진다', leadsTo: 0 },
          { text: 'border-box에서 너비 안으로 들어간다', leadsTo: 0 },
          { text: '패딩과 같은 방식으로 계산된다', leadsTo: 1 },
        ],
        rationale:
          '마진은 두 상자 어느 쪽에서도 너비에 들어가지 않는다.',
      },
    ],
  },
  {
    identityScope: 'css',
    question: '한 축 배치와 두 축 배치는 어떻게 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '행과 열 트랙을 먼저 정의하고 항목을 앉히는 쪽은?',
        choices: [
          { text: '둘 다 콘텐츠 흐름만 따른다', leadsTo: 1 },
          { text: 'Flexbox', leadsTo: 0 },
          { text: '둘 다 트랙을 먼저 정의한다', leadsTo: 2 },
          { text: 'Grid', correct: true },
        ],
        rationale:
          'Grid는 트랙 구조가 먼저이고 Flexbox는 콘텐츠 흐름이 먼저다.',
      },
      {
        kind: 'misconception',
        stem: 'Flexbox를 줄바꿈시키면 격자처럼 열이 맞는가?',
        choices: [
          { text: '아니다. Flexbox는 줄바꿈을 못 한다', leadsTo: 0 },
          { text: '그렇다. 줄바꿈이 트랙을 만든다', leadsTo: 0 },
          { text: '그렇다. 항목 크기가 같으면 항상 맞는다', leadsTo: 2 },
          { text: '아니다. 각 줄이 독립적으로 정렬돼 열 맞춤에는 약하다', correct: true },
        ],
        rationale:
          '줄바꿈해도 줄끼리는 서로를 모르므로 두 축을 함께 맞추려면 Grid가 맞다.',
      },
      {
        kind: 'boundary',
        stem: '한 화면에서 둘을 같이 써도 되는가?',
        choices: [
          { text: '안 된다. 한 문서에 하나만 골라야 한다', leadsTo: 4 },
          { text: '된다. 페이지는 Grid, 내부 도구 모음은 Flexbox가 자연스럽다', correct: true },
          { text: '안 된다. 중첩하면 트랙이 깨진다', leadsTo: 4 },
          { text: '된다. 다만 Grid 안에는 Grid만 넣을 수 있다', leadsTo: 4 },
        ],
        rationale:
          '영역 전체는 두 축으로 설계하고 그 안의 한 줄짜리 흐름은 한 축으로 두면 된다.',
      },
    ],
  },
  {
    identityScope: 'browser',
    question: '화면 밖 이미지는 언제 불러와야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'loading=lazy는 정확히 무엇을 하는가?',
        choices: [
          { text: '이미지 용량을 줄여 내려받는다', leadsTo: 3 },
          { text: '정확히 화면에 들어온 순간 요청한다', leadsTo: 1 },
          { text: '브라우저가 거리와 네트워크 상황을 보고 로드를 미룬다', correct: true },
          { text: '요청 순서를 뒤로 미룰 뿐 시점은 같다', leadsTo: 1 },
        ],
        rationale:
          '시점을 더 세밀하게 잡아야 하면 IntersectionObserver로 접근을 감지한다.',
      },
      {
        kind: 'misconception',
        stem: '모든 이미지에 지연 로딩을 걸면 더 빨라지는가?',
        choices: [
          { text: '그렇다. 요청이 줄어드니 항상 이득이다', leadsTo: 0 },
          { text: '아니다. 첫 화면 이미지는 지연 로딩하지 않는다', correct: true },
          { text: '그렇다. 브라우저가 알아서 첫 화면을 예외로 둔다', leadsTo: 0 },
          { text: '아니다. 지연 로딩은 어디에도 쓰지 않는다', leadsTo: 1 },
        ],
        rationale:
          '첫 화면 중 LCP 후보에는 오히려 높은 우선순위를 줘야 표시가 늦지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '지연 로딩을 걸 때 함께 해야 하는 일은?',
        choices: [
          { text: '자리 표시자를 지워 여백을 없앤다', leadsTo: 2 },
          { text: 'width와 height로 자리를 예약한다', correct: true },
          { text: '이미지를 모두 같은 크기로 자른다', leadsTo: 3 },
          { text: '아무것도 없다. 로드되면 자연히 자리가 잡힌다', leadsTo: 2 },
        ],
        rationale:
          '공간을 미리 잡지 않으면 로드 순간 레이아웃이 움직여 누적 레이아웃 이동이 생긴다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '번들은 어떤 경계로 나눠 불러오는가?',
    items: [
      {
        kind: 'concept',
        stem: '무엇이 별도 청크를 만드는 경계가 되는가?',
        choices: [
          { text: '파일을 새로 만드는 것', leadsTo: 0 },
          { text: '동적 import', correct: true },
          { text: '함수를 분리하는 것', leadsTo: 0 },
          { text: '폴더를 나누는 것', leadsTo: 0 },
        ],
        rationale:
          'React에서는 lazy와 Suspense를 함께 써서 로딩 상태를 보여주며 늦게 읽는다.',
      },
      {
        kind: 'misconception',
        stem: '청크를 잘게 나눌수록 초기 로딩이 계속 빨라지는가?',
        choices: [
          { text: '아니다. 요청 수와 로딩 화면이 늘고 공통 모듈이 중복될 수 있다', correct: true },
          { text: '그렇다. 조각이 작을수록 항상 이득이다', leadsTo: 2 },
          { text: '그렇다. 브라우저가 병렬로 받아 상쇄한다', leadsTo: 2 },
          { text: '아니다. 분할 자체가 손해다', leadsTo: 0 },
        ],
        rationale:
          '사용 빈도와 청크 크기, 캐시 적중률을 재서 경계를 조정해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '초기 진입에 먼저 보내야 하는 것은?',
        choices: [
          { text: '초기 경로에 필요한 코드만', correct: true },
          { text: '모든 경로의 코드', leadsTo: 0 },
          { text: '무거운 라이브러리부터', leadsTo: 3 },
          { text: '자주 쓰는 기능 전부', leadsTo: 1 },
        ],
        rationale:
          '나머지는 경로와 기능, 무거운 라이브러리 경계로 나눠 필요할 때 불러온다.',
      },
    ],
  },
  {
    identityScope: 'javascript',
    question: '번들 최적화는 어디서 시작하는가?',
    items: [
      {
        kind: 'concept',
        stem: '가장 먼저 할 일은?',
        choices: [
          { text: '소스 맵을 끈다', leadsTo: 4 },
          { text: '청크를 경로별로 나눈다', leadsTo: 3 },
          { text: '압축 설정을 올린다', leadsTo: 4 },
          { text: '분석 도구로 큰 모듈과 중복 의존성을 찾는다', correct: true },
        ],
        rationale:
          '제거 뒤에 분할하고, 전송량과 실행 시간을 비교해 검증하는 순서다.',
      },
      {
        kind: 'misconception',
        stem: '압축을 강하게 걸면 실행도 같이 빨라지는가?',
        choices: [
          { text: '그렇다. 파일이 작아지면 파싱도 준다', leadsTo: 4 },
          { text: '아니다. 압축은 전송량만 줄인다', correct: true },
          { text: '그렇다. 압축이 코드를 지워 준다', leadsTo: 0 },
          { text: '아니다. 압축은 아무 효과가 없다', leadsTo: 4 },
        ],
        rationale:
          '파싱과 실행 비용을 낮추려면 실제 코드 자체를 덜 보내야 한다.',
      },
      {
        kind: 'boundary',
        stem: '분할 경계를 잡을 때 기준으로 삼는 것은?',
        choices: [
          { text: '가능한 한 잘게 쪼개는 것', leadsTo: 1 },
          { text: '파일 개수를 고르게 맞추는 것', leadsTo: 1 },
          { text: '폴더 구조를 그대로 따르는 것', leadsTo: 1 },
          { text: '화면 진입 빈도와 공통 의존성', correct: true },
        ],
        rationale:
          '지나치게 잘게 나누면 요청과 로딩 조율 비용이 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'css',
    question: '폰트 표시 지연과 깜빡임을 어떻게 줄이는가?',
    items: [
      {
        kind: 'concept',
        stem: 'swap과 optional은 무엇이 갈리는가?',
        choices: [
          { text: '느리게 도착한 글꼴을 교체하느냐 생략하느냐', correct: true },
          { text: '첫 표시에 대체 글꼴을 쓰느냐 마느냐', leadsTo: 2 },
          { text: '서브셋을 만드느냐 마느냐', leadsTo: 1 },
          { text: '자체 호스팅이냐 외부냐', leadsTo: 0 },
        ],
        rationale:
          '둘 다 첫 표시는 대체 글꼴로 하고, 교체 시점에서만 갈린다.',
      },
      {
        kind: 'misconception',
        stem: '글꼴을 전부 preload하면 표시가 빨라지는가?',
        choices: [
          { text: '그렇다. 우선순위가 올라가니 항상 이득이다', leadsTo: 0 },
          { text: '아니다. 핵심 이미지와 스크립트의 다운로드가 늦어진다', correct: true },
          { text: '그렇다. 브라우저가 남는 대역만 쓴다', leadsTo: 0 },
          { text: '아니다. preload는 글꼴에 쓸 수 없다', leadsTo: 0 },
        ],
        rationale:
          'preload는 첫 화면에 반드시 쓰는 파일에만 적용한다.',
      },
      {
        kind: 'boundary',
        stem: '교체 순간의 레이아웃 이동은 무엇으로 줄이는가?',
        choices: [
          { text: '글꼴 파일을 더 잘게 서브셋한다', leadsTo: 1 },
          { text: '대체 글꼴의 글자 폭과 행간을 실제 글꼴에 맞춘다', correct: true },
          { text: '교체를 아예 생략한다', leadsTo: 2 },
          { text: '글자 크기를 줄인다', leadsTo: 4 },
        ],
        rationale:
          'size-adjust 같은 기술로 대체 글꼴의 크기를 맞추면 이동이 줄어든다.',
      },
    ],
  },
  {
    identityScope: 'accessibility',
    question: '화면이 바뀐 뒤 포커스는 어디로 보내는가?',
    items: [
      {
        kind: 'concept',
        stem: '모달을 닫을 때 포커스는 어디로 가야 하는가?',
        choices: [
          { text: '다음 상호작용 요소로 넘긴다', leadsTo: 1 },
          { text: '문서 맨 처음으로 보낸다', leadsTo: 1 },
          { text: '아무 데도 보내지 않고 둔다', leadsTo: 2 },
          { text: '모달을 연 요소로 돌려보낸다', correct: true },
        ],
        rationale:
          '열기 버튼으로 되돌려야 사용자가 원래 있던 자리를 잃지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '모달이 열려 있으면 Tab이 배경으로 나가도 괜찮은가?',
        choices: [
          { text: '괜찮다. 시각적으로 가려져 있으면 문제없다', leadsTo: 2 },
          { text: '괜찮다. 배경도 화면에 보이니 이동할 수 있어야 한다', leadsTo: 0 },
          { text: '아니다. Tab 이동은 모달 안에 머물러야 한다', correct: true },
          { text: '아니다. 대신 Tab 자체를 막아야 한다', leadsTo: 0 },
        ],
        rationale:
          '배경은 키보드와 보조 기술에서 비활성화하고 Esc로 닫는 경로도 준다.',
      },
      {
        kind: 'boundary',
        stem: '포커스를 자동으로 옮겨도 되는 때는?',
        choices: [
          { text: '마우스가 요소 위로 올 때', leadsTo: 3 },
          { text: '입력이 끝났다고 판단될 때마다', leadsTo: 4 },
          { text: '페이지를 처음 열 때마다', leadsTo: 1 },
          { text: '화면 변화로 현재 맥락이 끊길 때', correct: true },
        ],
        rationale:
          '자동 이동은 맥락이 끊길 때만 쓰고, DOM 순서는 시각적 순서와 맞춘다.',
      },
    ],
  },
  {
    identityScope: 'html',
    question: 'div만 쓰면 어떤 비용이 드는가?',
    items: [
      {
        kind: 'concept',
        stem: 'button을 div로 흉내 내면 무엇을 직접 해야 하는가?',
        choices: [
          { text: '아무것도 없다. 동작은 같다', leadsTo: 2 },
          { text: '색과 여백만 다시 잡으면 된다', leadsTo: 2 },
          { text: '클릭 이벤트만 붙이면 된다', leadsTo: 0 },
          { text: 'Enter와 Space 처리, 비활성 상태', correct: true },
        ],
        rationale:
          '네이티브 요소는 기본 역할과 키보드 동작을 함께 제공한다.',
      },
      {
        kind: 'misconception',
        stem: 'ARIA를 붙이면 시맨틱 요소와 같아지는가?',
        choices: [
          { text: '아니다. 역할만 알릴 뿐 키보드 동작은 따라오지 않는다', correct: true },
          { text: '그렇다. 역할을 지정하면 동작도 생긴다', leadsTo: 2 },
          { text: '그렇다. 보조 기술이 알아서 처리한다', leadsTo: 2 },
          { text: '아니다. ARIA는 아무 효과가 없다', leadsTo: 2 },
        ],
        rationale:
          '구조 인식은 지정할 수 있어도 키보드 동작은 직접 구현해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '요소를 고르는 기준은 무엇인가?',
        choices: [
          { text: '원하는 화면 모양에 가까운 것을 고른다', leadsTo: 0 },
          { text: '콘텐츠의 의미와 동작을 먼저 정한다', correct: true },
          { text: '가장 짧게 쓰이는 태그를 고른다', leadsTo: 3 },
          { text: '기본 스타일이 없는 것을 고른다', leadsTo: 0 },
        ],
        rationale:
          '표현은 CSS로 바꾸면 되고, 그래야 접근성과 유지보수가 함께 좋아진다.',
      },
    ],
  },
  {
    identityScope: 'web-performance',
    question: '체감 성능은 어떤 세 지표로 판단하는가?',
    items: [
      {
        kind: 'concept',
        stem: '레이아웃 이동을 드러내는 지표는?',
        choices: [
          { text: 'CLS', correct: true },
          { text: 'LCP', leadsTo: 0 },
          { text: 'INP', leadsTo: 1 },
          { text: '세 지표 모두 함께 반영한다', leadsTo: 2 },
        ],
        rationale:
          'LCP는 주요 콘텐츠 표시 속도, INP는 상호작용 지연을 본다.',
      },
      {
        kind: 'misconception',
        stem: '평균값이 좋으면 사용자 경험도 좋다고 볼 수 있는가?',
        choices: [
          { text: '그렇다. 평균이 전체를 대표한다', leadsTo: 4 },
          { text: '아니다. 방문의 75번째 백분위에서 본다', correct: true },
          { text: '그렇다. 최빈값이면 더 정확하다', leadsTo: 4 },
          { text: '아니다. 최악값만 봐야 한다', leadsTo: 4 },
        ],
        rationale:
          '모바일과 데스크톱도 나눠 봐야 느린 쪽이 가려지지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '현장 데이터와 실험실 데이터는 어떻게 쓰는가?',
        choices: [
          { text: '실험실 데이터만으로 판정한다', leadsTo: 3 },
          { text: '현장 데이터만 신뢰한다', leadsTo: 3 },
          { text: '개선 전후에 둘을 함께 본다', correct: true },
          { text: '둘 중 좋은 쪽을 고른다', leadsTo: 3 },
        ],
        rationale:
          '현장은 실제 기기와 네트워크를, 실험실은 재현과 원인 분석을 맡는다.',
      },
    ],
  },
  {
    identityScope: 'browser',
    question: '클라이언트 데이터는 어디에 보관해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '쿠키와 IndexedDB의 결정적 차이는?',
        choices: [
          { text: '둘 다 동기 API다', leadsTo: 2 },
          { text: '쿠키만 만료를 가진다', leadsTo: 0 },
          { text: 'IndexedDB만 탭 사이에서 공유된다', leadsTo: 3 },
          { text: '쿠키는 서버로 자동 전송되고 IndexedDB는 아니다', correct: true },
        ],
        rationale:
          '그래서 작은 서버 연동 값은 쿠키에, 큰 구조화 데이터는 IndexedDB에 둔다.',
      },
      {
        kind: 'misconception',
        stem: 'localStorage에 큰 데이터를 담아도 괜찮은가?',
        choices: [
          { text: '괜찮다. 브라우저가 뒤에서 처리한다', leadsTo: 1 },
          { text: '괜찮다. 용량 제한만 넘지 않으면 된다', leadsTo: 1 },
          { text: '아니다. 동기 API라 메인 스레드를 막는다', correct: true },
          { text: '아니다. localStorage는 문자열을 못 담는다', leadsTo: 1 },
        ],
        rationale:
          'localStorage는 단순한 장기 설정에 맞고 큰 값은 IndexedDB로 보낸다.',
      },
      {
        kind: 'boundary',
        stem: '세션 식별자는 어디에 두는가?',
        choices: [
          { text: 'IndexedDB에 암호화해 둔다', leadsTo: 4 },
          { text: 'localStorage에 두고 만료를 직접 관리한다', leadsTo: 4 },
          { text: 'sessionStorage에 두면 탭과 함께 사라져 안전하다', leadsTo: 4 },
          { text: 'Secure와 HttpOnly를 적용한 쿠키를 우선 검토한다', correct: true },
        ],
        rationale:
          '자바스크립트로 읽을 수 있는 저장소에 두면 XSS에 노출된다.',
      },
    ],
  },
  {
    identityScope: 'pwa',
    question: '응답 특성에 따라 캐시 방식을 어떻게 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: 'Stale While Revalidate는 어떻게 동작하는가?',
        choices: [
          { text: '캐시를 즉시 보여주고 뒤에서 갱신한다', correct: true },
          { text: '네트워크를 먼저 보고 실패하면 캐시를 쓴다', leadsTo: 3 },
          { text: '캐시가 만료됐을 때만 네트워크로 간다', leadsTo: 0 },
          { text: '항상 네트워크만 쓴다', leadsTo: 2 },
        ],
        rationale:
          '빠른 표시와 적당한 최신성이 모두 필요한 이미지나 목록에 맞는다.',
      },
      {
        kind: 'misconception',
        stem: '오프라인을 위해 모든 응답을 캐시하면 되는가?',
        choices: [
          { text: '아니다. 실패 응답을 저장하지 않는다', correct: true },
          { text: '그렇다. 많이 담을수록 오프라인에 강하다', leadsTo: 1 },
          { text: '그렇다. 만료만 걸어 두면 된다', leadsTo: 0 },
          { text: '아니다. 캐시는 정적 자산에만 쓸 수 있다', leadsTo: 2 },
        ],
        rationale:
          '요청 종류별로 만료와 최대 개수도 제한해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '최신성이 중요한 API에는 무엇을 쓰는가?',
        choices: [
          { text: 'Cache First', leadsTo: 0 },
          { text: 'Network First나 Network Only', correct: true },
          { text: 'Stale While Revalidate만', leadsTo: 2 },
          { text: '캐시를 아예 쓰지 않는 것 외엔 방법이 없다', leadsTo: 2 },
        ],
        rationale:
          '정적 자산은 Cache First가 맞지만 최신성이 걸리면 네트워크가 먼저다.',
      },
    ],
  },
  {
    identityScope: 'web-rendering',
    question: '렌더링 방식은 어떤 요구로 결정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '요청마다 달라지는 데이터에 맞는 방식은?',
        choices: [
          { text: '어느 쪽이든 같다', leadsTo: 4 },
          { text: 'SSG', leadsTo: 1 },
          { text: 'CSR', leadsTo: 2 },
          { text: 'SSR', correct: true },
        ],
        rationale:
          '정적 콘텐츠는 미리 생성하는 SSG, 앱형 상호작용은 브라우저가 그리는 CSR이 유리하다.',
      },
      {
        kind: 'misconception',
        stem: 'SSG는 빠르니 어디에나 쓰면 되는가?',
        choices: [
          { text: '그렇다. 응답이 빠르고 서버 부하도 작다', leadsTo: 1 },
          { text: '아니다. 갱신이 늦을 수 있다', correct: true },
          { text: '그렇다. 재생성이 항상 즉시 반영된다', leadsTo: 1 },
          { text: '아니다. 검색 노출이 나빠진다', leadsTo: 2 },
        ],
        rationale:
          '미리 만들어 두는 대가로 최신 데이터가 늦는다. SSR은 반대로 요청마다 비용과 장애 지점이 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '실제 서비스에서는 방식을 어떻게 쓰는가?',
        choices: [
          { text: '검색 노출이 필요하면 SSR로만 짠다', leadsTo: 0 },
          { text: '서비스 전체를 한 방식으로 통일한다', leadsTo: 4 },
          { text: '트래픽이 늘면 CSR로 전부 옮긴다', leadsTo: 2 },
          { text: '경로와 컴포넌트마다 섞고 캐시나 재생성으로 약점을 보완한다', correct: true },
        ],
        rationale:
          '콘텐츠 갱신 주기와 개인화, 검색 노출, 서버 비용이 경로마다 다르다.',
      },
    ],
  },
  {
    identityScope: 'ssr',
    question: '서버 HTML과 첫 렌더가 다르면 왜 문제인가?',
    items: [
      {
        kind: 'concept',
        stem: '서버 HTML과 첫 트리가 같으면 브라우저는 무엇을 하는가?',
        choices: [
          { text: '기존 DOM을 두고 이벤트만 연결한다', correct: true },
          { text: '트리를 다시 그린 뒤 교체한다', leadsTo: 3 },
          { text: '서버 HTML을 버리고 새로 만든다', leadsTo: 3 },
          { text: '두 트리를 합쳐 새 트리를 만든다', leadsTo: 3 },
        ],
        rationale:
          '다르면 일부 트리를 다시 그리는 복구 비용이 생긴다.',
      },
      {
        kind: 'misconception',
        stem: '불일치는 화면이 잠깐 깜빡이는 정도의 문제인가?',
        choices: [
          { text: '아니다. 상태 손실과 이벤트 연결 오류로도 이어진다', correct: true },
          { text: '그렇다. 결국 올바른 화면으로 수렴한다', leadsTo: 3 },
          { text: '그렇다. 경고만 나올 뿐 동작은 같다', leadsTo: 3 },
          { text: '아니다. 렌더가 아예 중단된다', leadsTo: 2 },
        ],
        rationale:
          '하이드레이션이 기존 DOM을 안전하게 재사용하지 못해 생기는 문제들이다.',
      },
      {
        kind: 'boundary',
        stem: '브라우저에만 있는 값은 언제 읽어야 하는가?',
        choices: [
          { text: '읽지 않고 포기한다', leadsTo: 1 },
          { text: '렌더 함수 안에서 바로 읽는다', leadsTo: 1 },
          { text: '서버에서 기본값을 추측해 채운다', leadsTo: 1 },
          { text: '마운트 뒤에 읽는다', correct: true },
        ],
        rationale:
          '렌더 중 window나 저장소를 읽으면 서버에 없던 값이 생겨 불일치가 된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '로그 레벨을 구분하여 설정하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'INFO 레벨로 설정하면 무엇이 출력되는가?',
        choices: [
          { text: 'ERROR만 출력된다', leadsTo: 1 },
          { text: 'INFO 레벨만 정확히 출력된다', leadsTo: 1 },
          { text: 'DEBUG를 포함한 모든 레벨이 출력된다', leadsTo: 1 },
          { text: 'INFO 이상의 레벨만 출력되고 DEBUG는 무시된다', correct: true },
        ],
        rationale:
          '로그 레벨은 계층 구조라 설정한 레벨 아래는 걸러진다.',
      },
      {
        kind: 'misconception',
        stem: '안전하게 가려면 ERROR만 남기면 되는가?',
        choices: [
          { text: '그렇다. 운영에서는 ERROR 외에 볼 것이 없다', leadsTo: 4 },
          { text: '그렇다. 디스크를 아끼고 장애도 놓치지 않는다', leadsTo: 4 },
          { text: '아니다. 장애 원인을 찾을 맥락 정보가 부족해진다', correct: true },
          { text: '아니다. ERROR는 운영에서 끄는 것이 맞다', leadsTo: 0 },
        ],
        rationale:
          '맥락이 없으면 복구 시간이 길어진다.',
      },
      {
        kind: 'boundary',
        stem: '운영 서버에 DEBUG를 켜 두면 무슨 일이 벌어지는가?',
        choices: [
          { text: '프레임워크가 자동으로 레벨을 올린다', leadsTo: 0 },
          { text: '로그 파일만 커질 뿐 성능은 그대로다', leadsTo: 2 },
          { text: '디스크 I/O가 폭증해 성능이 급격히 떨어질 수 있다', correct: true },
          { text: '개발자에게만 보이고 서버에는 남지 않는다', leadsTo: 1 },
        ],
        rationale:
          'DEBUG는 출력 빈도가 매우 높아 운영 환경에서 부담이 크다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'CSRF와 XSS의 결정적인 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'CSRF는 세션을 어떻게 다루는가?',
        choices: [
          { text: '서버의 세션 저장소를 직접 읽는다', leadsTo: 1 },
          { text: '세션 ID를 훔쳐 재사용한다', leadsTo: 0 },
          { text: '스크립트를 삽입해 세션을 새로 만든다', leadsTo: 0 },
          { text: '가로채지 않고 이미 로그인해 있다는 점을 그대로 이용한다', correct: true },
        ],
        rationale:
          '핵심 원인이 자동 전송되는 쿠키라서 위조된 요청만으로 상태가 바뀐다.',
      },
      {
        kind: 'misconception',
        stem: 'HttpOnly 쿠키를 쓰면 XSS 피해가 사라지는가?',
        choices: [
          { text: '아니다. 쿠키는 못 읽어도 그 자리에서 요청을 대신 보낼 수 있다', correct: true },
          { text: '그렇다. 세션을 못 훔치면 할 수 있는 게 없다', leadsTo: 4 },
          { text: '그렇다. 스크립트 삽입 자체가 막힌다', leadsTo: 3 },
          { text: '아니다. HttpOnly는 스크립트도 읽을 수 있다', leadsTo: 2 },
        ],
        rationale:
          'XSS는 그 출처의 권한으로 남의 스크립트를 돌린다는 점이 본질이다.',
      },
      {
        kind: 'boundary',
        stem: '두 공격의 피해 범위는 어떻게 다른가?',
        choices: [
          { text: '둘 다 상태를 바꾸는 요청에만 해당한다', leadsTo: 1 },
          { text: 'CSRF는 상태 변경에, XSS는 더 넓게 미친다', correct: true },
          { text: 'XSS는 읽기만, CSRF는 쓰기만 가능하다', leadsTo: 4 },
          { text: '돈이 움직이는 CSRF가 항상 더 위험하다', leadsTo: 4 },
        ],
        rationale:
          'CSRF는 비밀번호 변경 같은 상태 변경 요청에 치명적이다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '프론트엔드 성능 최적화 시 번들 크기를 무엇으로 판단하는가?',
    items: [
      {
        kind: 'concept',
        stem: '번들을 볼 때 파일 용량 말고 무엇을 함께 보는가?',
        choices: [
          { text: '파일 개수', leadsTo: 0 },
          { text: '런타임 실행 시간과 파싱 시간', correct: true },
          { text: '의존성 목록의 길이', leadsTo: 1 },
          { text: '압축률만', leadsTo: 2 },
        ],
        rationale:
          '네트워크 성능과 런타임 성능은 서로 다른 요소다.',
      },
      {
        kind: 'misconception',
        stem: '파일이 작으면 TBT도 작다고 볼 수 있는가?',
        choices: [
          { text: '그렇다. 다운로드가 끝나면 실행은 즉시다', leadsTo: 3 },
          { text: '그렇다. 용량이 실행 시간을 결정한다', leadsTo: 3 },
          { text: '아니다. 복잡한 로직이 많으면 늘어난다', correct: true },
          { text: '아니다. TBT는 용량과 무관하게 항상 일정하다', leadsTo: 2 },
        ],
        rationale:
          '초기 JS가 줄어야 메인 스레드 점유 시간도 짧아진다.',
      },
      {
        kind: 'boundary',
        stem: '트리 쉐이킹이 잘 듣는 라이브러리는?',
        choices: [
          { text: 'ESM을 지원하는 라이브러리', correct: true },
          { text: '용량이 작은 라이브러리', leadsTo: 1 },
          { text: '의존성이 없는 라이브러리', leadsTo: 1 },
          { text: '어떤 라이브러리든 똑같이 듣는다', leadsTo: 1 },
        ],
        rationale:
          'ESM이면 사용하지 않은 내보내기를 제거하기 쉽다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '웹 서버와 WAS의 역할 분담은 왜 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '앞단의 웹 서버가 맡는 일은?',
        choices: [
          { text: '비즈니스 로직 수행', leadsTo: 3 },
          { text: 'DB 조회', leadsTo: 3 },
          { text: 'HTML, CSS, 이미지 같은 정적 파일 처리', correct: true },
          { text: '동적 콘텐츠 생성', leadsTo: 1 },
        ],
        rationale:
          '정적 파일을 앞에서 걸러 주면 WAS는 무거운 로직에만 집중할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '역할을 나누는 이유가 성능뿐인가?',
        choices: [
          { text: '아니다. 오히려 장애 지점이 늘 뿐이다', leadsTo: 1 },
          { text: '그렇다. 응답 속도 외에 얻는 것은 없다', leadsTo: 1 },
          { text: '그렇다. 보안은 별개 계층에서 다룬다', leadsTo: 2 },
          { text: '아니다. WAS 장애 때 웹 서버가 에러 페이지를 대신 보여준다', correct: true },
        ],
        rationale:
          '여러 대의 WAS를 뒤에 두고 부하를 나누는 구조도 짜기 쉬워진다.',
      },
      {
        kind: 'boundary',
        stem: '요청은 무엇을 기준으로 나뉘는가?',
        choices: [
          { text: '사용자 위치에 따라 나눈다', leadsTo: 2 },
          { text: '요청량이 많은 순서대로 나눈다', leadsTo: 2 },
          { text: '요청의 성격에 따라 처리 주체를 나눈다', correct: true },
          { text: '무작위로 분산한다', leadsTo: 2 },
        ],
        rationale:
          '정적이냐 동적이냐로 갈라 전체 응답 속도를 높인다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: 'React Hook을 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '훅이 해결한 클래스 컴포넌트의 문제는?',
        choices: [
          { text: '렌더링이 느린 것', leadsTo: 2 },
          { text: '로직 재사용이 어렵고 코드가 비대해지는 것', correct: true },
          { text: '타입을 붙일 수 없는 것', leadsTo: 1 },
          { text: '상태를 아예 가질 수 없는 것', leadsTo: 3 },
        ],
        rationale:
          '상태 관련 로직을 함수로 분리해 여러 컴포넌트에서 공유할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '훅은 함수형 컴포넌트를 빠르게 만들어 주는가?',
        choices: [
          { text: '아니다. 상태 관리와 생명주기 기능을 쓸 수 있게 해 준다', correct: true },
          { text: '그렇다. 렌더링 비용을 자동으로 줄인다', leadsTo: 2 },
          { text: '그렇다. 리렌더를 건너뛴다', leadsTo: 2 },
          { text: '아니다. 문법만 짧게 바꾼 것이다', leadsTo: 1 },
        ],
        rationale:
          '클래스에서 this.state와 lifecycle methods로 하던 일을 함수형에서 하게 만든 도구다.',
      },
      {
        kind: 'boundary',
        stem: 'useEffect가 통합해 다루는 시점은?',
        choices: [
          { text: '업데이트만', leadsTo: 0 },
          { text: '마운트만', leadsTo: 0 },
          { text: '마운트·업데이트·언마운트', correct: true },
          { text: '렌더 직전만', leadsTo: 0 },
        ],
        rationale:
          '세 시점을 하나의 훅으로 모아 응집도와 가독성을 높인다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: '브라우저에서 FTP 지원을 중단하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'FTP의 전송 방식이 위험한 이유는?',
        choices: [
          { text: '전송 속도가 느려 중간에 끊긴다', leadsTo: 1 },
          { text: '평문으로 주고받아 계정 정보와 파일 내용이 새어 나간다', correct: true },
          { text: '파일 크기 제한이 있다', leadsTo: 3 },
          { text: '한 번에 한 파일만 보낸다', leadsTo: 2 },
        ],
        rationale:
          'HTTPS는 TLS로 암호화해 표준으로 정착했다.',
      },
      {
        kind: 'misconception',
        stem: '중단 이유가 보안 하나뿐인가?',
        choices: [
          { text: '그렇다. 암호화만 붙이면 계속 쓸 수 있었다', leadsTo: 0 },
          { text: '아니다. 방화벽과 프록시 환경에서 포트 제어가 까다롭다', correct: true },
          { text: '그렇다. 다른 문제는 없었다', leadsTo: 2 },
          { text: '아니다. 속도가 유일한 이유다', leadsTo: 1 },
        ],
        rationale:
          '포트 범위 지정이 까다로워 사용자 경험과 개발 효율을 함께 떨어뜨렸다.',
      },
      {
        kind: 'boundary',
        stem: '지금 파일 전송의 표준은?',
        choices: [
          { text: '표준이 아직 없다', leadsTo: 3 },
          { text: '브라우저 내장 FTP 클라이언트', leadsTo: 3 },
          { text: '별도 전용 프로그램만', leadsTo: 3 },
          { text: 'HTTP/S 기반의 업로드·다운로드 API', correct: true },
        ],
        rationale:
          '브라우저가 직접 FTP를 동작시키는 기능은 더 이상 필요하지 않다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '브라우저가 요청을 미리 한 번 더 보내는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '단순한 요청이 거절될 때 서버는 어떻게 되는가?',
        choices: [
          { text: '서버가 요청을 거부해 되돌린다', leadsTo: 4 },
          { text: '요청이 서버에 닿지 않는다', leadsTo: 4 },
          { text: '서버까지 가서 처리되고 브라우저가 응답만 못 읽게 막는다', correct: true },
          { text: '서버가 빈 응답을 만들어 보낸다', leadsTo: 4 },
        ],
        rationale:
          '막는 쪽이 브라우저라서 서버 로그에는 남는다.',
      },
      {
        kind: 'misconception',
        stem: '거절되면 서버는 항상 아무 일도 안 하는가?',
        choices: [
          { text: '그렇다. 브라우저가 항상 먼저 묻는다', leadsTo: 0 },
          { text: '그렇다. 어느 경우든 서버에 닿지 않는다', leadsTo: 4 },
          { text: '아니다. 먼저 묻는 경우에만 진짜 요청이 아예 안 간다', correct: true },
          { text: '아니다. 두 경우 모두 서버가 처리한다', leadsTo: 0 },
        ],
        rationale:
          '사전 요청이 거절되면 그 뒤 요청은 보내지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '먼저 묻는 단계를 건너뛰는 조건은?',
        choices: [
          { text: '같은 주소와 같은 포트로 보낼 때', leadsTo: 0 },
          { text: 'GET·HEAD·POST이면서 허용된 헤더와 본문 종류만 쓸 때', correct: true },
          { text: '응답 본문이 충분히 작을 때', leadsTo: 0 },
          { text: '쿠키 같은 자격 증명을 함께 보낼 때', leadsTo: 1 },
        ],
        rationale:
          'application/json으로 보내거나 Authorization을 붙이면 먼저 묻는다.',
      },
    ],
  },
  {
    identityScope: 'browser',
    question: '스타일을 바꿨을 뿐인데 왜 느려지는가?',
    items: [
      {
        kind: 'concept',
        stem: '색만 바꾸면 무엇을 건너뛰는가?',
        choices: [
          { text: '어디 있는지 다시 재는 일', correct: true },
          { text: '칠하는 일', leadsTo: 2 },
          { text: '합성', leadsTo: 3 },
          { text: '아무것도 건너뛰지 않는다', leadsTo: 0 },
        ],
        rationale:
          '위치가 그대로이므로 칠하기만 다시 한다.',
      },
      {
        kind: 'misconception',
        stem: 'transform을 쓰면 언제나 합성만 다시 하는가?',
        choices: [
          { text: '아니다. 그 요소가 따로 떼어져 있지 않으면 다시 칠한다', correct: true },
          { text: '그렇다. 속성 자체가 단계를 건너뛰게 한다', leadsTo: 3 },
          { text: '그렇다. 브라우저가 항상 레이어를 만든다', leadsTo: 3 },
          { text: '아니다. transform은 배치부터 다시 한다', leadsTo: 2 },
        ],
        rationale:
          '떼어져 있으면 이미 그려 둔 것을 옮기기만 한다.',
      },
      {
        kind: 'boundary',
        stem: '반복문 안에서 크기를 물어보면 무슨 일이 생기는가?',
        choices: [
          { text: '밀린 계산을 그 자리에서 끝내야 해서 매번 다시 잰다', correct: true },
          { text: '값이 캐시돼 두 번째부터는 공짜다', leadsTo: 1 },
          { text: '읽기는 비용이 없다', leadsTo: 1 },
          { text: '브라우저가 반복문을 합쳐 처리한다', leadsTo: 4 },
        ],
        rationale:
          '읽기와 쓰기를 번갈아 하는 것이 최악이다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: '화면이 안 바뀌는데 값은 바뀌어 있는 경우가 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '상태가 바뀌었는지는 무엇으로 판단하는가?',
        choices: [
          { text: '길이가 달라졌는지', leadsTo: 0 },
          { text: '안의 값을 하나하나 견줘서', leadsTo: 0 },
          { text: '같은 것을 가리키는지', correct: true },
          { text: '마지막으로 고친 시각으로', leadsTo: 2 },
        ],
        rationale:
          '넘긴 값은 한 겹만 벗겨 견준다. 그래야 빠르기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '깊이 중첩된 곳은 안쪽만 새로 만들면 되는가?',
        choices: [
          { text: '아니다. 바깥까지 새로 만들어야 바깥을 보는 쪽이 알아챈다', correct: true },
          { text: '그렇다. 안쪽이 바뀌면 바깥도 바뀐 것으로 본다', leadsTo: 1 },
          { text: '그렇다. 어느 깊이든 하나만 갈면 된다', leadsTo: 1 },
          { text: '아니다. 아예 전부 깊이 견준다', leadsTo: 0 },
        ],
        rationale:
          '바깥을 그대로 두면 그 바깥을 보는 쪽에서는 같은 것으로 보인다.',
      },
      {
        kind: 'boundary',
        stem: '참조 비교를 쓰는 대가는?',
        choices: [
          { text: '안이 바뀌어도 겉이 같으면 못 알아챈다', correct: true },
          { text: '비교가 느려진다', leadsTo: 0 },
          { text: '메모리를 더 쓴다', leadsTo: 3 },
          { text: '대가가 없다', leadsTo: 0 },
        ],
        rationale:
          '깊이 견주면 정확하지만 값을 바꿀 때마다 전부 훑어야 한다.',
      },
    ],
  },
  {
    identityScope: 'react',
    question: 'useEffect 의존성 배열을 비워두면 언제 실행되는가?',
    items: [
      {
        kind: 'concept',
        stem: '배열 자체를 생략하면 언제 실행되는가?',
        choices: [
          { text: '언마운트 시에만', leadsTo: 3 },
          { text: '마운트 시 1회', leadsTo: 4 },
          { text: '한 번도 실행되지 않는다', leadsTo: 4 },
          { text: '매 렌더링마다', correct: true },
        ],
        rationale:
          '빈 배열은 마운트 시 1회, 값을 넣으면 그 값이 변할 때 추가로 실행된다.',
      },
      {
        kind: 'misconception',
        stem: '빈 배열인데 두 번 실행되면 버그인가?',
        choices: [
          { text: '그렇다. 의존성 배열에 값이 남아 있어 다시 실행된 것이다', leadsTo: 0 },
          { text: '아니다. 개발 모드의 Strict Mode가 일부러 두 번 실행한다', correct: true },
          { text: '그렇다. 컴포넌트가 두 번 마운트된 것이다', leadsTo: 3 },
          { text: '아니다. 빈 배열은 개발이든 운영이든 항상 두 번 실행된다', leadsTo: 4 },
        ],
        rationale:
          '정리가 제대로 되는지 보려는 개발 모드의 동작이다.',
      },
      {
        kind: 'boundary',
        stem: '함수나 객체를 의존성 배열에 넣을 때 조심할 점은?',
        choices: [
          { text: '객체를 넣으면 이펙트가 실행되지 않는다', leadsTo: 0 },
          { text: '배열에는 원시값만 넣을 수 있다', leadsTo: 0 },
          { text: '함수는 자동으로 무시된다', leadsTo: 1 },
          { text: '렌더링마다 주소값이 바뀌어 무한 루프에 빠질 수 있다', correct: true },
        ],
        rationale:
          '배열이 비어 있지 않은데도 매번 달라 보여 이펙트가 계속 다시 호출된다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '화면을 돌리면 데이터가 사라지는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '구성이 바뀌면 액티비티는 어떻게 되는가?',
        choices: [
          { text: '백그라운드로 내려간다', leadsTo: 1 },
          { text: '그대로 유지되고 화면만 다시 그린다', leadsTo: 3 },
          { text: '잠시 멈췄다가 이어서 실행된다', leadsTo: 3 },
          { text: '파괴되고 새로 만들어진다', correct: true },
        ],
        rationale:
          '가로와 세로가 다른 리소스를 쓰므로 처음부터 다시 만드는 것이 가장 확실하다.',
      },
      {
        kind: 'misconception',
        stem: 'ViewModel에 담으면 어떤 종료에도 살아남는가?',
        choices: [
          { text: '아니다. 구성 변경도 못 견딘다', leadsTo: 0 },
          { text: '그렇다. 앱을 지울 때까지 남는다', leadsTo: 1 },
          { text: '그렇다. 시스템이 따로 저장해 둔다', leadsTo: 2 },
          { text: '아니다. 프로세스가 죽으면 함께 사라진다', correct: true },
        ],
        rationale:
          '그 자리를 SavedStateHandle이 메운다.',
      },
      {
        kind: 'boundary',
        stem: 'onSaveInstanceState에 담기 좋은 것은?',
        choices: [
          { text: '오래 남겨야 하는 것', leadsTo: 0 },
          { text: '진행 중인 작업', leadsTo: 0 },
          { text: '작고 직렬화 가능한 값', correct: true },
          { text: '큰 목록 전체', leadsTo: 0 },
        ],
        rationale:
          '세 층을 가르는 축은 무엇을 견뎌야 하느냐다. 오래 남길 것은 파일이나 DB로 내린다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '푸시 알림이 안 오는 이유는 대개 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '도즈 모드에서 네트워크와 예약 작업은 어떻게 처리되는가?',
        choices: [
          { text: '일정 간격으로 몰아서 처리된다', correct: true },
          { text: '완전히 차단된다', leadsTo: 0 },
          { text: '평소보다 빠르게 처리된다', leadsTo: 0 },
          { text: '앱마다 따로 예외가 적용된다', leadsTo: 4 },
        ],
        rationale:
          '배터리를 아끼려는 설계이고 그 대가로 알림이 몇 분씩 늦을 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '급한 알림은 높은 우선순위를 항상 붙이면 되는가?',
        choices: [
          { text: '아니다. 남용하면 할당량이 깎여 오히려 더 늦어진다', correct: true },
          { text: '그렇다. 무제한으로 절전을 뚫는다', leadsTo: 1 },
          { text: '그렇다. 비용만 더 들 뿐 손해는 없다', leadsTo: 1 },
          { text: '아니다. 우선순위는 아무 효과가 없다', leadsTo: 1 },
        ],
        rationale:
          '진짜 사용자를 깨워야 하는 메시지에만 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '놓치면 안 되는 정보는 어떻게 다루는가?',
        choices: [
          { text: '전송 성공 응답을 도착으로 기록한다', leadsTo: 2 },
          { text: '같은 알림을 여러 번 보낸다', leadsTo: 2 },
          { text: '우선순위를 최고로 올린다', leadsTo: 1 },
          { text: '앱이 열릴 때 서버에서 다시 확인하는 경로를 함께 둔다', correct: true },
        ],
        rationale:
          '푸시는 최선 노력이라 유실될 수 있고, 전송 성공만으로 단말 도착을 보장하지 않는다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '앱이 백그라운드에서 죽는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '시스템이 가장 먼저 거둬가는 것은?',
        choices: [
          { text: '캐시된 상태', correct: true },
          { text: '포그라운드', leadsTo: 1 },
          { text: '보이는 상태', leadsTo: 1 },
          { text: '서비스', leadsTo: 1 },
        ],
        rationale:
          '앞에 보이는 앱을 살리는 것이 우선이라 안 보이는 프로세스부터 순서대로 거둔다.',
      },
      {
        kind: 'misconception',
        stem: '백그라운드에서 죽는 것은 고쳐야 할 사고인가?',
        choices: [
          { text: '그렇다. 메모리 누수를 잡으면 안 죽는다', leadsTo: 4 },
          { text: '아니다. 설계다. 언제 죽어도 이어지도록 만들어야 한다', correct: true },
          { text: '그렇다. 예외 처리를 넣으면 막을 수 있다', leadsTo: 0 },
          { text: '아니다. 대신 죽기 전에 알림이 온다', leadsTo: 0 },
        ],
        rationale:
          '죽을 때 알림이 없다는 점이 문제라서 화면을 떠날 때 저장해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '업로드나 동기화는 어디에 맡기는가?',
        choices: [
          { text: '메모리 부족 신호를 받고 그때 시작한다', leadsTo: 4 },
          { text: '앱 프로세스에 매달아 끝까지 붙잡는다', leadsTo: 2 },
          { text: '사용자가 앱을 열 때마다 처음부터 다시 한다', leadsTo: 2 },
          { text: '작업 관리자에 맡겨 프로세스가 죽어도 다시 실행되게 한다', correct: true },
        ],
        rationale:
          '오래 걸리는 일을 앱 프로세스에 매달면 프로세스와 함께 사라진다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '백그라운드 전환 때 어디서 자원을 해제하는가?',
    items: [
      {
        kind: 'concept',
        stem: '화면 전용 자원은 어디서 멈추는가?',
        choices: [
          { text: 'onPause', leadsTo: 1 },
          { text: 'onStop', correct: true },
          { text: 'onDestroy', leadsTo: 0 },
          { text: 'onResume', leadsTo: 1 },
        ],
        rationale:
          'onPause에는 포커스를 잃을 때 꼭 필요한 짧은 처리만 둔다.',
      },
      {
        kind: 'misconception',
        stem: 'onPause면 화면이 안 보이는 상태인가?',
        choices: [
          { text: '아니다. 멀티 윈도우나 반투명 화면 뒤로 보일 수 있다', correct: true },
          { text: '그렇다. 포커스를 잃으면 가려진 것이다', leadsTo: 1 },
          { text: '그렇다. onPause와 onStop은 같이 온다', leadsTo: 1 },
          { text: '아니다. onPause에서는 오히려 더 잘 보인다', leadsTo: 1 },
        ],
        rationale:
          '그래서 무거운 종료 작업을 onPause에 넣으면 전환이 느려진다.',
      },
      {
        kind: 'boundary',
        stem: '작은 UI 상태 저장을 onDestroy에 맡기면 왜 위험한가?',
        choices: [
          { text: '저장 순서가 뒤바뀌어서', leadsTo: 3 },
          { text: 'onDestroy가 너무 자주 불려서', leadsTo: 1 },
          { text: 'onDestroy에서는 저장 API를 쓸 수 없어서', leadsTo: 3 },
          { text: 'onStop 뒤에 프로세스가 종료될 수 있어 호출을 보장받지 못한다', correct: true },
        ],
        rationale:
          '저장 상태 API로 남겨야 프로세스가 죽어도 화면을 복원할 수 있다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '뷰 바인딩은 왜 onDestroyView에서 비우는가?',
    items: [
      {
        kind: 'concept',
        stem: 'Fragment 수명과 View 수명은 어떻게 다른가?',
        choices: [
          { text: 'Fragment가 남아도 뷰는 먼저 파괴될 수 있다', correct: true },
          { text: '둘은 항상 함께 시작하고 함께 끝난다', leadsTo: 0 },
          { text: '뷰가 Fragment보다 오래 산다', leadsTo: 0 },
          { text: 'Fragment에는 수명이 없다', leadsTo: 0 },
        ],
        rationale:
          'Fragment는 onCreate부터 onDestroy까지, 뷰는 onCreateView부터 onDestroyView까지다.',
      },
      {
        kind: 'misconception',
        stem: '바인딩을 계속 들고 있으면 재사용해서 이득인가?',
        choices: [
          { text: '그렇다. 백 스택 복원이 빨라진다', leadsTo: 3 },
          { text: '그렇다. 다시 찾는 비용을 아낀다', leadsTo: 0 },
          { text: '아니다. 폐기된 뷰가 수집되지 않고 잘못 접근할 수도 있다', correct: true },
          { text: '아니다. 대신 매번 새로 만들면 된다', leadsTo: 0 },
        ],
        rationale:
          'Fragment 필드에는 새 뷰가 생기기 전까지 뷰 참조를 남기지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '뷰를 갱신하는 관찰은 무엇에 묶는가?',
        choices: [
          { text: 'viewLifecycleOwner', correct: true },
          { text: 'Fragment 자신', leadsTo: 1 },
          { text: '액티비티', leadsTo: 1 },
          { text: '애플리케이션', leadsTo: 1 },
        ],
        rationale:
          '그러면 뷰가 파괴될 때 관찰도 멈춘다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '회전 뒤에도 남겨야 할 상태는 어디에 두는가?',
    items: [
      {
        kind: 'concept',
        stem: '구성 변경 동안 ViewModel과 저장 상태는 어떻게 다르게 동작하는가?',
        choices: [
          { text: '둘 다 값을 꺼내 새로 복원한다', leadsTo: 4 },
          { text: '둘 다 같은 인스턴스를 그대로 이어 쓴다', leadsTo: 4 },
          { text: 'ViewModel은 인스턴스를, 저장 상태는 값을 잇는다', correct: true },
          { text: 'ViewModel이 값을, 저장 상태가 인스턴스를 잇는다', leadsTo: 4 },
        ],
        rationale:
          'ViewModel은 재생성 동안 메모리 데이터를 그대로 유지한다.',
      },
      {
        kind: 'misconception',
        stem: '안전하게 하려고 목록 전체를 저장 상태에 넣어도 되는가?',
        choices: [
          { text: '아니다. 대신 ViewModel에 Bundle을 넣는다', leadsTo: 4 },
          { text: '그렇다. 클수록 복원이 정확해진다', leadsTo: 1 },
          { text: '그렇다. 용량 제한이 없다', leadsTo: 1 },
          { text: '아니다. 큰 목록이나 비즈니스 데이터는 넣지 않는다', correct: true },
        ],
        rationale:
          'ID나 검색어만 남기고 데이터 계층에서 다시 읽는다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스가 죽은 뒤 복원에 필요한 것은?',
        choices: [
          { text: '아무것도 필요 없다', leadsTo: 3 },
          { text: '화면에 그려져 있던 전체 데이터', leadsTo: 1 },
          { text: 'ViewModel 인스턴스', leadsTo: 3 },
          { text: '화면을 다시 만드는 최소 키', correct: true },
        ],
        rationale:
          '시스템이 프로세스를 죽이면 ViewModel도 사라지므로 Bundle 기반 저장 상태에서 되살린다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '화면 상태를 둘 때 두 수단을 어떻게 나누는가?',
    items: [
      {
        kind: 'concept',
        stem: '프로세스가 종료되면 두 수단은 어떻게 갈리는가?',
        choices: [
          { text: 'ViewModel도 SavedStateHandle도 저장된 값을 복원한다', leadsTo: 0 },
          { text: '둘 다 인스턴스가 사라져 값을 복원하지 못한다', leadsTo: 3 },
          { text: 'ViewModel은 사라지고 SavedStateHandle은 복원한다', correct: true },
          { text: 'SavedStateHandle은 인스턴스가 사라지고 ViewModel은 값을 복원한다', leadsTo: 0 },
        ],
        rationale:
          '구성 변경까지는 둘 다 살아남지만 프로세스 종료에서 갈린다.',
      },
      {
        kind: 'misconception',
        stem: 'SavedStateHandle이면 무엇이든 넣어도 되는가?',
        choices: [
          { text: '그렇다. 시스템이 알아서 압축한다', leadsTo: 2 },
          { text: '그렇다. 크기 제한이 없다', leadsTo: 2 },
          { text: '아니다. Bundle 기반이라 큰 객체 대신 단서만 저장한다', correct: true },
          { text: '아니다. 원시값만 넣을 수 있다', leadsTo: 0 },
        ],
        rationale:
          '항목 ID와 필터처럼 다시 데이터를 만들 단서만 넣는다.',
      },
      {
        kind: 'boundary',
        stem: '복원이 보장되지 않는 상황은?',
        choices: [
          { text: '다크 모드로 바꿨을 때', leadsTo: 3 },
          { text: '화면을 회전했을 때', leadsTo: 3 },
          { text: '강제 종료나 최근 앱에서 태스크를 지웠을 때', correct: true },
          { text: '앱을 백그라운드로 내렸을 때', leadsTo: 3 },
        ],
        rationale:
          '반드시 남아야 하는 데이터는 데이터베이스 같은 영구 저장소에 둔다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '메모리 부족 시 어떤 프로세스부터 종료되는가?',
    items: [
      {
        kind: 'concept',
        stem: '프로세스 등급은 무엇에 맞춰지는가?',
        choices: [
          { text: '가장 최근에 만들어진 컴포넌트', leadsTo: 3 },
          { text: '가장 오래 살아 있던 컴포넌트', leadsTo: 3 },
          { text: '메모리를 가장 많이 쓰는 컴포넌트', leadsTo: 2 },
          { text: '가장 중요한 활성 컴포넌트', correct: true },
        ],
        rationale:
          '중요한 클라이언트가 바인드한 서비스의 프로세스도 우선순위가 올라간다.',
      },
      {
        kind: 'misconception',
        stem: '백그라운드에 있는 동안 메모리의 싱글턴 값은 안전한가?',
        choices: [
          { text: '아니다. 대신 등급을 올리면 된다', leadsTo: 1 },
          { text: '그렇다. 프로세스가 살아 있는 한 유지된다', leadsTo: 4 },
          { text: '그렇다. 정적 필드는 시스템이 보존한다', leadsTo: 4 },
          { text: '아니다. 사라질 수 있으므로 복원 가능하게 만든다', correct: true },
        ],
        rationale:
          '백그라운드 프로세스의 수명을 전제로 설계하면 안 된다.',
      },
      {
        kind: 'boundary',
        stem: '가장 먼저 종료되는 등급은?',
        choices: [
          { text: '화면에 보이는 가시 프로세스', leadsTo: 3 },
          { text: '시작된 서비스를 수행 중인 프로세스', leadsTo: 1 },
          { text: '활성 컴포넌트가 없는 캐시', correct: true },
          { text: '포그라운드', leadsTo: 0 },
        ],
        rationale:
          '가시성과 사용자 영향이 클수록 우선순위가 높고 포그라운드가 마지막까지 보호된다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '실행 시점과 사용자 인지 여부로 어떤 수단을 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: '지연 가능하지만 반드시 끝내야 하는 일에는?',
        choices: [
          { text: '정확한 알람', leadsTo: 3 },
          { text: '포그라운드 서비스', leadsTo: 1 },
          { text: 'WorkManager', correct: true },
          { text: '일반 서비스', leadsTo: 0 },
        ],
        rationale:
          '즉시 진행하며 사용자가 알아야 하는 일이라야 포그라운드 서비스다.',
      },
      {
        kind: 'misconception',
        stem: '스레드나 일반 서비스를 띄우면 백그라운드에서 계속 도는가?',
        choices: [
          { text: '그렇다. 스레드는 제한 밖이다', leadsTo: 0 },
          { text: '그렇다. 프로세스가 살아 있으면 계속 돈다', leadsTo: 0 },
          { text: '아니다. Doze와 앱 대기가 실행을 제한한다', correct: true },
          { text: '아니다. 대신 배터리 최적화 예외를 받으면 된다', leadsTo: 4 },
        ],
        rationale:
          'Doze와 앱 대기는 네트워크와 알람을 미루고 백그라운드 서비스 실행도 제한한다.',
      },
      {
        kind: 'boundary',
        stem: '정확한 알람은 어디에 쓰는가?',
        choices: [
          { text: '실패한 업로드 재시도', leadsTo: 2 },
          { text: '일반 동기화', leadsTo: 3 },
          { text: '정확한 시각이 핵심인 사용자 기능', correct: true },
          { text: '주기적인 캐시 정리', leadsTo: 0 },
        ],
        rationale:
          '정확한 알람은 권한과 용도 제한이 있어 일반 동기화에 쓰지 않는다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '예약한 작업은 정말 한 번만 실행되는가?',
    items: [
      {
        kind: 'concept',
        stem: 'WorkManager가 보장하는 것과 보장하지 않는 것은?',
        choices: [
          { text: '재부팅 뒤에도 다시 예약하지만 정확한 시작 시각은 보장하지 않는다', correct: true },
          { text: '정확한 시작 시각까지 보장한다', leadsTo: 3 },
          { text: '프로세스가 죽으면 예약도 사라진다', leadsTo: 2 },
          { text: '한 번 실행되면 재시도하지 않는다', leadsTo: 1 },
        ],
        rationale:
          '조건이 맞은 뒤 실행되도록 영속적으로 예약한다.',
      },
      {
        kind: 'misconception',
        stem: '예약했으니 Worker는 정확히 한 번만 도는가?',
        choices: [
          { text: '아니다. 항상 두 번 돈다', leadsTo: 1 },
          { text: '그렇다. 고유 작업으로 예약하면 한 번이다', leadsTo: 0 },
          { text: '그렇다. 성공하면 다시 돌지 않는다', leadsTo: 2 },
          { text: '아니다. 재시도와 중단 때문에 여러 번 시작될 수 있다', correct: true },
        ],
        rationale:
          '외부 부수 효과는 멱등하게 만들어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '실행이 중단돼도 결과를 일관되게 만들려면?',
        choices: [
          { text: '서버 요청에 멱등성 키를 넣고 로컬 갱신은 트랜잭션으로 묶는다', correct: true },
          { text: '재시도 횟수를 1로 제한한다', leadsTo: 1 },
          { text: '실패하면 즉시 다시 예약한다', leadsTo: 2 },
          { text: '작업을 포그라운드로 올린다', leadsTo: 3 },
        ],
        rationale:
          '고유 작업은 중복 예약을 줄이지만 중단 자체를 없애지는 못한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '비동기로 옮겼는데도 왜 응답 없음이 생기는가?',
    items: [
      {
        kind: 'concept',
        stem: '메인 스레드가 직렬로 처리하는 것은?',
        choices: [
          { text: '입력과 생명주기 콜백과 화면 갱신', correct: true },
          { text: '네트워크 응답만', leadsTo: 1 },
          { text: '디스크 접근만', leadsTo: 1 },
          { text: '화면 갱신만', leadsTo: 4 },
        ],
        rationale:
          '입력 이벤트에 약 5초간 응답하지 못하면 입력 디스패치 ANR이 날 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '작업을 다른 스레드로 보냈으면 안전한가?',
        choices: [
          { text: '그렇다. 잠금은 메인과 무관하다', leadsTo: 2 },
          { text: '그렇다. 옮긴 순간 메인은 자유롭다', leadsTo: 1 },
          { text: '아니다. 메인 스레드가 결과나 잠금을 기다리면 막힌다', correct: true },
          { text: '아니다. 스레드를 옮기면 오히려 느려진다', leadsTo: 3 },
        ],
        rationale:
          '느린 Binder 호출과 과도한 그리기도 입력 처리를 지연시킨다.',
      },
      {
        kind: 'boundary',
        stem: '원인을 찾을 때 어디를 보는가?',
        choices: [
          { text: '스택 덤프의 main 대기 지점과 잠금 보유 스레드', correct: true },
          { text: '메모리 사용량 그래프', leadsTo: 4 },
          { text: '네트워크 응답 시간만', leadsTo: 3 },
          { text: '화면 프레임 수만', leadsTo: 4 },
        ],
        rationale:
          'StrictMode와 Perfetto로 I/O와 느린 Binder 호출도 확인한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '화면이 닫혔는데 객체가 남는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '객체가 수집되지 않는 조건은?',
        choices: [
          { text: 'GC Root에서 도달 가능할 때', correct: true },
          { text: '메모리가 충분할 때', leadsTo: 4 },
          { text: '참조 횟수가 0이 아닐 때', leadsTo: 4 },
          { text: '화면이 아직 그려져 있을 때', leadsTo: 0 },
        ],
        rationale:
          '정적 필드나 실행 중 스레드가 GC Root가 되어 화면 객체를 붙잡는다.',
      },
      {
        kind: 'misconception',
        stem: 'ViewModel에 Activity 참조를 두면 편한가?',
        choices: [
          { text: '그렇다. 수명이 같아 문제없다', leadsTo: 2 },
          { text: '아니다. 화면보다 오래 살아 누수가 된다', correct: true },
          { text: '그렇다. 구성 변경 때 함께 정리된다', leadsTo: 2 },
          { text: '아니다. 대신 View 참조는 괜찮다', leadsTo: 0 },
        ],
        rationale:
          'UI가 필요 없는 객체에는 Application Context를 사용한다.',
      },
      {
        kind: 'boundary',
        stem: '고쳤는지 어떻게 확인하는가?',
        choices: [
          { text: '수집을 강제로 호출해 본다', leadsTo: 4 },
          { text: '앱을 재시작해 메모리가 줄었는지 본다', leadsTo: 4 },
          { text: '같은 화면을 반복 열고 보유 개수가 줄어드는지 본다', correct: true },
          { text: '화면이 정상 동작하면 된 것이다', leadsTo: 4 },
        ],
        rationale:
          '힙 덤프에서 누수 객체의 GC Root 경로를 따라가 지배 참조를 끊은 뒤 확인한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '전송 성공은 단말 수신까지 뜻하는가?',
    items: [
      {
        kind: 'concept',
        stem: '서버가 받은 메시지 ID는 무엇을 뜻하는가?',
        choices: [
          { text: '앱이 메시지를 처리했다는 것', leadsTo: 4 },
          { text: '단말이 메시지를 받았다는 것', leadsTo: 4 },
          { text: 'FCM이 전달 요청을 접수했다는 것', correct: true },
          { text: '사용자가 알림을 봤다는 것', leadsTo: 4 },
        ],
        rationale:
          '단말 도착이나 앱 처리를 보장하지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '접수된 메시지는 언젠가는 반드시 도착하는가?',
        choices: [
          { text: '그렇다. 도착할 때까지 재시도가 무한히 이어진다', leadsTo: 0 },
          { text: '그렇다. 연결이 열리면 밀린 것이 모두 온다', leadsTo: 0 },
          { text: '아니다. TTL이 지나거나 collapse key가 겹치면 버려진다', correct: true },
          { text: '아니다. 오프라인이면 재시도 없이 즉시 실패로 끝난다', leadsTo: 0 },
        ],
        rationale:
          '오프라인과 Doze와 토큰 만료 때문에 지연되거나 유실될 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '업무상 전달 확인이 필요하면 어떻게 하는가?',
        choices: [
          { text: '높은 우선순위로 올려 즉시 전달시킨다', leadsTo: 2 },
          { text: '같은 메시지를 여러 번 보내 도착 확률을 올린다', leadsTo: 4 },
          { text: '앱이 처리 ACK를 보내고 서버가 중복을 제거한다', correct: true },
          { text: '접수 응답을 도착으로 기록한다', leadsTo: 4 },
        ],
        rationale:
          '누락되면 원본 데이터를 다시 동기화한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '재사용 셀에 이전 데이터가 비치는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: 'onBindViewHolder에서 무엇을 해야 하는가?',
        choices: [
          { text: '이전 값을 지우고 비워 둔다', leadsTo: 0 },
          { text: '달라진 속성만 골라 바꾼다', leadsTo: 3 },
          { text: '새 항목의 모든 가변 속성을 덮어쓴다', correct: true },
          { text: 'ViewHolder를 새로 만든다', leadsTo: 4 },
        ],
        rationale:
          '덮어쓰지 않으면 이전 항목의 가시성이나 체크 상태와 이미지가 남는다.',
      },
      {
        kind: 'misconception',
        stem: 'DiffUtil과 stable ID를 붙이면 재사용 문제가 해결되는가?',
        choices: [
          { text: '아니다. 오히려 바인딩을 건너뛰게 한다', leadsTo: 3 },
          { text: '그렇다. 변경 계산이 상태까지 맞춰 준다', leadsTo: 0 },
          { text: '그렇다. 재사용 자체를 막아 준다', leadsTo: 4 },
          { text: '아니다. 올바른 바인딩을 대신하지 않는다', correct: true },
        ],
        rationale:
          '잘못된 ID는 화면 상태를 엉뚱한 항목에 붙인다.',
      },
      {
        kind: 'boundary',
        stem: '클릭 처리에서 위치를 어떻게 다루는가?',
        choices: [
          { text: '실행 시점의 bindingAdapterPosition을 확인한다', correct: true },
          { text: '바인딩 때 받은 position을 저장해 쓴다', leadsTo: 2 },
          { text: '리스너를 한 번만 붙이고 위치는 고정한다', leadsTo: 2 },
          { text: '위치 대신 화면 좌표로 항목을 찾아 쓴다', leadsTo: 2 },
        ],
        rationale:
          '바인딩 시점과 클릭 시점 사이에 목록이 바뀔 수 있다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '상태 변경은 어디까지 다시 실행되는가?',
    items: [
      {
        kind: 'concept',
        stem: '다시 실행되는 범위는 무엇으로 정해지는가?',
        choices: [
          { text: '가장 바깥 컴포저블만', leadsTo: 0 },
          { text: '화면 전체', leadsTo: 0 },
          { text: '상태를 선언한 곳부터 아래 전부', leadsTo: 0 },
          { text: '변경된 State를 읽은 재시작 범위', correct: true },
        ],
        rationale:
          '그 아래에서도 입력이 바뀌지 않은 스킵 가능 컴포저블은 건너뛴다.',
      },
      {
        kind: 'misconception',
        stem: '일반 mutable 객체의 필드를 바꾸면 화면이 갱신되는가?',
        choices: [
          { text: '아니다. Compose가 변화를 알지 못한다', correct: true },
          { text: '그렇다. 값이 바뀌면 다시 그린다', leadsTo: 0 },
          { text: '그렇다. 다음 프레임에 반영된다', leadsTo: 0 },
          { text: '아니다. 대신 remember를 붙이면 된다', leadsTo: 1 },
        ],
        rationale:
          'MutableState로 바꾸거나 Flow를 collectAsState 계열로 수집해야 갱신이 예약된다.',
      },
      {
        kind: 'boundary',
        stem: '부수 효과를 컴포저블 본문에 직접 두면 왜 안 되는가?',
        choices: [
          { text: '한 번도 실행되지 않는다', leadsTo: 4 },
          { text: '컴파일되지 않는다', leadsTo: 4 },
          { text: '재실행이나 취소 순서가 깨진다', correct: true },
          { text: '성능만 조금 나빠진다', leadsTo: 4 },
        ],
        rationale:
          'LaunchedEffect와 DisposableEffect에 둬야 한다.',
      },
    ],
  },
  {
    identityScope: 'kotlin',
    question: '부모 작업이 취소되면 자식은 어떻게 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '부모는 언제 완료되는가?',
        choices: [
          { text: '첫 자식이 끝나면 완료된다', leadsTo: 0 },
          { text: '본문이 끝나면 즉시 완료된다', leadsTo: 3 },
          { text: '모든 자식이 끝나야 완료된다', correct: true },
          { text: '자식과 무관하게 완료된다', leadsTo: 3 },
        ],
        rationale:
          '이 규칙 덕분에 호출 범위를 벗어난 작업이 남지 않는다.',
      },
      {
        kind: 'misconception',
        stem: 'SupervisorJob을 쓰면 부모 취소도 자식에게 안 가는가?',
        choices: [
          { text: '그렇다. 자식이 부모보다 오래 남는다', leadsTo: 3 },
          { text: '그렇다. 자식이 부모와 분리된다', leadsTo: 0 },
          { text: '아니다. 부모 취소는 여전히 모든 자식에게 전파된다', correct: true },
          { text: '아니다. 실패 격리도 되지 않는다', leadsTo: 0 },
        ],
        rationale:
          'SupervisorJob이 격리하는 것은 자식 하나의 실패다.',
      },
      {
        kind: 'boundary',
        stem: '취소와 실패는 어느 방향으로 흐르는가?',
        choices: [
          { text: '취소는 아래로, 실패는 위로 전파된다', correct: true },
          { text: '둘 다 아래로만 간다', leadsTo: 0 },
          { text: '둘 다 위로만 간다', leadsTo: 1 },
          { text: '방향 없이 형제끼리만 퍼진다', leadsTo: 0 },
        ],
        rationale:
          '일반 Job이면 자식의 실패가 형제 자식까지 함께 취소시킨다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '권한을 한 번 받으면 계속 쓸 수 있는가?',
    items: [
      {
        kind: 'concept',
        stem: '매니페스트 선언만으로 붙는 권한은?',
        choices: [
          { text: '위험 권한', leadsTo: 2 },
          { text: '일반 권한', correct: true },
          { text: '다른 앱 위에 그리기 같은 특수 권한', leadsTo: 2 },
          { text: '모든 권한', leadsTo: 0 },
        ],
        rationale:
          '위험 권한은 실행 중에 묻고, 특수 권한은 설정 화면에서 따로 받는다.',
      },
      {
        kind: 'misconception',
        stem: '한 번 허용받았으면 다음부터는 확인 없이 써도 되는가?',
        choices: [
          { text: '그렇다. 앱을 지우기 전까지 유지된다', leadsTo: 1 },
          { text: '아니다. 철회와 일회성 권한과 자동 초기화가 있다', correct: true },
          { text: '그렇다. 시스템이 바뀌면 알려 준다', leadsTo: 0 },
          { text: '아니다. 매번 다시 물어야 한다', leadsTo: 2 },
        ],
        rationale:
          '보호 기능을 쓰기 직전에 상태를 다시 확인해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '권한 요청을 줄이는 가장 좋은 방법은?',
        choices: [
          { text: '앱 시작 때 필요한 권한을 한꺼번에 묻는다', leadsTo: 2 },
          { text: '사진 선택기처럼 권한 없이 목적을 달성하는 시스템 기능을 쓴다', correct: true },
          { text: '거부되면 기능을 막고 다시 묻는다', leadsTo: 2 },
          { text: '설정 화면으로 바로 보낸다', leadsTo: 2 },
        ],
        rationale:
          '권한 범위가 줄수록 개인정보 위험과 심사 부담도 줄어든다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '첫 화면을 빠르게 띄우려면 무엇을 미뤄야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '콜드 시작은 무엇부터 무엇까지 재는가?',
        choices: [
          { text: '모든 데이터가 로드될 때까지', leadsTo: 2 },
          { text: '화면이 만들어진 뒤부터 첫 프레임까지', leadsTo: 0 },
          { text: '사용자가 조작할 수 있을 때까지', leadsTo: 2 },
          { text: '시작 요청부터 첫 프레임까지이며 프로세스 초기화도 포함한다', correct: true },
        ],
        rationale:
          '웜 시작과 핫 시작은 재사용 자원이 달라 같은 수치로 섞으면 병목을 잘못 판단한다.',
      },
      {
        kind: 'misconception',
        stem: '초기화를 전부 지연시키면 시작이 빨라지는가?',
        choices: [
          { text: '아니다. 지연 초기화는 효과가 없다', leadsTo: 1 },
          { text: '그렇다. 미룰수록 항상 이득이다', leadsTo: 0 },
          { text: '그렇다. 백그라운드로 보내면 비용이 사라진다', leadsTo: 1 },
          { text: '아니다. 사용 직전에 몰리면 끊김이 생긴다', correct: true },
        ],
        rationale:
          '기능 우선순위와 의존성을 정하고 실제 기기에서 첫 표시와 완전 표시를 함께 측정한다.',
      },
      {
        kind: 'boundary',
        stem: '시작 추적에서 무엇을 찾는가?',
        choices: [
          { text: '전체 메모리 사용량', leadsTo: 1 },
          { text: '메인 스레드의 디스크 접근과 클래스 로딩', correct: true },
          { text: '네트워크 응답 시간만', leadsTo: 0 },
          { text: '화면 애니메이션 프레임', leadsTo: 2 },
        ],
        rationale:
          'Baseline Profile은 자주 쓰는 코드의 해석과 컴파일 비용을 줄인다.',
      },
    ],
  },
  {
    identityScope: 'ios',
    question: '앱이 백그라운드로 가면 무엇을 중단해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'active에서 inactive로 바뀌면 무엇을 멈추는가?',
        choices: [
          { text: '저장소 기록', leadsTo: 2 },
          { text: '모든 네트워크 요청', leadsTo: 1 },
          { text: '상호작용과 화면 갱신', correct: true },
          { text: '아무것도 멈추지 않는다', leadsTo: 3 },
        ],
        rationale:
          'background로 바뀌면 카메라와 타이머 같은 자원을 놓고 복구할 상태를 기록한다.',
      },
      {
        kind: 'misconception',
        stem: '종료 콜백에 저장을 맡겨도 되는가?',
        choices: [
          { text: '아니다. 백그라운드에서 프로세스가 예고 없이 종료될 수 있다', correct: true },
          { text: '그렇다. 종료 전에 항상 불린다', leadsTo: 4 },
          { text: '그렇다. 시스템이 저장 시간을 보장한다', leadsTo: 1 },
          { text: '아니다. 대신 실행 중에는 저장하면 안 된다', leadsTo: 2 },
        ],
        rationale:
          '중요한 변경 시점마다 내구성 있게 기록해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '백그라운드에서 계속 실행할 작업은 어떻게 다루는가?',
        choices: [
          { text: '예약해 두면 그 시각에 반드시 실행된다', leadsTo: 1 },
          { text: '스레드를 띄워 두면 계속 돈다', leadsTo: 1 },
          { text: '목적에 맞는 백그라운드 API로 요청하고 허용 시간은 시스템이 정한다', correct: true },
          { text: '백그라운드에서는 아무 작업도 못 한다', leadsTo: 1 },
        ],
        rationale:
          '예약 작업은 실행 시점과 호출 여부도 보장되지 않는다.',
      },
    ],
  },
  {
    identityScope: 'swift',
    question: '자동 참조 계산인데 왜 메모리가 남는가?',
    items: [
      {
        kind: 'concept',
        stem: '강한 참조 고리에서 무슨 일이 벌어지는가?',
        choices: [
          { text: '참조 수가 음수가 된다', leadsTo: 4 },
          { text: '각 객체의 참조 수가 0이 되지 않는다', correct: true },
          { text: '수집기가 고리를 따로 찾아 해제한다', leadsTo: 4 },
          { text: '외부 소유자가 놓으면 함께 사라진다', leadsTo: 0 },
        ],
        rationale:
          '외부 소유자가 놓아도 서로를 붙잡고 있어 남는다.',
      },
      {
        kind: 'misconception',
        stem: '순환이 걱정되면 weak를 넉넉히 붙이면 되는가?',
        choices: [
          { text: '아니다. 대신 unowned를 넉넉히 붙인다', leadsTo: 0 },
          { text: '그렇다. weak는 부작용이 없다', leadsTo: 0 },
          { text: '그렇다. unowned보다 항상 안전하다', leadsTo: 0 },
          { text: '아니다. 작업 중 객체가 사라지는 다른 버그를 만들 수 있다', correct: true },
        ],
        rationale:
          'unowned는 대상이 먼저 사라지지 않는다는 수명 보장이 있을 때만 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '클로저가 고리를 만드는 조건은?',
        choices: [
          { text: '나중에 비동기로 실행되는 클로저일 때만', leadsTo: 3 },
          { text: '클로저를 쓰기만 하면 언제나', leadsTo: 1 },
          { text: 'self를 강하게 캡처하고 self가 그것을 보관할 때', correct: true },
          { text: '캡처 목록을 명시해 값을 붙잡을 때만', leadsTo: 1 },
        ],
        rationale:
          '캡처 목록은 수명과 비동기 실행 시점을 따져 정한다.',
      },
    ],
  },
  {
    identityScope: 'swiftui',
    question: '상태 소유자를 잘못 두면 어떤 버그가 생기는가?',
    items: [
      {
        kind: 'concept',
        stem: '하위 뷰가 같은 값을 편집해야 하면 무엇을 넘기는가?',
        choices: [
          { text: '값의 복사본', leadsTo: 0 },
          { text: 'Binding', correct: true },
          { text: '새 State', leadsTo: 0 },
          { text: 'Environment 주입', leadsTo: 2 },
        ],
        rationale:
          '작은 값은 가장 가까운 뷰가 State로 소유하고 변경 통로만 아래로 준다.',
      },
      {
        kind: 'misconception',
        stem: 'ObservableObject 모델은 어디서든 ObservedObject로 받으면 되는가?',
        choices: [
          { text: '그렇다. ObservedObject가 더 안전하다', leadsTo: 1 },
          { text: '그렇다. 둘은 같은 것이다', leadsTo: 1 },
          { text: '아니다. 뷰가 만들고 유지하는 모델은 StateObject를 쓴다', correct: true },
          { text: '아니다. 외부에서 받은 모델도 StateObject로 받는다', leadsTo: 1 },
        ],
        rationale:
          '외부에서 받은 모델은 ObservedObject로 관찰해 소유와 관찰을 분리한다.',
      },
      {
        kind: 'boundary',
        stem: 'Environment로 넓게 주입하는 대가는?',
        choices: [
          { text: '갱신이 느려진다', leadsTo: 3 },
          { text: '데이터 흐름과 테스트 의존성이 숨는다', correct: true },
          { text: '값이 복사되어 어긋난다', leadsTo: 0 },
          { text: '대가가 없다', leadsTo: 2 },
        ],
        rationale:
          '편리하더라도 범위를 넓히면 무엇이 어디서 오는지 보이지 않는다.',
      },
    ],
  },
  {
    identityScope: 'mobile',
    question: '오프라인 수정이 서버 값과 충돌하면 누가 이기는가?',
    items: [
      {
        kind: 'concept',
        stem: '마지막 쓰기 승리의 대가는?',
        choices: [
          { text: '데이터 손실을 숨기기 쉽다', correct: true },
          { text: '구현이 복잡하다', leadsTo: 2 },
          { text: '충돌을 사용자에게 드러낸다', leadsTo: 2 },
          { text: '오프라인 읽기가 막힌다', leadsTo: 0 },
        ],
        rationale:
          '버전 기반 병합은 복잡한 대신 충돌을 드러낸다.',
      },
      {
        kind: 'misconception',
        stem: '한 가지 충돌 정책을 앱 전체에 적용하면 되는가?',
        choices: [
          { text: '아니다. 데이터 의미와 되돌릴 수 있는지를 기준으로 정한다', correct: true },
          { text: '그렇다. 일관성이 가장 중요하다', leadsTo: 2 },
          { text: '그렇다. 서버 값을 항상 따르면 된다', leadsTo: 2 },
          { text: '아니다. 항상 사용자에게 물어야 한다', leadsTo: 3 },
        ],
        rationale:
          '장바구니는 항목 병합이 가능하지만 결제 상태는 서버 권위가 필요하다.',
      },
      {
        kind: 'boundary',
        stem: '재전송에 멱등 키와 서버 버전을 함께 쓰는 이유는?',
        choices: [
          { text: '연결이 끊긴 동안에도 로컬에서 읽을 수 있게 하려고', leadsTo: 0 },
          { text: '같은 요청을 병렬로 보내 전송 속도를 높이려고', leadsTo: 1 },
          { text: '여러 요청이 보낸 순서대로 반영되게 하려고', leadsTo: 1 },
          { text: '성공 응답을 잃어도 중복 반영을 막는다', correct: true },
        ],
        rationale:
          '변경은 outbox에 기록해 연결이 돌아왔을 때 순서대로 보낸다.',
      },
    ],
  },
  {
    identityScope: 'mobile',
    question: '외부 링크를 곧바로 화면에 열어도 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '링크를 받은 뒤 화면에 넘기기 전 순서는?',
        choices: [
          { text: '스킴과 호스트, 세션과 권한을 본 뒤 넘긴다', correct: true },
          { text: '화면을 먼저 열고 그 안에서 권한을 본다', leadsTo: 4 },
          { text: '로그인 세션만 확인하면 나머지는 충분하다', leadsTo: 4 },
          { text: '등록한 스킴만 맞으면 그대로 화면에 넘긴다', leadsTo: 4 },
        ],
        rationale:
          '허용 목록으로 스킴과 호스트와 경로를 검증한다.',
      },
      {
        kind: 'misconception',
        stem: '커스텀 스킴을 쓰면 우리 앱만 그 링크를 받는가?',
        choices: [
          { text: '아니다. 대신 사용자가 매번 고른다', leadsTo: 0 },
          { text: '그렇다. 스킴은 앱마다 고유하다', leadsTo: 3 },
          { text: '그렇다. 스토어가 중복을 막는다', leadsTo: 3 },
          { text: '아니다. 다른 앱이 선점할 수 있다', correct: true },
        ],
        rationale:
          'Android App Links와 iOS Universal Links는 도메인 소유를 검증해 탈취 위험을 줄인다.',
      },
      {
        kind: 'boundary',
        stem: '링크가 다른 웹 주소로 다시 보내는 값을 담고 있으면?',
        choices: [
          { text: '대상 도메인을 제한해 오픈 리다이렉트를 막는다', correct: true },
          { text: '인코딩만 풀어 그대로 넘긴다', leadsTo: 4 },
          { text: '로그인 상태만 확인하면 된다', leadsTo: 1 },
          { text: '중복 파라미터를 그대로 둔다', leadsTo: 4 },
        ],
        rationale:
          '인코딩과 중복 파라미터를 정규화한 뒤 검증한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '설치 크기를 줄이면 실행 시 무엇을 치르는가?',
    items: [
      {
        kind: 'concept',
        stem: 'App Bundle은 무엇인가?',
        choices: [
          { text: '필요할 때 기능 모듈을 내려받는 방식이다', leadsTo: 3 },
          { text: '기기에 그대로 설치되는 파일이다', leadsTo: 0 },
          { text: '게시 형식이며 스토어가 분할 APK를 만든다', correct: true },
          { text: '자원을 더 세게 압축하는 방식이다', leadsTo: 2 },
        ],
        rationale:
          '사용자가 모든 언어와 밀도 자원을 받을 필요가 없어진다.',
      },
      {
        kind: 'misconception',
        stem: '기능을 주문형으로 많이 빼면 체감이 좋아지는가?',
        choices: [
          { text: '아니다. 주문형은 쓸 일이 없다', leadsTo: 0 },
          { text: '그렇다. 설치가 작을수록 항상 빠르다', leadsTo: 3 },
          { text: '그렇다. 다운로드는 배경에서 끝난다', leadsTo: 1 },
          { text: '아니다. 첫 여정에 필요한 기능을 빼면 오히려 시작이 느려진다', correct: true },
        ],
        rationale:
          '초기 설치는 작아지지만 실행 중 다운로드 지연과 실패를 감수한다.',
      },
      {
        kind: 'boundary',
        stem: '기능 모듈을 쓰면 늘어나는 것은?',
        choices: [
          { text: '자원 중복', leadsTo: 2 },
          { text: '기본 모듈의 크기', leadsTo: 3 },
          { text: '기능 부재 상태와 네트워크 오류를 처리하는 코드', correct: true },
          { text: '아무것도 늘지 않는다', leadsTo: 1 },
        ],
        rationale:
          '다운로드 진행과 취소와 재시도 화면도 준비해야 한다.',
      },
    ],
  },
  {
    identityScope: 'mobile',
    question: '모바일 요청은 실패할 때마다 다시 보내도 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '재시도 후보가 되는 응답은?',
        choices: [
          { text: '타임아웃과 일부 5xx와 429', correct: true },
          { text: '대부분의 4xx', leadsTo: 2 },
          { text: '사용자 취소', leadsTo: 2 },
          { text: '모든 오류', leadsTo: 2 },
        ],
        rationale:
          '상태 코드만 보지 말고 API 계약과 Retry-After를 따른다.',
      },
      {
        kind: 'misconception',
        stem: '백오프만 걸면 재시도가 안전한가?',
        choices: [
          { text: '그렇다. 간격만 늘리면 충분하다', leadsTo: 1 },
          { text: '아니다. 지터가 없으면 동시에 깨어 다시 몰린다', correct: true },
          { text: '그렇다. 지터는 평균 지연만 늘릴 뿐이다', leadsTo: 1 },
          { text: '아니다. 백오프 자체가 필요 없다', leadsTo: 1 },
        ],
        rationale:
          '지수 백오프는 간격을 늘리고 지터는 재시도 폭주를 흩는다.',
      },
      {
        kind: 'boundary',
        stem: '꼭 전달해야 하는 작업은 어디에 두는가?',
        choices: [
          { text: '횟수 제한 없이 계속 재시도한다', leadsTo: 4 },
          { text: '메모리에 두고 앱이 살아 있는 동안 재시도한다', leadsTo: 4 },
          { text: '실패하면 사용자에게 다시 누르게 한다', leadsTo: 3 },
          { text: '영속 큐에 넣고 최대 횟수와 만료 시점을 둔다', correct: true },
        ],
        rationale:
          '앱이 백그라운드로 가거나 연결이 바뀌면 예약을 다시 판단한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '백그라운드 제약을 피하는 방법은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '포그라운드 서비스가 오래 사는 이유는?',
        choices: [
          { text: '메모리를 미리 확보해 둔다', leadsTo: 3 },
          { text: '시스템이 종료하지 못하도록 잠근다', leadsTo: 2 },
          { text: '알림이 떠 있어 시스템이 중요도를 높게 보고 종료 우선순위를 늦춘다', correct: true },
          { text: '별도 프로세스로 분리되기 때문이다', leadsTo: 2 },
        ],
        rationale:
          '사용자에게 앱이 동작 중임을 알리는 대가로 얻는 우선순위다.',
      },
      {
        kind: 'misconception',
        stem: '이 둘을 쓰면 앱이 죽지 않는가?',
        choices: [
          { text: '아니다. 둘 다 강제 종료를 막지는 못한다', correct: true },
          { text: '그렇다. 포그라운드 서비스는 종료되지 않는다', leadsTo: 2 },
          { text: '그렇다. WorkManager가 프로세스를 살려 둔다', leadsTo: 1 },
          { text: '아니다. 대신 배터리 최적화 예외를 받으면 된다', leadsTo: 0 },
        ],
        rationale:
          'WorkManager는 끊겨도 조건이 맞을 때 다시 돌도록 예약할 뿐이다.',
      },
      {
        kind: 'boundary',
        stem: 'Android 14 이상에서 API 34를 겨냥한 앱이 지켜야 할 것은?',
        choices: [
          { text: '포그라운드 서비스를 하나만 둬야 한다', leadsTo: 4 },
          { text: '포그라운드 서비스마다 타입을 적어야 한다', correct: true },
          { text: '알림을 숨겨야 한다', leadsTo: 2 },
          { text: 'WorkManager로만 실행해야 한다', leadsTo: 1 },
        ],
        rationale:
          '타입을 명시하지 않거나 부적절한 타입을 쓰면 앱이 비정상 종료된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '푸시 알림의 전달 보장을 위해 무엇을 설계하는가?',
    items: [
      {
        kind: 'concept',
        stem: '플랫폼이 성공으로 응답하는 시점은?',
        choices: [
          { text: '단말기가 받았을 때', leadsTo: 2 },
          { text: '메시지를 큐에 넣었을 때', correct: true },
          { text: '사용자가 알림을 열었을 때', leadsTo: 2 },
          { text: '앱이 처리를 끝냈을 때', leadsTo: 2 },
        ],
        rationale:
          '그래서 응답만으로는 실제 단말기 도달 여부를 알 수 없다.',
      },
      {
        kind: 'misconception',
        stem: '재시도만 붙이면 전달이 보장되는가?',
        choices: [
          { text: '아니다. 단말이 수신 확인을 보내야 누락을 안다', correct: true },
          { text: '그렇다. 실패 응답만 보고 다시 보내면 된다', leadsTo: 1 },
          { text: '그렇다. 백오프를 붙이면 결국 도착한다', leadsTo: 1 },
          { text: '아니다. 재시도가 오히려 중복만 늘린다', leadsTo: 3 },
        ],
        rationale:
          '수신 확인이 없으면 누락된 알림을 다시 보낼 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '재시도가 만드는 부작용은 무엇으로 막는가?',
        choices: [
          { text: '알림을 무음으로 보낸다', leadsTo: 4 },
          { text: '재시도 횟수를 1로 줄인다', leadsTo: 1 },
          { text: '메시지 ID로 중복 수신을 막는 멱등성 처리', correct: true },
          { text: '수신 확인을 생략한다', leadsTo: 2 },
        ],
        rationale:
          '네트워크가 불안정하면 같은 알림이 여러 번 뜰 수 있다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '안드로이드 메인 스레드에서 무거운 작업을 하면 왜 ANR이 발생하는가?',
    items: [
      {
        kind: 'concept',
        stem: '메인 스레드 하나가 전담하는 일은?',
        choices: [
          { text: '메모리 회수', leadsTo: 4 },
          { text: '네트워크 요청과 DB 조회', leadsTo: 1 },
          { text: 'UI 갱신과 사용자 입력 처리', correct: true },
          { text: '알림 표시', leadsTo: 0 },
        ],
        rationale:
          '여기서 무거운 작업을 하면 큐에 쌓인 다음 이벤트를 처리하지 못한다.',
      },
      {
        kind: 'misconception',
        stem: 'ANR이 뜬 순간 메인 스레드는 멈춰 있는가?',
        choices: [
          { text: '그렇다. 스레드가 정지된 것이다', leadsTo: 4 },
          { text: '아니다. 여전히 작업 중이지만 인터랙션이 불가능한 상태다', correct: true },
          { text: '그렇다. 시스템이 스레드를 강제로 끊는다', leadsTo: 0 },
          { text: '아니다. 이미 종료된 상태다', leadsTo: 4 },
        ],
        rationale:
          '입력을 5초쯤 처리하지 못하면 ANR로 본다.',
      },
      {
        kind: 'boundary',
        stem: '기준 시간은 모든 경우에 같은가?',
        choices: [
          { text: '아니다. 브로드캐스트나 서비스는 따로 있다', correct: true },
          { text: '그렇다. 어디서나 5초다', leadsTo: 0 },
          { text: '그렇다. 기기 성능에 따라 자동 조정된다', leadsTo: 0 },
          { text: '아니다. 기준 시간 자체가 없다', leadsTo: 0 },
        ],
        rationale:
          '오래 걸리는 작업은 Worker 스레드나 Coroutine으로 분리해야 한다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '안드로이드에서 메모리 누수가 발생하는 주원인은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '익명 클래스나 내부 클래스가 위험한 이유는?',
        choices: [
          { text: '가비지 컬렉터가 인식하지 못한다', leadsTo: 0 },
          { text: '메모리를 두 배로 쓴다', leadsTo: 4 },
          { text: '외부 클래스에 대한 숨은 참조를 가진다', correct: true },
          { text: '생명주기 콜백을 가로챈다', leadsTo: 3 },
        ],
        rationale:
          '내부 클래스가 살아 있으면 파괴된 Activity도 사슬에 매달려 남는다.',
      },
      {
        kind: 'misconception',
        stem: '누수가 걱정되면 약한 참조부터 쓰면 되는가?',
        choices: [
          { text: '그렇다. 약한 참조가 근본 해결이다', leadsTo: 0 },
          { text: '아니다. 먼저 오래 사는 작업과 콜백을 수명에 맞춰 끊는다', correct: true },
          { text: '그렇다. 모든 참조를 약하게 두면 된다', leadsTo: 0 },
          { text: '아니다. 정적 변수에 담으면 해결된다', leadsTo: 2 },
        ],
        rationale:
          '그래도 남는 자리에만 정적 중첩 클래스나 약한 참조를 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '핸들러나 비동기 작업이 특히 위험한 때는?',
        choices: [
          { text: '메인 스레드에서 실행될 때', leadsTo: 3 },
          { text: '동시에 여러 개 실행될 때', leadsTo: 4 },
          { text: 'Activity보다 오래 실행될 때', correct: true },
          { text: '결과를 반환하지 않을 때', leadsTo: 3 },
        ],
        rationale:
          '작업이 끝나기 전까지 Activity 참조를 붙잡고 있다.',
      },
    ],
  },
  {
    identityScope: 'android',
    question: '코루틴의 구조적 동시성은 무엇을 해결하는가?',
    items: [
      {
        kind: 'concept',
        stem: '보통의 Job 아래에서 자식이 실패하면?',
        choices: [
          { text: '아무 일도 일어나지 않는다', leadsTo: 2 },
          { text: '그 자식만 끝나고 형제는 계속 돈다', leadsTo: 0 },
          { text: '부모가 대신 재시도한다', leadsTo: 2 },
          { text: '예외가 부모로 올라가 형제까지 취소된다', correct: true },
        ],
        rationale:
          'supervisorScope 아래에서라야 그 자식만 실패하고 형제가 계속 돈다.',
      },
      {
        kind: 'misconception',
        stem: '화면이 닫히면 실행 중인 코루틴을 하나씩 취소해야 하는가?',
        choices: [
          { text: '아니다. ViewModelScope를 쓰면 한 번에 중단된다', correct: true },
          { text: '그렇다. 각각 취소해야 한다', leadsTo: 1 },
          { text: '그렇다. 취소하지 않으면 영원히 돈다', leadsTo: 4 },
          { text: '아니다. 코루틴은 취소할 수 없다', leadsTo: 3 },
        ],
        rationale:
          'Scope로 묶여 있으면 한 번에 취소할 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '구조적 동시성이 막는 것은?',
        choices: [
          { text: '자식이 예외를 던지는 것', leadsTo: 2 },
          { text: '부모가 끝났는데 자식이 남아 계속 도는 것', correct: true },
          { text: '코루틴이 여러 개 만들어지는 것', leadsTo: 1 },
          { text: '취소가 전파되는 것', leadsTo: 3 },
        ],
        rationale:
          '자식을 부모의 수명에 묶고 예외와 취소가 어디로 갈지도 함께 정한다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '@Transactional이 걸리지 않는 경우는?',
    items: [
      {
        kind: 'concept',
        stem: '트랜잭션을 여는 주체는?',
        choices: [
          { text: '애너테이션이 붙은 코드 자체', leadsTo: 1 },
          { text: '프록시', correct: true },
          { text: '실제 객체의 메서드 진입', leadsTo: 1 },
          { text: '데이터베이스 드라이버', leadsTo: 3 },
        ],
        rationale:
          '프록시를 통과하지 않으면 애초에 열릴 기회가 없다.',
      },
      {
        kind: 'misconception',
        stem: '트랜잭션이 걸렸으면 예외가 나면 되돌아가는가?',
        choices: [
          { text: '그렇다. 모든 예외가 롤백을 부른다', leadsTo: 2 },
          { text: '아니다. 체크 예외를 던지면 그대로 커밋된다', correct: true },
          { text: '그렇다. 예외 종류는 상관없다', leadsTo: 2 },
          { text: '아니다. 롤백은 수동으로만 가능하다', leadsTo: 2 },
        ],
        rationale:
          '기본 롤백 대상은 unchecked 예외라 되돌리려면 rollbackFor를 명시한다.',
      },
      {
        kind: 'boundary',
        stem: 'private 메서드에 안 걸리는 이유는?',
        choices: [
          { text: 'private은 애너테이션을 붙일 수 없어서', leadsTo: 1 },
          { text: 'CGLIB 프록시는 상속으로 만들어지는데 private은 재정의할 수 없다', correct: true },
          { text: '컨테이너가 private 메서드를 못 찾아서', leadsTo: 1 },
          { text: '보안 정책 때문에', leadsTo: 1 },
        ],
        rationale:
          'final 메서드와 final 클래스도 같은 이유로 가로채지 못한다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: 'JPA에서 N+1 쿼리는 왜 생기고 무엇으로 막는가?',
    items: [
      {
        kind: 'concept',
        stem: 'N+1에서 1과 N은 각각 무엇인가?',
        choices: [
          { text: '목록을 가져오는 질의 하나와 원소마다 연관을 채우는 질의', correct: true },
          { text: '연관을 읽는 질의 하나와 목록 질의 여러 개', leadsTo: 0 },
          { text: '조인 질의 하나와 정렬 질의 여러 개', leadsTo: 0 },
          { text: '읽기 질의 하나와 쓰기 질의 여러 개', leadsTo: 0 },
        ],
        rationale:
          '연관을 지연 로딩으로 두고 목록을 순회할 때 생긴다.',
      },
      {
        kind: 'misconception',
        stem: '즉시 로딩으로 바꾸면 해결되는가?',
        choices: [
          { text: '아니다. 연관이 필요 없는 조회에도 매번 조인이 붙는다', correct: true },
          { text: '그렇다. 질의가 하나로 줄어든다', leadsTo: 0 },
          { text: '그렇다. 매핑에서 정하는 것이 맞다', leadsTo: 0 },
          { text: '아니다. 오히려 질의 수가 더 늘어난다', leadsTo: 2 },
        ],
        rationale:
          '문제를 옮긴 것이지 푼 것이 아니다. 어디를 함께 읽을지는 화면이 결정한다.',
      },
      {
        kind: 'boundary',
        stem: '페이징이 함께 필요한 화면에서는 무엇을 쓰는가?',
        choices: [
          { text: 'batch size로 묶어 나눠 읽는다', correct: true },
          { text: '컬렉션까지 fetch join으로 한 번에', leadsTo: 1 },
          { text: '연관을 즉시 로딩으로 바꾼다', leadsTo: 2 },
          { text: '@EntityGraph로 연관을 지정한다', leadsTo: 0 },
        ],
        rationale:
          '컬렉션을 조인하면 행이 곱해져 페이징을 데이터베이스에 맡길 수 없다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '스프링 빈이 싱글톤인 것이 언제 문제가 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '빈의 필드에 값을 두면 공유 범위는?',
        choices: [
          { text: '호출 하나', leadsTo: 3 },
          { text: '애플리케이션 전체', correct: true },
          { text: '스레드 하나', leadsTo: 0 },
          { text: '요청 하나', leadsTo: 4 },
        ],
        rationale:
          '인스턴스가 하나뿐이라 한 요청이 써 넣은 값을 다른 요청이 읽는다.',
      },
      {
        kind: 'misconception',
        stem: '테스트가 통과했으면 안전한가?',
        choices: [
          { text: '아니다. 대신 필드를 final로 두면 된다', leadsTo: 3 },
          { text: '그렇다. 통과했으면 동시성도 검증된 것이다', leadsTo: 3 },
          { text: '그렇다. 스프링이 필드를 격리해 준다', leadsTo: 4 },
          { text: '아니다. 요청이 하나씩 들어오면 안 드러난다', correct: true },
        ],
        rationale:
          '동시 접속이 생기는 순간 남의 데이터가 보인다.',
      },
      {
        kind: 'boundary',
        stem: '왜 싱글톤이 기본인가?',
        choices: [
          { text: '스프링이 다른 스코프를 지원하지 않아서', leadsTo: 1 },
          { text: '대부분의 빈이 상태 없는 서비스라 하나면 충분하다', correct: true },
          { text: '동시성을 자동으로 처리해 주기 때문에', leadsTo: 3 },
          { text: '요청 스코프가 더 느려서', leadsTo: 4 },
        ],
        rationale:
          '요청마다 만들면 생성 비용과 GC 부담이 그대로 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '생성자 주입이 기본 선택인 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '생성자 주입이 필드 주입과 다른 점은?',
        choices: [
          { text: '컨테이너 없이는 쓸 수 없다', leadsTo: 2 },
          { text: '주입 오류를 늦게 잡는다', leadsTo: 1 },
          { text: '필드를 final로 둘 수 있어 불변으로 만든다', correct: true },
          { text: '선택 의존성만 표현할 수 있다', leadsTo: 0 },
        ],
        rationale:
          '필수 의존성을 생성자 서명이 강제하고 테스트에서 직접 전달할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '순환 참조가 나면 주입 방식을 바꿔 피하면 되는가?',
        choices: [
          { text: '그렇다. 필드 주입으로 바꾸면 해결된다', leadsTo: 1 },
          { text: '아니다. 시작 단계에서 드러난 설계 신호로 본다', correct: true },
          { text: '그렇다. 스프링 설정으로 끌 수 있다', leadsTo: 1 },
          { text: '아니다. 순환 참조는 원래 정상이다', leadsTo: 1 },
        ],
        rationale:
          '생성자 주입은 순환 참조를 시작 단계에서 드러낸다.',
      },
      {
        kind: 'boundary',
        stem: '생성자 매개변수가 지나치게 많으면?',
        choices: [
          { text: '@Autowired를 붙여 해결한다', leadsTo: 4 },
          { text: '필드 주입으로 바꾼다', leadsTo: 0 },
          { text: '클래스가 너무 많은 책임을 가진 것은 아닌지 먼저 본다', correct: true },
          { text: 'ObjectProvider로 감싼다', leadsTo: 3 },
        ],
        rationale:
          '주입 문법보다 설계를 먼저 의심한다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '빈 초기화 로직은 어느 시점에 실행해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '생성자에서 초기화하면 무엇이 보장되지 않는가?',
        choices: [
          { text: '모든 주입과 컨테이너 후처리가 끝났다는 것', correct: true },
          { text: '인스턴스가 만들어졌다는 것', leadsTo: 3 },
          { text: '클래스가 로드됐다는 것', leadsTo: 0 },
          { text: '설정 파일이 읽혔다는 것', leadsTo: 3 },
        ],
        rationale:
          '의존성 주입이 끝난 뒤 초기화 콜백에서 실행해야 한다.',
      },
      {
        kind: 'misconception',
        stem: '초기화 콜백은 세 방식 중 아무거나 골라도 같은가?',
        choices: [
          { text: '아니다. 하나만 쓸 수 있다', leadsTo: 3 },
          { text: '그렇다. 완전히 동일하다', leadsTo: 0 },
          { text: '그렇다. 호출 순서도 무작위다', leadsTo: 0 },
          { text: '순서가 정해져 있고 스프링 인터페이스는 결합도가 높다', correct: true },
        ],
        rationale:
          '@PostConstruct, InitializingBean, initMethod 순서로 호출되며 애너테이션 쪽이 덜 결합된다.',
      },
      {
        kind: 'boundary',
        stem: 'prototype 빈의 소멸 콜백은 누가 부르는가?',
        choices: [
          { text: '컨테이너가 종료 시 부른다', leadsTo: 2 },
          { text: '호출자가 직접 정리해야 한다', correct: true },
          { text: '가비지 컬렉터가 부른다', leadsTo: 2 },
          { text: '@PreDestroy가 자동으로 처리한다', leadsTo: 2 },
        ],
        rationale:
          '컨테이너가 생성 뒤 prototype 빈을 추적하지 않는다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '내부 메서드 호출에 부가기능이 빠지는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '어드바이스가 실행되려면 무엇이 있어야 하는가?',
        choices: [
          { text: '프록시가 호출을 가로채야 한다', correct: true },
          { text: '애너테이션이 붙어 있으면 된다', leadsTo: 2 },
          { text: '메서드가 공개돼 있으면 된다', leadsTo: 2 },
          { text: '대상 객체가 빈이면 된다', leadsTo: 2 },
        ],
        rationale:
          '내부 호출은 프록시를 우회하므로 어드바이스가 실행되지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '클래스 기반 프록시면 무엇이든 가로챌 수 있는가?',
        choices: [
          { text: '그렇다. 상속과 무관하게 바이트코드를 고친다', leadsTo: 1 },
          { text: '그렇다. 인터페이스가 없어도 전부 가능하다', leadsTo: 1 },
          { text: '아니다. 상속을 쓰므로 final은 못 가로챈다', correct: true },
          { text: '아니다. 공개 메서드도 못 가로챈다', leadsTo: 0 },
        ],
        rationale:
          'JDK 동적 프록시는 인터페이스를 바탕으로 만들어진다.',
      },
      {
        kind: 'boundary',
        stem: '가장 명확한 해법은?',
        choices: [
          { text: '자기 자신을 주입받는다', leadsTo: 0 },
          { text: '프록시를 노출해 자기 자신을 통해 부른다', leadsTo: 0 },
          { text: '적용 경계를 별도 빈으로 분리해 외부 호출로 만든다', correct: true },
          { text: '메서드를 private으로 바꾼다', leadsTo: 1 },
        ],
        rationale:
          '프록시 노출이나 자기 자신 주입은 결합도를 높여 우선 선택이 아니다.',
      },
    ],
  },
  {
    identityScope: 'springboot',
    question: '자동 구성은 어떤 조건에서 물러나는가?',
    items: [
      {
        kind: 'concept',
        stem: '사용자가 같은 역할의 빈을 선언하면?',
        choices: [
          { text: '둘 다 등록돼 충돌한다', leadsTo: 1 },
          { text: '기본 구성이 물러난다', correct: true },
          { text: '기본 구성이 사용자 빈을 덮어쓴다', leadsTo: 1 },
          { text: '시작이 실패한다', leadsTo: 1 },
        ],
        rationale:
          'ConditionalOnMissingBean이 사용자 정의를 존중하는 핵심 장치다.',
      },
      {
        kind: 'misconception',
        stem: '넓은 타입의 빈을 하나 선언하는 것은 안전한가?',
        choices: [
          { text: '그렇다. 선언한 것만 정확히 대체한다', leadsTo: 1 },
          { text: '아니다. 예상치 못한 기본 구성까지 꺼질 수 있다', correct: true },
          { text: '그렇다. 타입 범위는 영향이 없다', leadsTo: 1 },
          { text: '아니다. 대신 시작이 느려질 뿐이다', leadsTo: 2 },
        ],
        rationale:
          '조건 평가는 사용자 빈 유무를 타입으로 확인한다.',
      },
      {
        kind: 'boundary',
        stem: '구성이 빠졌을 때 무엇을 보는가?',
        choices: [
          { text: '제외 설정을 먼저 추가한다', leadsTo: 3 },
          { text: '빈 목록만', leadsTo: 0 },
          { text: '조건 평가 보고서의 일치와 불일치 이유', correct: true },
          { text: '의존성을 하나씩 지워 본다', leadsTo: 0 },
        ],
        rationale:
          '제외 설정은 의도와 영향 범위를 알 때만 쓴다.',
      },
    ],
  },
  {
    identityScope: 'springmvc',
    question: '요청 공통 처리는 어느 지점에 두는가?',
    items: [
      {
        kind: 'concept',
        stem: '선택된 컨트롤러 정보가 필요한 일은 어디에 두는가?',
        choices: [
          { text: '인터셉터', correct: true },
          { text: '필터', leadsTo: 2 },
          { text: '서비스', leadsTo: 3 },
          { text: '컨트롤러 본문', leadsTo: 3 },
        ],
        rationale:
          '필터는 서블릿 체인 경계라 핸들러 정보를 모른다.',
      },
      {
        kind: 'misconception',
        stem: 'preHandle이 거짓을 내도 뒷정리 콜백은 도는가?',
        choices: [
          { text: '그렇다. afterCompletion은 항상 실행된다', leadsTo: 3 },
          { text: '아니다. 뒤의 두 콜백 모두 돌지 않는다', correct: true },
          { text: '그렇다. 뒤의 두 콜백 모두 실행된다', leadsTo: 3 },
          { text: '아니다. 대신 필터가 대신 처리한다', leadsTo: 0 },
        ],
        rationale:
          '거짓을 내면 거기서 끊긴다.',
      },
      {
        kind: 'boundary',
        stem: '필터에서 난 예외는 어떻게 다루는가?',
        choices: [
          { text: '컨트롤러에서 다시 던진다', leadsTo: 0 },
          { text: 'ControllerAdvice가 잡는다', leadsTo: 0 },
          { text: '인터셉터가 잡는다', leadsTo: 0 },
          { text: '필터 체인에서 응답으로 바꾸거나 서블릿 오류 처리로 넘긴다', correct: true },
        ],
        rationale:
          '필터 예외는 보통 ControllerAdvice 범위 밖이다.',
      },
    ],
  },
  {
    identityScope: 'springmvc',
    question: '예외를 어디서 HTTP 응답으로 바꾸는가?',
    items: [
      {
        kind: 'concept',
        stem: '예상 밖 예외는 어떻게 응답하는가?',
        choices: [
          { text: '400으로 바꾼다', leadsTo: 2 },
          { text: '원래 메시지를 그대로 내보낸다', leadsTo: 4 },
          { text: '500으로 감춘다', correct: true },
          { text: '응답하지 않고 끊는다', leadsTo: 4 },
        ],
        rationale:
          '도메인 예외는 안정된 오류 코드와 HTTP 상태로 매핑한다.',
      },
      {
        kind: 'misconception',
        stem: '저장소 예외를 그대로 올려도 되는가?',
        choices: [
          { text: '아니다. 대신 메시지만 바꾸면 된다', leadsTo: 2 },
          { text: '그렇다. 원인이 정확히 전달된다', leadsTo: 4 },
          { text: '그렇다. 매핑 코드를 줄일 수 있다', leadsTo: 2 },
          { text: '아니다. API가 내부 기술에 묶인다', correct: true },
        ],
        rationale:
          '예상 가능한 실패는 의미가 드러나는 예외로 표현한다.',
      },
      {
        kind: 'boundary',
        stem: '응답과 로그는 어떻게 나누는가?',
        choices: [
          { text: '응답만 남기고 로그는 따로 남기지 않는다', leadsTo: 4 },
          { text: '응답에도 스택 트레이스를 실어 디버깅을 돕는다', leadsTo: 4 },
          { text: '계층마다 로그를 남겨 어디서 났는지 다 본다', leadsTo: 4 },
          { text: '응답에는 추적 ID와 코드만 싣는다', correct: true },
        ],
        rationale:
          '로그는 한 경계에서 한 번 남긴다.',
      },
    ],
  },
  {
    identityScope: 'springsecurity',
    question: '인증 정보는 어떻게 보안 문맥에 들어가는가?',
    items: [
      {
        kind: 'concept',
        stem: '인증 결과를 SecurityContext에 넣는 것은 누구인가?',
        choices: [
          { text: 'AuthenticationProvider', leadsTo: 0 },
          { text: 'AuthenticationManager', leadsTo: 0 },
          { text: '인증 필터', correct: true },
          { text: '인가 필터', leadsTo: 1 },
        ],
        rationale:
          'Manager는 검증을 위임하고 결과를 돌려줄 뿐이다.',
      },
      {
        kind: 'misconception',
        stem: '인증만 되면 접근이 허용되는가?',
        choices: [
          { text: '그렇다. 인증이 곧 인가다', leadsTo: 1 },
          { text: '아니다. 인가 필터가 권한으로 다시 판정한다', correct: true },
          { text: '그렇다. 권한은 컨트롤러가 본다', leadsTo: 1 },
          { text: '아니다. 인증만으로 401이 난다', leadsTo: 1 },
        ],
        rationale:
          '인증이 없으면 401, 인증은 됐지만 권한이 부족하면 403이다.',
      },
      {
        kind: 'boundary',
        stem: '세션 방식과 무상태 토큰 방식은 어떻게 다른가?',
        choices: [
          { text: '세션은 문맥을 복원하고 토큰은 매번 검증한다', correct: true },
          { text: '둘 다 요청마다 다시 검증한다', leadsTo: 2 },
          { text: '둘 다 저장해 둔 문맥을 복원한다', leadsTo: 2 },
          { text: '토큰 방식은 보안 문맥을 쓰지 않는다', leadsTo: 2 },
        ],
        rationale:
          '저장 정책과 필터 위치가 흐름을 바꾼다.',
      },
    ],
  },
  {
    identityScope: 'jpa',
    question: '같은 엔티티를 두 번 조회하면 왜 같은 객체인가?',
    items: [
      {
        kind: 'concept',
        stem: '1차 캐시가 인스턴스를 구분하는 기준은?',
        choices: [
          { text: '조회한 순서', leadsTo: 0 },
          { text: '엔티티 타입과 식별자', correct: true },
          { text: '쿼리 문자열', leadsTo: 0 },
          { text: '테이블 이름', leadsTo: 0 },
        ],
        rationale:
          '이미 관리 중이면 1차 캐시에서 같은 객체를 반환한다.',
      },
      {
        kind: 'misconception',
        stem: '1차 캐시가 있으니 트랜잭션 격리는 신경 안 써도 되는가?',
        choices: [
          { text: '아니다. 격리를 대신하지 않는다', correct: true },
          { text: '그렇다. 캐시가 일관성을 보장한다', leadsTo: 3 },
          { text: '그렇다. 여러 요청이 같은 캐시를 본다', leadsTo: 3 },
          { text: '아니다. 대신 2차 캐시가 대신한다', leadsTo: 3 },
        ],
        rationale:
          '이 캐시는 EntityManager 범위 안에서만 유효하다.',
      },
      {
        kind: 'boundary',
        stem: '긴 범위에 많은 엔티티를 쌓으면?',
        choices: [
          { text: '조회가 계속 빨라진다', leadsTo: 4 },
          { text: '메모리와 낡은 상태 문제가 커져 주기적으로 비워야 한다', correct: true },
          { text: '자동으로 오래된 것부터 제거된다', leadsTo: 4 },
          { text: '아무 영향이 없다', leadsTo: 4 },
        ],
        rationale:
          'clear나 detach 뒤에는 관리가 끊긴다.',
      },
    ],
  },
  {
    identityScope: 'jpa',
    question: '수정 메서드 없이 UPDATE가 나가는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '변경 감지는 무엇을 비교하는가?',
        choices: [
          { text: '이전 트랜잭션의 값과 현재 값', leadsTo: 0 },
          { text: '데이터베이스의 현재 행과 객체', leadsTo: 0 },
          { text: '관리 엔티티의 최초 상태와 현재 상태', correct: true },
          { text: '같은 타입의 다른 인스턴스들', leadsTo: 1 },
        ],
        rationale:
          'flush 때 달라진 속성이 있으면 UPDATE SQL을 만든다.',
      },
      {
        kind: 'misconception',
        stem: 'SQL이 보였으면 반영된 것인가?',
        choices: [
          { text: '아니다. 롤백하면 변경은 사라진다', correct: true },
          { text: '그렇다. flush가 곧 커밋이다', leadsTo: 0 },
          { text: '그렇다. SQL 실행은 되돌릴 수 없다', leadsTo: 0 },
          { text: '아니다. flush는 커밋 뒤에만 일어난다', leadsTo: 0 },
        ],
        rationale:
          'flush는 커밋 직전이나 쿼리 실행 전에 일어날 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '벌크 UPDATE 뒤에 무엇을 해야 하는가?',
        choices: [
          { text: 'flush 후 clear하거나 다시 조회한다', correct: true },
          { text: '아무것도 안 해도 된다', leadsTo: 2 },
          { text: 'merge로 다시 붙인다', leadsTo: 1 },
          { text: '트랜잭션을 다시 연다', leadsTo: 2 },
        ],
        rationale:
          '벌크 UPDATE는 영속성 컨텍스트를 건너뛰어 관리 중인 객체가 낡는다.',
      },
    ],
  },
  {
    identityScope: 'jpa',
    question: '외래 키 변경은 어느 쪽에서 반영해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '연관관계의 주인은 어느 쪽인가?',
        choices: [
          { text: '먼저 저장되는 쪽', leadsTo: 1 },
          { text: 'mappedBy를 지정한 쪽', leadsTo: 1 },
          { text: '도메인상 더 중요한 쪽', leadsTo: 1 },
          { text: '외래 키나 조인 테이블 값을 쓰는 매핑', correct: true },
        ],
        rationale:
          '주인이라는 말은 도메인상 중요도가 아니라 쓰기 권한을 뜻한다.',
      },
      {
        kind: 'misconception',
        stem: 'mappedBy 쪽 컬렉션에 넣으면 저장되는가?',
        choices: [
          { text: '아니다. 외래 키 SQL에 반영되지 않는다', correct: true },
          { text: '그렇다. 양쪽 어디서 바꿔도 같다', leadsTo: 0 },
          { text: '그렇다. 컬렉션이 우선한다', leadsTo: 1 },
          { text: '아니다. 대신 객체 탐색도 불가능해진다', leadsTo: 1 },
        ],
        rationale:
          '객체 탐색은 양쪽 다 되지만 쓰기는 주인 쪽만 한다.',
      },
      {
        kind: 'boundary',
        stem: 'cascade는 주인 여부와 어떤 관계인가?',
        choices: [
          { text: '주인을 정하는 설정이다', leadsTo: 3 },
          { text: '주인 쪽에서만 쓸 수 있다', leadsTo: 3 },
          { text: '별도 규칙이며 연산 전파를 정한다', correct: true },
          { text: '고아 삭제를 정하는 설정이다', leadsTo: 3 },
        ],
        rationale:
          'orphanRemoval이 고아 삭제를 맡는 별개 규칙이다.',
      },
    ],
  },
  {
    identityScope: 'jpa',
    question: '즉시 로딩을 기본값처럼 쓰면 왜 위험한가?',
    items: [
      {
        kind: 'concept',
        stem: '즉시 로딩은 조인을 보장하는가?',
        choices: [
          { text: '그렇다. 항상 하나의 조인으로 읽는다', leadsTo: 0 },
          { text: '아니다. 보조 쿼리가 반복될 수 있다', correct: true },
          { text: '그렇다. 그래서 N+1이 사라진다', leadsTo: 0 },
          { text: '아니다. 대신 아무것도 읽지 않는다', leadsTo: 2 },
        ],
        rationale:
          '사용하지 않는 연관관계까지 읽어 과조회와 메모리 낭비가 생긴다.',
      },
      {
        kind: 'misconception',
        stem: '지연 로딩으로 두면 그다음은 신경 쓸 게 없는가?',
        choices: [
          { text: '그렇다. 프록시가 알아서 처리한다', leadsTo: 2 },
          { text: '그렇다. 접근하지 않으면 아무 일도 없다', leadsTo: 2 },
          { text: '아니다. 응답 직렬화가 연관관계를 순회하면 예기치 않은 쿼리가 난다', correct: true },
          { text: '아니다. 대신 즉시 로딩으로 돌려야 한다', leadsTo: 0 },
        ],
        rationale:
          '지연 프록시를 영속성 컨텍스트 밖에서 건드리면 초기화에 실패한다.',
      },
      {
        kind: 'boundary',
        stem: '컬렉션과 페이징이 함께 필요하면?',
        choices: [
          { text: '먼저 루트 식별자를 페이지로 구한 뒤 별도로 조회한다', correct: true },
          { text: '컬렉션 fetch join으로 한 번에 읽는다', leadsTo: 3 },
          { text: '즉시 로딩으로 바꾼다', leadsTo: 0 },
          { text: '페이징을 포기한다', leadsTo: 4 },
        ],
        rationale:
          '컬렉션 fetch join은 중복 행을 만들고 페이징을 깨뜨릴 수 있다.',
      },
    ],
  },
  {
    identityScope: 'querydsl',
    question: '동적 조건이 많을 때 문자열 쿼리는 왜 약한가?',
    items: [
      {
        kind: 'concept',
        stem: '문자열 결합의 문제는 무엇인가?',
        choices: [
          { text: '문법과 타입 오류를 실행 전까지 놓치기 쉽다', correct: true },
          { text: '조건을 여러 개 붙일 수 없다', leadsTo: 0 },
          { text: '항상 더 느린 SQL을 만든다', leadsTo: 3 },
          { text: '페이징을 지원하지 않는다', leadsTo: 4 },
        ],
        rationale:
          'QueryDSL은 타입이 있는 식을 조합해 많은 오류를 컴파일 때 드러낸다.',
      },
      {
        kind: 'misconception',
        stem: '타입 안전하면 쿼리 성능도 보장되는가?',
        choices: [
          { text: '그렇다. 컴파일러가 계획까지 본다', leadsTo: 3 },
          { text: '그렇다. 생성된 쿼리가 최적이다', leadsTo: 3 },
          { text: '아니다. 조인 수와 인덱스와 실행 계획은 따로 검증해야 한다', correct: true },
          { text: '아니다. 대신 성능은 항상 더 나쁘다', leadsTo: 3 },
        ],
        rationale:
          '타입 안전성이 SQL의 정확성과 성능까지 보장하지는 않는다.',
      },
      {
        kind: 'boundary',
        stem: '어디에서 이점이 커지는가?',
        choices: [
          { text: '복잡한 검색과 통계 조회', correct: true },
          { text: '단순 CRUD', leadsTo: 1 },
          { text: '단건 조회', leadsTo: 1 },
          { text: '모든 경우에 똑같이', leadsTo: 1 },
        ],
        rationale:
          'Q 타입 생성과 빌드 설정이라는 비용이 있어 단순 CRUD에는 파생 쿼리가 더 작다.',
      },
    ],
  },
  {
    identityScope: 'springtx',
    question: '외부 롤백과 무관한 기록은 어떻게 남기는가?',
    items: [
      {
        kind: 'concept',
        stem: 'REQUIRES_NEW는 기존 트랜잭션을 어떻게 하는가?',
        choices: [
          { text: '합류해 함께 커밋한다', leadsTo: 0 },
          { text: '보류하고 새 트랜잭션에서 독립 커밋한다', correct: true },
          { text: 'savepoint를 찍고 이어간다', leadsTo: 2 },
          { text: '기존 것을 즉시 커밋한다', leadsTo: 1 },
        ],
        rationale:
          'REQUIRED는 기존 트랜잭션에 합류한다.',
      },
      {
        kind: 'misconception',
        stem: '내부 예외를 잡으면 바깥은 정상 커밋되는가?',
        choices: [
          { text: '그렇다. 잡은 예외는 전파되지 않는다', leadsTo: 0 },
          { text: '아니다. rollback-only가 찍혔으면 롤백된다', correct: true },
          { text: '그렇다. 트랜잭션은 예외와 무관하다', leadsTo: 0 },
          { text: '아니다. 대신 즉시 예외가 다시 난다', leadsTo: 0 },
        ],
        rationale:
          'REQUIRED로 합류한 내부에서 표시된 롤백 의사는 남는다.',
      },
      {
        kind: 'boundary',
        stem: 'REQUIRES_NEW를 남용하면 무엇이 위험한가?',
        choices: [
          { text: '트랜잭션이 아예 열리지 않는다', leadsTo: 1 },
          { text: '외부 연결을 쥔 채 새 연결을 또 요구한다', correct: true },
          { text: '안쪽이 먼저 커밋돼 순서가 뒤바뀐다', leadsTo: 2 },
          { text: '트랜잭션만 하나 더 열릴 뿐 부담이 없다', leadsTo: 1 },
        ],
        rationale:
          '동시 요청 수에 비해 풀이 작으면 교착 위험도 커진다.',
      },
    ],
  },
  {
    identityScope: 'architecture',
    question: '엔티티를 API 응답에 바로 쓰면 무엇이 새는가?',
    items: [
      {
        kind: 'concept',
        stem: '엔티티를 그대로 노출하면 무엇이 샌는가?',
        choices: [
          { text: '검증 규칙이 사라진다', leadsTo: 2 },
          { text: '영속성 구조와 내부 필드가 외부 계약으로 샌다', correct: true },
          { text: '트랜잭션 경계가 흐려진다', leadsTo: 0 },
          { text: '아무것도 새지 않는다', leadsTo: 3 },
        ],
        rationale:
          '엔티티 변경이 API 변경으로 번지고 직렬화가 지연 쿼리와 순환 참조를 만든다.',
      },
      {
        kind: 'misconception',
        stem: '요청과 응답에 같은 객체를 써도 되는가?',
        choices: [
          { text: '아니다. 대신 엔티티를 쓰면 된다', leadsTo: 3 },
          { text: '그렇다. 필드가 같으면 하나면 충분하다', leadsTo: 2 },
          { text: '그렇다. 매핑 중복을 줄일 수 있다', leadsTo: 4 },
          { text: '아니다. 요청은 입력 형식과 검증을, 응답은 공개 필드를 맡는다', correct: true },
        ],
        rationale:
          '맡는 일이 달라 함께 두면 한쪽 요구가 다른 쪽을 흔든다.',
      },
      {
        kind: 'boundary',
        stem: '분리의 대가는 언제 감수할 만한가?',
        choices: [
          { text: '내부 기능이 작을수록', leadsTo: 4 },
          { text: '언제나 예외 없이', leadsTo: 4 },
          { text: '계약이 자주 변하거나 외부에 공개될 때', correct: true },
          { text: '테이블이 많을수록', leadsTo: 0 },
        ],
        rationale:
          '매핑 코드와 중복 비용이 따르므로 작은 내부 기능은 복잡도와 함께 판단한다.',
      },
    ],
  },
  {
    identityScope: 'architecture',
    question: '서비스 계층이 모든 일을 맡으면 무엇이 무너지는가?',
    items: [
      {
        kind: 'concept',
        stem: '유스케이스와 트랜잭션을 조정하는 계층은?',
        choices: [
          { text: '표현', leadsTo: 0 },
          { text: '응용', correct: true },
          { text: '도메인', leadsTo: 1 },
          { text: '인프라', leadsTo: 0 },
        ],
        rationale:
          '표현은 프로토콜 변환, 도메인은 상태 전이와 핵심 규칙을 맡는다.',
      },
      {
        kind: 'misconception',
        stem: '계층 경계는 호출 수를 줄이면 되는 장식인가?',
        choices: [
          { text: '아니다. 변경 이유와 의존 방향을 고정하는 규칙이다', correct: true },
          { text: '그렇다. 성능을 위해 건너뛰면 된다', leadsTo: 2 },
          { text: '그렇다. 코드가 짧아지는 것이 목적이다', leadsTo: 3 },
          { text: '아니다. 대신 예외를 허용하면 안 된다', leadsTo: 2 },
        ],
        rationale:
          '예외를 허용할 때도 근거와 범위를 명시해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '상위 정책이 구현 기술을 직접 알지 않게 하려면?',
        choices: [
          { text: '계층을 하나로 줄인다', leadsTo: 4 },
          { text: '인프라 코드를 응용 계층에 합친다', leadsTo: 3 },
          { text: '도메인에서 저장소를 직접 부른다', leadsTo: 3 },
          { text: '인터페이스 경계를 둔다', correct: true },
        ],
        rationale:
          '교체와 테스트가 쉬워진다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '정적 클래스 내부에 정적 메서드를 정의하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '정적 메서드에 this가 없는 이유는?',
        choices: [
          { text: '메모리 영역이 다르기 때문이다', leadsTo: 2 },
          { text: '컴파일러가 금지하기 때문이다', leadsTo: 3 },
          { text: '자기를 부른 객체가 없기 때문이다', correct: true },
          { text: '상속할 수 없기 때문이다', leadsTo: 4 },
        ],
        rationale:
          '그래서 인스턴스 변수에 접근할 수 없다.',
      },
      {
        kind: 'misconception',
        stem: '정적 메서드는 바깥 상태를 건드리지 못하는가?',
        choices: [
          { text: '그렇다. 인자만 쓰고 끝난다', leadsTo: 0 },
          { text: '아니다. 참조를 받으면 그 객체의 필드도 보고 바깥 상태도 쓴다', correct: true },
          { text: '그렇다. 항상 같은 입력이면 같은 결과다', leadsTo: 2 },
          { text: '아니다. 대신 인스턴스 변수만 못 읽는다', leadsTo: 2 },
        ],
        rationale:
          '상태 없는 로직으로 쓰겠다는 의도일 뿐 언어가 막아 주지는 않는다.',
      },
      {
        kind: 'boundary',
        stem: '정적 메서드를 쓸 때 감수하는 것은?',
        choices: [
          { text: '상태를 가질 수 없어 느리다', leadsTo: 3 },
          { text: '호출 비용이 더 크다', leadsTo: 3 },
          { text: '스레드에서 쓸 수 없다', leadsTo: 2 },
          { text: '테스트에서 모킹이 어렵다', correct: true },
        ],
        rationale:
          'new로 인스턴스를 만들지 못하게 막는 대신 갈아 끼울 자리도 사라진다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: 'JVM GC의 효율을 높이는 튜닝 포인트는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '튜닝은 무엇을 먼저 정하고 시작하는가?',
        choices: [
          { text: '사용할 수집기 이름', leadsTo: 1 },
          { text: '힙 크기의 최댓값', leadsTo: 2 },
          { text: '서비스가 허용할 수 있는 지연 시간과 처리량', correct: true },
          { text: '객체 생성 횟수', leadsTo: 4 },
        ],
        rationale:
          '그 목표에 맞춰 힙 크기와 GC 알고리즘 두 값을 조정한다.',
      },
      {
        kind: 'misconception',
        stem: '힙을 크게 잡으면 GC 부담이 줄어드는가?',
        choices: [
          { text: '아니다. Full GC의 처리 시간이 길어진다', correct: true },
          { text: '그렇다. 클수록 항상 유리하다', leadsTo: 0 },
          { text: '그렇다. Stop-the-world가 사라진다', leadsTo: 0 },
          { text: '아니다. 대신 CPU 사용률이 내려간다', leadsTo: 2 },
        ],
        rationale:
          '반대로 너무 작으면 GC가 빈번해져 CPU 사용률이 올라간다.',
      },
      {
        kind: 'boundary',
        stem: 'G1은 힙을 어떻게 다루는가?',
        choices: [
          { text: '세대 구분 없이 하나로 관리한다', leadsTo: 4 },
          { text: 'Young과 Old를 한 덩어리로 붙여 둔다', leadsTo: 1 },
          { text: '작은 조각으로 쪼개고 조각마다 Young인지 Old인지를 붙인다', correct: true },
          { text: 'Old 영역만 관리한다', leadsTo: 1 },
        ],
        rationale:
          '한 덩어리로 붙은 배치는 옛 수집기 쪽이다.',
      },
    ],
  },
  {
    identityScope: 'jvm',
    question: 'JVM의 핵심 역할은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '컴파일러와 JVM은 각각 무엇을 하는가?',
        choices: [
          { text: '컴파일러 없이 JVM이 소스를 직접 읽어 기계어로 바꾼다', leadsTo: 0 },
          { text: '컴파일러가 기계어까지 만들고 JVM은 실행만 한다', leadsTo: 2 },
          { text: '컴파일러는 바이트코드까지, JVM은 기계어로 바꾼다', correct: true },
          { text: '컴파일러가 바이트코드를 만들고 JVM도 바이트코드를 만든다', leadsTo: 2 },
        ],
        rationale:
          '이 구조가 Write Once, Run Anywhere를 실현한다.',
      },
      {
        kind: 'misconception',
        stem: '가비지 컬렉션이 있으면 메모리 누수가 없는가?',
        choices: [
          { text: '그렇다. 자동 관리라 누수가 불가능하다', leadsTo: 3 },
          { text: '아니다. 안 쓰는 객체를 어딘가에서 붙들고 있으면 걷히지 않는다', correct: true },
          { text: '그렇다. 직접 해제할 일이 없어졌다', leadsTo: 3 },
          { text: '아니다. 대신 직접 해제해야 한다', leadsTo: 3 },
        ],
        rationale:
          '개발자가 직접 해제할 일이 줄어들 뿐이다.',
      },
      {
        kind: 'boundary',
        stem: 'JIT 컴파일러가 하는 일은?',
        choices: [
          { text: '실행 전에 전체를 기계어로 바꿔 두고 시작한다', leadsTo: 1 },
          { text: '자주 실행되는 코드를 기계어로 바꿔 저장한다', correct: true },
          { text: '바이트코드를 압축해 읽는 시간을 줄인다', leadsTo: 1 },
          { text: '쓰지 않는 객체를 찾아 메모리를 회수한다', leadsTo: 3 },
        ],
        rationale:
          '이후 같은 코드는 해석 없이 바로 돈다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '체크 예외와 언체크 예외의 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 기준은?',
        choices: [
          { text: '발생 빈도', leadsTo: 3 },
          { text: '예외의 심각도', leadsTo: 3 },
          { text: '복구 가능 여부', correct: true },
          { text: '메시지의 유무', leadsTo: 3 },
        ],
        rationale:
          '호출자가 대처할 수 있으면 체크 예외, 실수나 시스템 장애면 언체크 예외다.',
      },
      {
        kind: 'misconception',
        stem: '체크 예외를 쓰면 예외가 덜 나는가?',
        choices: [
          { text: '아니다. 처리든 전파든 하나를 강제할 뿐이다', correct: true },
          { text: '그렇다. 컴파일러가 예외를 막아 준다', leadsTo: 1 },
          { text: '그렇다. 시그니처에 적으면 안전해진다', leadsTo: 1 },
          { text: '아니다. 대신 성능이 나빠진다', leadsTo: 0 },
        ],
        rationale:
          '컴파일러가 강제하는 것은 처리 의무지 예외 발생 자체가 아니다.',
      },
      {
        kind: 'boundary',
        stem: '널 포인터 참조를 try-catch로 잡으면 되는가?',
        choices: [
          { text: '아니다. 코드를 수정해야 풀리는 문제다', correct: true },
          { text: '그렇다. 잡으면 정상 동작한다', leadsTo: 0 },
          { text: '그렇다. 체크 예외로 바꾸면 더 안전하다', leadsTo: 1 },
          { text: '아니다. 대신 상위로 전파해야 한다', leadsTo: 1 },
        ],
        rationale:
          '논리적 오류는 잡는다고 해결되지 않는다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '톰캣은 서블릿 컨테이너로서 어떤 일을 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '톰캣이 요청을 받아 하는 일은?',
        choices: [
          { text: '정적 파일만 골라 응답하고 나머지는 넘긴다', leadsTo: 4 },
          { text: '서블릿에 넘기고 생명주기와 스레드를 관리한다', correct: true },
          { text: '받은 요청을 앞단 웹 서버로 되돌려 보낸다', leadsTo: 0 },
          { text: '데이터베이스 연결만 관리하고 요청은 안 본다', leadsTo: 0 },
        ],
        rationale:
          '비즈니스 로직이 필요한 요청을 처리해 동적인 응답을 만든다.',
      },
      {
        kind: 'misconception',
        stem: '톰캣은 정적 파일을 처리하지 못하는가?',
        choices: [
          { text: '그렇다. 웹 서버가 반드시 앞에 있어야 한다', leadsTo: 4 },
          { text: '그렇다. 서블릿만 실행할 수 있다', leadsTo: 0 },
          { text: '아니다. 성능이 좋아져 단독으로 쓰기도 한다', correct: true },
          { text: '아니다. 대신 웹 서버보다 항상 빠르다', leadsTo: 4 },
        ],
        rationale:
          '그래도 보안과 로드밸런싱을 위해 앞단에 웹 서버를 두는 구조가 일반적이다.',
      },
      {
        kind: 'boundary',
        stem: '웹 서버와 WAS의 대표 예는?',
        choices: [
          { text: '웹 서버는 Apache와 Nginx, WAS는 Tomcat과 Jetty', correct: true },
          { text: '웹 서버는 Tomcat, WAS는 Nginx', leadsTo: 0 },
          { text: '둘 다 Tomcat이 겸한다', leadsTo: 4 },
          { text: '웹 서버는 Jetty, WAS는 Apache', leadsTo: 0 },
        ],
        rationale:
          '웹 서버는 정적 리소스, WAS는 서블릿 실행과 DB 연동을 맡는다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '인터페이스와 추상 클래스는 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘의 관계 성격은?',
        choices: [
          { text: '둘 다 can-do', leadsTo: 1 },
          { text: '둘 다 is-a', leadsTo: 3 },
          { text: '인터페이스는 can-do, 추상 클래스는 is-a', correct: true },
          { text: '인터페이스는 is-a, 추상 클래스는 can-do', leadsTo: 3 },
        ],
        rationale:
          '인터페이스는 무엇을 하는지, 추상 클래스는 무엇인지를 정의한다.',
      },
      {
        kind: 'misconception',
        stem: '추상 클래스도 여러 개를 상속할 수 있는가?',
        choices: [
          { text: '그렇다. 개수 제한이 없다', leadsTo: 1 },
          { text: '아니다. 다중 상속은 인터페이스만 가능하다', correct: true },
          { text: '그렇다. 추상 메서드만 있으면 가능하다', leadsTo: 0 },
          { text: '아니다. 인터페이스도 하나만 구현할 수 있다', leadsTo: 1 },
        ],
        rationale:
          '서로 다른 계층의 클래스들이 공통 인터페이스로 소통하게 하는 것이 목적이다.',
      },
      {
        kind: 'boundary',
        stem: '추상 클래스를 쓰는 이유는?',
        choices: [
          { text: '인스턴스를 만들려고', leadsTo: 3 },
          { text: '행위 규격만 정하려고', leadsTo: 0 },
          { text: '다중 상속을 얻으려고', leadsTo: 1 },
          { text: '공통된 상태와 기본 구현을 공유해 중복을 줄인다', correct: true },
        ],
        rationale:
          '자식 클래스가 추상 메서드를 구현해 실제 동작을 정한다.',
      },
    ],
  },
  {
    identityScope: 'java',
    question: '스트림의 지연 연산은 왜 필요한가?',
    items: [
      {
        kind: 'concept',
        stem: '중간 연산을 부르면 무슨 일이 일어나는가?',
        choices: [
          { text: '즉시 결과가 계산된다', leadsTo: 1 },
          { text: '파이프라인이라는 설계도만 만들어진다', correct: true },
          { text: '임시 컬렉션이 생긴다', leadsTo: 1 },
          { text: '데이터가 한 번 흐른다', leadsTo: 2 },
        ],
        rationale:
          '터미널 연산이 호출되어야만 데이터가 흐르기 시작한다.',
      },
      {
        kind: 'misconception',
        stem: '지연 연산이면 데이터가 항상 끊김 없이 흐르는가?',
        choices: [
          { text: '아니다. 정렬이나 중복 제거처럼 앞을 다 봐야 하는 연산에서 고인다', correct: true },
          { text: '그렇다. 모든 연산이 한 건씩 통과한다', leadsTo: 3 },
          { text: '그렇다. 파이프라인은 멈추지 않는다', leadsTo: 3 },
          { text: '아니다. 대신 매번 임시 컬렉션이 생긴다', leadsTo: 1 },
        ],
        rationale:
          '이어 붙일 수 있는 연산만 한 번에 흘려보낸다.',
      },
      {
        kind: 'boundary',
        stem: '즉시 연산했다면 무엇을 치르는가?',
        choices: [
          { text: '연산 순서를 못 바꾼다', leadsTo: 3 },
          { text: '결과가 달라진다', leadsTo: 3 },
          { text: '중간 단계마다 임시 컬렉션이 생겨 메모리와 CPU를 쓴다', correct: true },
          { text: '무한 데이터를 다룰 수 있다', leadsTo: 4 },
        ],
        rationale:
          '불필요한 계산을 줄이는 것이 지연 연산의 목적이다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: 'ORM을 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'ORM이 해결하려는 문제는?',
        choices: [
          { text: '직접 쓴 쿼리보다 느린 실행 속도', leadsTo: 0 },
          { text: '매번 새로 맺는 데이터베이스 연결 비용', leadsTo: 2 },
          { text: '객체지향과 관계형의 패러다임 불일치', correct: true },
          { text: '동시 접근에서의 트랜잭션 격리', leadsTo: 2 },
        ],
        rationale:
          '반복적인 CRUD SQL을 줄여 객체 쪽 로직에 집중하게 한다.',
      },
      {
        kind: 'misconception',
        stem: 'ORM을 쓰면 유지보수가 무조건 쉬워지는가?',
        choices: [
          { text: '아니다. 엔티티를 고치고 DB 마이그레이션도 따로 해야 한다', correct: true },
          { text: '그렇다. 스키마가 자동으로 맞춰진다', leadsTo: 2 },
          { text: '그렇다. SQL을 볼 일이 없어진다', leadsTo: 3 },
          { text: '아니다. 대신 SQL 매퍼가 항상 낫다', leadsTo: 4 },
        ],
        rationale:
          'SQL 매퍼는 SQL과 매핑을 손보고 ORM은 엔티티와 마이그레이션을 손본다.',
      },
      {
        kind: 'boundary',
        stem: 'ORM에서 자주 나오는 성능 문제는?',
        choices: [
          { text: '트랜잭션 교착', leadsTo: 2 },
          { text: '커넥션 누수', leadsTo: 2 },
          { text: 'N+1 문제', correct: true },
          { text: '인덱스 미사용', leadsTo: 4 },
        ],
        rationale:
          '페치 조인이나 @EntityGraph로 필요한 연관을 한 번에 읽어 줄인다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '단위 시험과 통합 시험은 무엇으로 가르는가?',
    items: [
      {
        kind: 'concept',
        stem: '둘을 가르는 기준은?',
        choices: [
          { text: '실행 속도', leadsTo: 1 },
          { text: '가짜 객체를 쓰는지', leadsTo: 0 },
          { text: '무엇을 함께 확인하는지', correct: true },
          { text: '시험 코드의 길이', leadsTo: 2 },
        ],
        rationale:
          '단위는 동작 하나를, 통합은 조각들이 만나는 곳을 본다.',
      },
      {
        kind: 'misconception',
        stem: '가짜 객체를 쓰면 단위 시험인가?',
        choices: [
          { text: '아니다. 단위 시험은 가짜를 쓰면 안 된다', leadsTo: 0 },
          { text: '그렇다. 가짜를 쓰는 것이 단위의 정의다', leadsTo: 0 },
          { text: '그렇다. 실제 객체를 쓰면 통합이다', leadsTo: 0 },
          { text: '아니다. 경향이지 정의가 아니다', correct: true },
        ],
        rationale:
          '단위 시험이 실제 협력 객체를 써도 되고 통합 시험이 바깥만 가짜로 둬도 된다.',
      },
      {
        kind: 'boundary',
        stem: '시험이 쓸모 있는지 무엇으로 확인하는가?',
        choices: [
          { text: '단위와 통합의 비율', leadsTo: 3 },
          { text: '커버리지 숫자', leadsTo: 3 },
          { text: '고친 자리를 되돌렸을 때 빨간불이 뜨는지', correct: true },
          { text: '전체 실행 시간', leadsTo: 1 },
        ],
        rationale:
          '되돌려도 통과하면 그 시험은 적어도 이 회귀를 못 잡는다.',
      },
    ],
  },
  {
    identityScope: 'orm',
    question: '목록 하나 읽었는데 쿼리가 백 번 나가는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '연결된 것은 언제 읽어 오는가?',
        choices: [
          { text: '실제로 쓸 때 그때 읽어 오도록 미뤄 둔다', correct: true },
          { text: '목록을 읽을 때 함께 읽는다', leadsTo: 0 },
          { text: '트랜잭션이 끝날 때 읽는다', leadsTo: 4 },
          { text: '전혀 읽지 않는다', leadsTo: 2 },
        ],
        rationale:
          '그래서 목록을 화면에 뿌리는 순간 항목 수만큼 더 나간다.',
      },
      {
        kind: 'misconception',
        stem: '개발할 때 안 느렸으면 괜찮은가?',
        choices: [
          { text: '그렇다. 캐시가 알아서 막아 준다', leadsTo: 1 },
          { text: '그렇다. 느리지 않으면 문제가 없다', leadsTo: 4 },
          { text: '아니다. 데이터가 적을 때는 표가 안 나고 늘어난 뒤에 느려진다', correct: true },
          { text: '아니다. 대신 지연 로딩을 끄면 된다', leadsTo: 2 },
        ],
        rationale:
          '쿼리가 몇 번 나갔는지 세어 봐야 드러난다.',
      },
      {
        kind: 'boundary',
        stem: '조인으로 한 번에 가져올 때 조심할 것은?',
        choices: [
          { text: '다른 연관의 지연 로딩까지 꺼진다', leadsTo: 2 },
          { text: '조인은 행 수를 바꾸지 않아 안전하다', leadsTo: 3 },
          { text: '조인마다 쿼리가 오히려 하나씩 는다', leadsTo: 0 },
          { text: '하나에 여럿이 달린 관계를 겹치면 행이 곱해진다', correct: true },
        ],
        rationale:
          '필요한 것을 모아 in으로 한 번에 묻는 길도 있다.',
      },
    ],
  },
  {
    identityScope: 'orm',
    question: '수정 메서드를 안 불렀는데 UPDATE가 나가는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '읽어 올 때 무엇을 함께 해 두는가?',
        choices: [
          { text: '행을 잠근다', leadsTo: 3 },
          { text: '변경 이력을 기록한다', leadsTo: 2 },
          { text: '읽은 그대로 사본을 떠 둔다', correct: true },
          { text: '아무것도 하지 않는다', leadsTo: 0 },
        ],
        rationale:
          '반영하는 시점에 지금 값과 견줘 달라진 것만 내보낸다.',
      },
      {
        kind: 'misconception',
        stem: '화면용으로 잠깐 고치는 것은 안전한가?',
        choices: [
          { text: '그렇다. 트랜잭션 밖이면 안전하다', leadsTo: 1 },
          { text: '그렇다. 저장을 안 부르면 반영되지 않는다', leadsTo: 0 },
          { text: '아니다. 조회해 온 것을 고치면 DB까지 바뀐다', correct: true },
          { text: '아니다. 대신 조회 자체가 막힌다', leadsTo: 3 },
        ],
        rationale:
          '핵심 위험이 바로 이 의도치 않은 수정이다.',
      },
      {
        kind: 'boundary',
        stem: '많은 행을 읽기만 할 때는?',
        choices: [
          { text: '트랜잭션을 길게 잡는다', leadsTo: 0 },
          { text: '한 번에 다 읽어 두면 된다', leadsTo: 3 },
          { text: '읽기 전용으로 열면 사본을 안 떠 그만큼 가볍다', correct: true },
          { text: '차이가 없다', leadsTo: 0 },
        ],
        rationale:
          '사본을 뜨는 만큼 메모리를 쓴다.',
      },
    ],
  },
  {
    identityScope: 'spring',
    question: '스프링 AOP의 프록시 자기 호출 시 무엇이 문제인가?',
    items: [
      {
        kind: 'concept',
        stem: '프록시로 진입하는 것은 어떤 호출인가?',
        choices: [
          { text: '클래스 안에서 this로 부르는 호출', leadsTo: 0 },
          { text: '외부에서 들어오는 호출', correct: true },
          { text: '모든 호출', leadsTo: 0 },
          { text: '애너테이션이 붙은 호출', leadsTo: 0 },
        ],
        rationale:
          '내부에서 다른 메서드를 부를 때는 this로 직접 호출한다.',
      },
      {
        kind: 'misconception',
        stem: '@Cacheable은 애너테이션이라 내부 호출에도 붙는가?',
        choices: [
          { text: '아니다. 대신 예외가 발생한다', leadsTo: 0 },
          { text: '그렇다. 애너테이션은 위치와 무관하다', leadsTo: 0 },
          { text: '그렇다. 캐시는 트랜잭션과 달리 항상 동작한다', leadsTo: 0 },
          { text: '아니다. 프록시의 가로채기를 건너뛰어 적용되지 않는다', correct: true },
        ],
        rationale:
          '@Transactional도 같은 이유로 내부 호출에서는 전파가 적용되지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '자기 자신을 다시 주입하는 방식은?',
        choices: [
          { text: '스프링이 금지한다', leadsTo: 3 },
          { text: '가능하지만 결합도가 높아진다', correct: true },
          { text: '가장 권장되는 해법이다', leadsTo: 0 },
          { text: '프록시를 없애 버린다', leadsTo: 1 },
        ],
        rationale:
          '로직을 별도 서비스로 빼서 프록시를 거치게 하는 편이 낫다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '해시 테이블의 평균 O(1)이 무너지는 경우는?',
    items: [
      {
        kind: 'concept',
        stem: '평균 O(1)은 무엇을 전제로 하는가?',
        choices: [
          { text: '키의 개수가 적다는 것', leadsTo: 1 },
          { text: '해시가 고르게 흩어진다는 것', correct: true },
          { text: '버킷이 무한하다는 것', leadsTo: 1 },
          { text: '삭제가 없다는 것', leadsTo: 0 },
        ],
        rationale:
          '전제가 깨지면 최악 O(n)으로 간다.',
      },
      {
        kind: 'misconception',
        stem: '분할 상환하면 평균이 O(1)이니 지연도 안정적인가?',
        choices: [
          { text: '그렇다. 평균이 곧 지연 보장이다', leadsTo: 2 },
          { text: '아니다. 리사이즈 한 번이 튀는 지점으로 나타난다', correct: true },
          { text: '그렇다. 리사이즈는 비용이 없다', leadsTo: 2 },
          { text: '아니다. 대신 평균도 O(n)이다', leadsTo: 1 },
        ],
        rationale:
          '리사이즈는 모든 키를 다시 배치하므로 그 한 번이 무겁다.',
      },
      {
        kind: 'boundary',
        stem: '키가 몰리는 이유 중 방어가 필요한 쪽은?',
        choices: [
          { text: '버킷 수가 2의 거듭제곱인 것', leadsTo: 1 },
          { text: '누군가 일부러 겹치게 만드는 해시 충돌 공격', correct: true },
          { text: '삭제가 잦은 것', leadsTo: 2 },
          { text: '키가 문자열인 것', leadsTo: 3 },
        ],
        rationale:
          '사용자 입력이 그대로 키가 되는 자리에서는 실제 공격 벡터가 된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '정렬의 안정성이 실무에서 문제가 되는 때는?',
    items: [
      {
        kind: 'concept',
        stem: '안정 정렬이 보장하는 것은?',
        choices: [
          { text: '키가 같은 원소들의 원래 순서', correct: true },
          { text: '최악 시간 복잡도', leadsTo: 0 },
          { text: '추가 메모리를 안 쓰는 것', leadsTo: 1 },
          { text: '정렬 결과가 유일한 것', leadsTo: 2 },
        ],
        rationale:
          '이름순 목록을 부서순으로 다시 정렬해도 부서 안이 이름순으로 남는다.',
      },
      {
        kind: 'misconception',
        stem: '한 언어 안에서는 정렬 안정성이 늘 같은가?',
        choices: [
          { text: '그렇다. 모든 정렬이 안정적이다', leadsTo: 1 },
          { text: '그렇다. 언어마다 하나로 정해져 있다', leadsTo: 3 },
          { text: '아니다. 자바는 객체 배열만 안정적이고 원시 타입은 아니다', correct: true },
          { text: '아니다. 대신 원시 타입만 안정적이다', leadsTo: 3 },
        ],
        rationale:
          '값이 같은 int 둘은 구별할 방법이 없어 순서가 바뀌어도 관측되지 않는다.',
      },
      {
        kind: 'boundary',
        stem: '안정성이 필요한지 어떻게 판단하는가?',
        choices: [
          { text: '항상 필요하다', leadsTo: 3 },
          { text: '데이터 개수가 많은지 본다', leadsTo: 4 },
          { text: '정렬 기준이 몇 개인지만 본다', leadsTo: 2 },
          { text: '같은 키를 가진 두 원소를 사용자가 구별할 수 있는지 본다', correct: true },
        ],
        rationale:
          '비교자를 합치면 안정 정렬에 기대지 않아도 된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '이진 탐색 트리가 한쪽으로 치우치면 무엇이 문제인가?',
    items: [
      {
        kind: 'concept',
        stem: '치우친 트리는 무엇이 되는가?',
        choices: [
          { text: '완전 이진 트리', leadsTo: 0 },
          { text: '연결 리스트', correct: true },
          { text: '해시 테이블', leadsTo: 2 },
          { text: 'B-트리', leadsTo: 3 },
        ],
        rationale:
          '탐색이 절반씩 줄어든다는 전제가 깨져 O(log n)이 O(n)으로 내려앉는다.',
      },
      {
        kind: 'misconception',
        stem: '단건 조회가 빠른 해시로 다 바꾸면 되는가?',
        choices: [
          { text: '아니다. 범위 질의와 정렬 순회를 못 한다', correct: true },
          { text: '그렇다. 해시가 모든 면에서 낫다', leadsTo: 2 },
          { text: '그렇다. 정렬도 해시로 된다', leadsTo: 2 },
          { text: '아니다. 대신 해시가 더 느리다', leadsTo: 2 },
        ],
        rationale:
          '"20에서 30 사이"를 물어야 하면 트리 쪽이다.',
      },
      {
        kind: 'boundary',
        stem: '데이터베이스 인덱스가 B-트리를 쓰는 이유는?',
        choices: [
          { text: '노드가 커서 균형을 맞출 필요가 없어 회전 비용이 들지 않는다', leadsTo: 4 },
          { text: '이진 트리보다 회전이 단순해 삽입과 삭제가 빠르다', leadsTo: 0 },
          { text: '한 노드에 키를 많이 담아 높이를 낮출 수 있어서', correct: true },
          { text: '범위 질의를 못 하는 대신 단건 조회가 빠르다', leadsTo: 2 },
        ],
        rationale:
          '스스로 균형을 잡는 트리는 회전 비용을 치르고 최악을 O(log n)으로 묶는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '연결 리스트가 배열보다 항상 삽입이 빠른가?',
    items: [
      {
        kind: 'concept',
        stem: '연결 리스트 삽입이 O(1)인 조건은?',
        choices: [
          { text: '가운데에 넣을 때', leadsTo: 0 },
          { text: '넣을 자리의 노드를 이미 쥐고 있을 때', correct: true },
          { text: '원소가 적을 때', leadsTo: 1 },
          { text: '언제나', leadsTo: 2 },
        ],
        rationale:
          '자리를 찾아가는 것부터 세면 O(N)이라 배열과 다를 것이 없다.',
      },
      {
        kind: 'misconception',
        stem: '배열은 탐색이 O(1)이니 삽입도 빠른가?',
        choices: [
          { text: '그렇다. 삽입도 O(1)이다', leadsTo: 2 },
          { text: '그렇다. 인덱스로 바로 넣는다', leadsTo: 2 },
          { text: '아니다. 뒤의 원소를 한 칸씩 미는 쉬프트 비용으로 O(N)이다', correct: true },
          { text: '아니다. 대신 탐색도 O(N)이다', leadsTo: 2 },
        ],
        rationale:
          '데이터가 무작위로 위치할 때는 두 자료구조 모두 한계가 있다.',
      },
      {
        kind: 'boundary',
        stem: '큐를 연결 리스트로 구현하는 이유는?',
        choices: [
          { text: '양 끝의 삽입과 삭제에서 요소를 옮기지 않는다', correct: true },
          { text: '탐색이 빨라서', leadsTo: 2 },
          { text: '메모리를 덜 써서', leadsTo: 1 },
          { text: '캐시 지역성이 좋아서', leadsTo: 2 },
        ],
        rationale:
          '노드를 이미 쥐고 있는 자리라 쉬프트가 없다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '스택과 큐는 각각 어떤 상황에서 선택해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '너비 우선 탐색에 쓰는 자료구조는?',
        choices: [
          { text: '연결 리스트만', leadsTo: 0 },
          { text: '스택', leadsTo: 3 },
          { text: '우선순위 큐', leadsTo: 2 },
          { text: '큐', correct: true },
        ],
        rationale:
          '스택은 LIFO라 깊이 우선 탐색에, 큐는 FIFO라 너비 우선 탐색에 맞는다.',
      },
      {
        kind: 'misconception',
        stem: '어느 쪽을 쓸지는 입출력 순서만 보면 되는가?',
        choices: [
          { text: '아니다. 대신 둘은 서로 대체 가능하다', leadsTo: 3 },
          { text: '그렇다. 순서만 맞으면 성능은 같다', leadsTo: 0 },
          { text: '그렇다. 구현은 언어가 최적화한다', leadsTo: 1 },
          { text: '아니다. 구현에 쓰는 자료구조의 비용도 따져야 한다', correct: true },
        ],
        rationale:
          '큐는 꺼낼 때 생기는 배열 내 요소 이동 비용을 줄일 방법을 고민해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '직전 상태를 기억해야 하는 곳은?',
        choices: [
          { text: '프린터 인쇄 작업', leadsTo: 0 },
          { text: '이메일 발송 대기열', leadsTo: 0 },
          { text: '함수 호출이나 실행 취소', correct: true },
          { text: '비동기 요청 완충', leadsTo: 0 },
        ],
        rationale:
          '큐는 유입된 요청을 순서대로 소화하는 완충 지대에 알맞다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '해시 충돌 발생 시 해결 방법은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '체이닝과 개방 주소법의 저장 방식 차이는?',
        choices: [
          { text: '체이닝은 외부 리스트, 개방 주소법은 내부 슬롯', correct: true },
          { text: '둘 다 버킷 밖 외부 리스트에 이어 붙인다', leadsTo: 4 },
          { text: '둘 다 배열 안의 빈 슬롯만 찾아 쓴다', leadsTo: 4 },
          { text: '체이닝이 내부 슬롯, 개방 주소법이 외부 리스트', leadsTo: 2 },
        ],
        rationale:
          '체이닝은 추가 메모리가 들고 개방 주소법은 미리 할당된 공간을 쓴다.',
      },
      {
        kind: 'misconception',
        stem: '자바 8은 버킷이 길어지면 바로 트리로 바꾸는가?',
        choices: [
          { text: '그렇다. 임계치만 넘으면 바꾼다', leadsTo: 1 },
          { text: '아니다. 표 용량이 64 이상일 때만 바꾼다', correct: true },
          { text: '그렇다. 표 용량과 무관하게 바꾼다', leadsTo: 1 },
          { text: '아니다. 트리로는 절대 바꾸지 않는다', leadsTo: 3 },
        ],
        rationale:
          '용량이 작으면 트리 대신 표를 키우는 편이 낫다.',
      },
      {
        kind: 'boundary',
        stem: '개방 주소법에서 선형 탐색의 약점은?',
        choices: [
          { text: '테이블이 꽉 차지 않는다', leadsTo: 0 },
          { text: '추가 메모리를 많이 쓴다', leadsTo: 0 },
          { text: '삭제가 불가능하다', leadsTo: 2 },
          { text: '인접한 빈칸을 찾아 뭉침이 심해진다', correct: true },
        ],
        rationale:
          '데이터가 뭉치는 클러스터링 현상이 효율을 떨어뜨린다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '일반 이진트리 대신 이진탐색트리를 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '이진탐색트리의 노드 배치 규칙은?',
        choices: [
          { text: '왼쪽 < 부모 < 오른쪽', correct: true },
          { text: '규칙 없이 채운다', leadsTo: 3 },
          { text: '항상 왼쪽부터 채운다', leadsTo: 3 },
          { text: '높이 순으로 배치한다', leadsTo: 1 },
        ],
        rationale:
          '이 규칙 덕분에 탐색 범위를 지속해서 줄일 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '이진탐색트리면 탐색이 O(log N)인가?',
        choices: [
          { text: '그렇다. 노드 수만 적으면 된다', leadsTo: 1 },
          { text: '그렇다. 구조 자체가 보장한다', leadsTo: 1 },
          { text: '아니다. 높이에 비례하므로 기울면 O(N)이 된다', correct: true },
          { text: '아니다. 항상 O(N)이다', leadsTo: 0 },
        ],
        rationale:
          '정렬된 데이터가 순서대로 들어오면 편향 트리가 된다.',
      },
      {
        kind: 'boundary',
        stem: '편향을 막는 방법은?',
        choices: [
          { text: '일반 이진트리로 바꿔 정렬 규칙을 없앤다', leadsTo: 4 },
          { text: '삽입 전에 데이터를 무작위로 섞어 순서를 흩는다', leadsTo: 1 },
          { text: '스스로 균형을 맞추는 트리를 쓴다', correct: true },
          { text: '노드 수에 상한을 둬 높이가 자라지 않게 한다', leadsTo: 1 },
        ],
        rationale:
          '단순 이진트리는 모든 노드를 확인해야 해 O(N)이 걸린다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '그래프를 인접 행렬과 인접 리스트 중 어떤 방식으로 구현해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '두 정점의 연결 여부를 상수 시간에 보는 쪽은?',
        choices: [
          { text: '인접 리스트', leadsTo: 3 },
          { text: '인접 행렬', correct: true },
          { text: '둘 다 상수 시간이다', leadsTo: 3 },
          { text: '둘 다 O(V)다', leadsTo: 3 },
        ],
        rationale:
          '인접 리스트는 리스트를 순회해야 해서 degree(V)만큼 걸린다.',
      },
      {
        kind: 'misconception',
        stem: '인접 행렬이 조회가 빠르니 기본으로 쓰면 되는가?',
        choices: [
          { text: '그렇다. 공간 복잡도가 더 낫다', leadsTo: 3 },
          { text: '그렇다. 조회 속도가 가장 중요하다', leadsTo: 0 },
          { text: '아니다. 정점이 많고 간선이 적으면 메모리 낭비가 크다', correct: true },
          { text: '아니다. 대신 인접 행렬은 쓸 일이 없다', leadsTo: 0 },
        ],
        rationale:
          '공간 복잡도가 O(V²)라 희소 그래프에서는 대부분이 빈칸이다.',
      },
      {
        kind: 'boundary',
        stem: '실무에서 인접 리스트를 주로 쓰는 이유는?',
        choices: [
          { text: '구현이 항상 더 쉬워서', leadsTo: 1 },
          { text: '정점 수에 비해 간선 수가 적은 희소 그래프가 많다', correct: true },
          { text: '간선 존재 확인이 더 빨라서', leadsTo: 0 },
          { text: '정점 수 제한이 없어서', leadsTo: 1 },
        ],
        rationale:
          '간선의 밀도와 주된 연산 목적으로 고른다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '다익스트라와 벨만-포드 알고리즘은 언제 구분하여 쓰는가?',
    items: [
      {
        kind: 'concept',
        stem: '다익스트라가 음수 가중치에서 오동작하는 이유는?',
        choices: [
          { text: '간선을 한 번만 보기 때문이다', leadsTo: 3 },
          { text: '우선순위 큐가 음수를 못 담기 때문이다', leadsTo: 0 },
          { text: '이미 방문한 노드의 거리는 변하지 않는다고 가정하기 때문이다', correct: true },
          { text: '사이클을 감지하지 못하기 때문이다', leadsTo: 1 },
        ],
        rationale:
          '음수 간선이 있으면 확정한 거리가 나중에 더 줄어들 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '벨만-포드를 돌리면 모든 음수 사이클을 찾는가?',
        choices: [
          { text: '아니다. 음수 사이클은 못 찾는다', leadsTo: 1 },
          { text: '그렇다. 그래프 전체를 검사한다', leadsTo: 1 },
          { text: '그렇다. V번 반복하면 전부 드러난다', leadsTo: 1 },
          { text: '아니다. 시작점에서 닿을 수 있는 것만 찾는다', correct: true },
        ],
        rationale:
          'V번째 완화에서도 값이 바뀌면 닿을 수 있는 음수 사이클로 본다.',
      },
      {
        kind: 'boundary',
        stem: '다익스트라가 더 빠른 이유는?',
        choices: [
          { text: '사이클을 건너뛰기 때문이다', leadsTo: 1 },
          { text: '간선을 한 번씩만 보기 때문이다', leadsTo: 0 },
          { text: '정점 수와 무관하기 때문이다', leadsTo: 3 },
          { text: '우선순위 큐로 모든 간선을 거듭 도는 비용을 피한다', correct: true },
        ],
        rationale:
          '벨만-포드는 매 단계 모든 간선을 확인하고 이를 노드 수만큼 반복한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '재귀 호출 대신 반복문을 써야 하는 순간은 언제인가?',
    items: [
      {
        kind: 'concept',
        stem: '재귀가 스택에 쌓는 것은?',
        choices: [
          { text: '결과값만', leadsTo: 2 },
          { text: '매개변수와 지역 변수와 복귀 주소', correct: true },
          { text: '함수 코드 전체', leadsTo: 2 },
          { text: '아무것도 쌓지 않는다', leadsTo: 1 },
        ],
        rationale:
          '반복문은 동일 스택 프레임 안에서 변수만 갱신한다.',
      },
      {
        kind: 'misconception',
        stem: '재귀는 언제나 반복문으로 바꾸는 편이 나은가?',
        choices: [
          { text: '아니다. 대신 재귀가 항상 낫다', leadsTo: 2 },
          { text: '그렇다. 재귀는 항상 느리다', leadsTo: 0 },
          { text: '그렇다. 오버플로우 위험이 늘 있다', leadsTo: 2 },
          { text: '아니다. 깊이가 얕으면 그대로 두는 편이 읽기 좋다', correct: true },
        ],
        rationale:
          '가독성은 높지만 호출마다 오버헤드가 붙는다는 것이 맞바꾸는 지점이다.',
      },
      {
        kind: 'boundary',
        stem: '반복문으로 바꿔야 하는 조건은?',
        choices: [
          { text: '입력이 정렬돼 있어 순서대로 돌 수 있을 때', leadsTo: 4 },
          { text: '재귀 함수의 줄 수가 많아 읽기 어려울 때', leadsTo: 1 },
          { text: '기저 조건이 여러 개라 분기가 늘어날 때', leadsTo: 1 },
          { text: '꼬리 재귀가 없고 깊이가 한도를 넘길 때', correct: true },
        ],
        rationale:
          '호출 횟수가 입력 크기에 비례해 커지면 스택 영역 한도를 넘길 수 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '최소 신장 트리(MST)를 구성하는 알고리즘으로 무엇을 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '크루스칼이 사이클을 검사하는 도구는?',
        choices: [
          { text: 'Union-Find', correct: true },
          { text: '우선순위 큐', leadsTo: 1 },
          { text: '깊이 우선 탐색만', leadsTo: 0 },
          { text: '인접 행렬', leadsTo: 0 },
        ],
        rationale:
          '크루스칼은 가중치가 낮은 간선부터 연결하며 사이클을 피한다.',
      },
      {
        kind: 'misconception',
        stem: '프림은 정점 위주라 정점의 값을 보고 고르는가?',
        choices: [
          { text: '아니다. 트리 안팎을 잇는 간선의 가중치를 본다', correct: true },
          { text: '그렇다. 정점 가중치가 기준이다', leadsTo: 1 },
          { text: '그렇다. 정점 번호 순으로 고른다', leadsTo: 3 },
          { text: '아니다. 대신 간선을 정렬해 둔다', leadsTo: 0 },
        ],
        rationale:
          '가장 작은 간선을 골라 그 바깥 정점을 끌어들인다.',
      },
      {
        kind: 'boundary',
        stem: '밀집 그래프에 유리한 쪽은?',
        choices: [
          { text: '프림', correct: true },
          { text: '크루스칼', leadsTo: 0 },
          { text: '둘이 같다', leadsTo: 1 },
          { text: '어느 쪽도 쓸 수 없다', leadsTo: 4 },
        ],
        rationale:
          '간선 수가 적은 희소 그래프에서는 크루스칼이 구현과 계산 면에서 유리하다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '문자열 검색 효율을 높이는 최적의 자료구조는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '트라이의 탐색 시간은 무엇에 비례하는가?',
        choices: [
          { text: '검색하려는 문자열의 길이', correct: true },
          { text: '저장된 단어 수', leadsTo: 3 },
          { text: '트리의 높이와 무관하다', leadsTo: 0 },
          { text: '알파벳 크기', leadsTo: 0 },
        ],
        rationale:
          'O(L)이며 데이터셋의 크기와 상관없이 일정하게 유지된다.',
      },
      {
        kind: 'misconception',
        stem: '문자열 검색이면 트라이가 정답인가?',
        choices: [
          { text: '그렇다. 모든 문자열 검색에 트라이가 낫다', leadsTo: 3 },
          { text: '아니다. 텍스트 안에서 패턴을 찾을 때는 KMP나 라빈-카프를 쓴다', correct: true },
          { text: '그렇다. 해시 맵보다 항상 빠르다', leadsTo: 3 },
          { text: '아니다. 대신 해시 맵이 항상 낫다', leadsTo: 3 },
        ],
        rationale:
          '트라이는 여러 단어를 빠르게 검색하거나 자동완성에 적합하다.',
      },
      {
        kind: 'boundary',
        stem: '트라이가 탐색을 줄이는 원리는?',
        choices: [
          { text: '전체 문자열을 키로 해싱한다', leadsTo: 3 },
          { text: '공통 접두사를 노드로 공유해 중복 탐색을 피한다', correct: true },
          { text: '문자열을 정렬해 둔다', leadsTo: 0 },
          { text: '가장 긴 문자열을 먼저 본다', leadsTo: 4 },
        ],
        rationale:
          '같은 시작 문자를 가진 단어들은 같은 경로를 따라간다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '그리디 알고리즘과 동적 계획법은 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: '그리디가 답을 놓치는 문제의 성격은?',
        choices: [
          { text: '입력이 큰 문제', leadsTo: 3 },
          { text: '부분 문제가 겹치는 문제', leadsTo: 1 },
          { text: '지금 이득인 선택이 나중을 막는 문제', correct: true },
          { text: '경우의 수를 세는 문제', leadsTo: 4 },
        ],
        rationale:
          '그리디는 매 순간 가장 이득인 것을 고르고 뒤를 돌아보지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '동적 계획법은 메모이제이션을 뜻하는가?',
        choices: [
          { text: '아니다. 대신 저장을 하지 않는다', leadsTo: 1 },
          { text: '그렇다. 저장 방식은 하나뿐이다', leadsTo: 2 },
          { text: '그렇다. 재귀 없이는 쓸 수 없다', leadsTo: 2 },
          { text: '아니다. 아래에서 위로 표를 채우는 방식도 있다', correct: true },
        ],
        rationale:
          '작은 문제의 답을 저장해 중복 계산을 없애는 것이 핵심이다.',
      },
      {
        kind: 'boundary',
        stem: '동적 계획법은 최적화 문제에만 쓰는가?',
        choices: [
          { text: '아니다. 대신 정렬에만 쓴다', leadsTo: 2 },
          { text: '그렇다. 최솟값과 최댓값 전용이다', leadsTo: 2 },
          { text: '그렇다. 그리디로 못 푸는 최적화 전용이다', leadsTo: 4 },
          { text: '아니다. 경우의 수 세기에도 쓴다', correct: true },
        ],
        rationale:
          '최적 부분 구조와 겹치는 부분 문제가 있는지를 먼저 확인하게 만든다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '배열보다 연결 리스트를 사용하는 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '연결 리스트가 삽입·삭제에서 아끼는 것은?',
        choices: [
          { text: '메모리 할당', leadsTo: 2 },
          { text: '나머지 요소를 밀고 당기는 이동', correct: true },
          { text: '탐색 시간', leadsTo: 3 },
          { text: '캐시 적재', leadsTo: 2 },
        ],
        rationale:
          '앞뒤 노드의 주소값만 바꿔주면 된다.',
      },
      {
        kind: 'misconception',
        stem: '탐색이 잦아도 리스트가 유리한가?',
        choices: [
          { text: '그렇다. 노드를 따라가면 되니 비슷하다', leadsTo: 2 },
          { text: '아니다. 캐시 지역성 때문에 단순 탐색은 배열이 대개 빠르다', correct: true },
          { text: '그렇다. 메모리를 덜 써서 더 빠르다', leadsTo: 2 },
          { text: '아니다. 대신 배열은 탐색도 느리다', leadsTo: 3 },
        ],
        rationale:
          '배열은 연속된 메모리 공간을 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '무엇을 먼저 따져야 하는가?',
        choices: [
          { text: '데이터의 총 개수', leadsTo: 3 },
          { text: '데이터 변경 빈도', correct: true },
          { text: '자료형의 크기', leadsTo: 2 },
          { text: '정렬 여부', leadsTo: 3 },
        ],
        rationale:
          '추가와 삭제가 빈번하고 순차 탐색으로 무방할 때 리스트가 유리하다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '스택과 큐의 가장 큰 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '입출력 지점은 어떻게 다른가?',
        choices: [
          { text: '둘 다 한쪽 끝에서만 한다', leadsTo: 3 },
          { text: '스택은 한쪽 끝에서만, 큐는 입구와 출구가 다르다', correct: true },
          { text: '둘 다 입구와 출구가 다르다', leadsTo: 3 },
          { text: '스택만 입구와 출구가 다르다', leadsTo: 3 },
        ],
        rationale:
          '스택은 LIFO, 큐는 FIFO로 나가는 순서가 갈린다.',
      },
      {
        kind: 'misconception',
        stem: '둘 다 삽입·삭제가 O(1)이니 구현은 신경 안 써도 되는가?',
        choices: [
          { text: '그렇다. 배열이 항상 유리하다', leadsTo: 1 },
          { text: '그렇다. 어떤 구현이든 O(1)이다', leadsTo: 1 },
          { text: '아니다. 큐를 배열로 구현하면 앞을 지울 때 당기는 비용이 생긴다', correct: true },
          { text: '아니다. 대신 스택 쪽에 문제가 생긴다', leadsTo: 0 },
        ],
        rationale:
          '그래서 원형 큐를 주로 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스 스케줄링에 맞는 쪽은?',
        choices: [
          { text: '큐', correct: true },
          { text: '스택', leadsTo: 4 },
          { text: '둘 다 같다', leadsTo: 2 },
          { text: '어느 쪽도 아니다', leadsTo: 2 },
        ],
        rationale:
          '스택은 되돌리기나 함수 호출 스택처럼 최근 상태를 기억할 때 쓴다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '그래프 구현 시 인접 행렬과 인접 리스트 중 무엇을 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '간선 삭제 비용은 어떻게 다른가?',
        choices: [
          { text: '둘 다 O(1)이다', leadsTo: 0 },
          { text: '행렬은 O(1)이고 리스트는 O(degree(V))다', correct: true },
          { text: '둘 다 O(V+E)다', leadsTo: 0 },
          { text: '행렬이 더 느리다', leadsTo: 0 },
        ],
        rationale:
          '간선 추가는 둘 다 O(1)이지만 삭제에서 갈린다.',
      },
      {
        kind: 'misconception',
        stem: '희소 그래프가 많으니 행렬은 쓸 일이 없는가?',
        choices: [
          { text: '그렇다. 리스트가 언제나 낫다', leadsTo: 0 },
          { text: '아니다. 완전 그래프라면 행렬이 유리하다', correct: true },
          { text: '그렇다. 행렬은 빈칸에 메모리만 쓴다', leadsTo: 0 },
          { text: '아니다. 대신 행렬이 항상 낫다', leadsTo: 0 },
        ],
        rationale:
          '희소 그래프에서는 O(V²) 대신 O(V+E)만큼의 공간을 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '정점이 늘 때 행렬이 겪는 문제는?',
        choices: [
          { text: '메모리 낭비가 심해진다', correct: true },
          { text: '연결 확인이 느려진다', leadsTo: 0 },
          { text: '간선 추가가 불가능해진다', leadsTo: 1 },
          { text: '가중치를 담을 수 없다', leadsTo: 1 },
        ],
        rationale:
          '공간 복잡도가 O(V^2)이기 때문이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '공유 자료구조를 Thread-Safe하게 만드는 방법은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: 'CAS는 어떤 조건에서 값을 바꾸는가?',
        choices: [
          { text: '락을 획득했을 때만', leadsTo: 0 },
          { text: '현재 값과 예상 값이 일치할 때만', correct: true },
          { text: '다른 스레드가 없을 때만', leadsTo: 2 },
          { text: '언제나 바꾼다', leadsTo: 1 },
        ],
        rationale:
          '락을 쓰지 않는 논블로킹 알고리즘으로 구현된다.',
      },
      {
        kind: 'misconception',
        stem: '논블로킹이면 비용이 없는가?',
        choices: [
          { text: '그렇다. 컨텍스트 스위칭이 없어 부담이 없다', leadsTo: 1 },
          { text: '그렇다. 대기가 없으니 공짜다', leadsTo: 1 },
          { text: '아니다. 스핀락으로 CPU 점유율이 올라간다', correct: true },
          { text: '아니다. 대신 구현이 더 쉽다', leadsTo: 0 },
        ],
        rationale:
          '동기화 블록은 대기 전환 비용을, CAS는 점유 비용을 치른다.',
      },
      {
        kind: 'boundary',
        stem: '읽기가 많은 자리에서는 무엇을 쓰는가?',
        choices: [
          { text: 'CAS로 읽기도 처리한다', leadsTo: 1 },
          { text: '모든 접근을 synchronized로 감싼다', leadsTo: 0 },
          { text: '읽기-쓰기 락으로 나눠 읽기끼리는 막지 않게 한다', correct: true },
          { text: '스레드마다 사본을 둔다', leadsTo: 4 },
        ],
        rationale:
          '아예 안 바뀌게 하거나 스레드마다 따로 두는 길도 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '해시 충돌을 해결하는 두 방식의 차이는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '저장 위치는 어떻게 갈리는가?',
        choices: [
          { text: '체이닝은 버킷 외부, 개방 주소법은 버킷 내부', correct: true },
          { text: '둘 다 버킷 내부', leadsTo: 4 },
          { text: '둘 다 버킷 외부', leadsTo: 4 },
          { text: '체이닝이 버킷 내부', leadsTo: 4 },
        ],
        rationale:
          '체이닝은 추가 할당이 필요하고 개방 주소법은 정해진 크기 안에서 쓴다.',
      },
      {
        kind: 'misconception',
        stem: '개방 주소법은 메모리 효율이 좋으니 항상 나은가?',
        choices: [
          { text: '그렇다. 추가 할당이 없어 유리하다', leadsTo: 1 },
          { text: '아니다. 데이터가 찰수록 빈 칸을 찾는 비용이 커진다', correct: true },
          { text: '그렇다. 클러스터링은 성능과 무관하다', leadsTo: 3 },
          { text: '아니다. 대신 체이닝이 항상 낫다', leadsTo: 0 },
        ],
        rationale:
          '특정 영역에 데이터가 뭉치면 성능이 급격히 떨어진다.',
      },
      {
        kind: 'boundary',
        stem: '데이터 양을 예측할 수 없다면?',
        choices: [
          { text: '체이닝', correct: true },
          { text: '개방 주소법', leadsTo: 1 },
          { text: '둘 다 불가능하다', leadsTo: 1 },
          { text: '해시 테이블을 쓰지 않는다', leadsTo: 2 },
        ],
        rationale:
          '체이닝은 데이터가 계속 늘어나도 저장할 수 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '해시 충돌이 생기면 어떤 방법으로 푸는가?',
    items: [
      {
        kind: 'concept',
        stem: '오픈 어드레싱에서 삭제가 까다로운 이유는?',
        choices: [
          { text: '해시 함수를 다시 계산해야 하기 때문이다', leadsTo: 2 },
          { text: '리스트에서 노드를 떼야 하기 때문이다', leadsTo: 1 },
          { text: '삭제 마커가 필요하기 때문이다', correct: true },
          { text: '삭제 자체가 불가능하기 때문이다', leadsTo: 1 },
        ],
        rationale:
          '그냥 비우면 그 뒤에 밀려 저장된 값을 찾지 못한다.',
      },
      {
        kind: 'misconception',
        stem: '체이닝이면 탐색이 항상 빠른가?',
        choices: [
          { text: '그렇다. 버킷 수와 무관하다', leadsTo: 0 },
          { text: '그렇다. 리스트라 항상 상수 시간이다', leadsTo: 4 },
          { text: '아니다. 리스트가 길어지면 O(1)에서 O(n)으로 늘어난다', correct: true },
          { text: '아니다. 대신 삽입이 느려진다', leadsTo: 2 },
        ],
        rationale:
          '대신 데이터가 계속 늘어나도 수용할 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '오픈 어드레싱의 성능 저하를 막는 관리 항목은?',
        choices: [
          { text: '로드 팩터를 관리하고 리사이징을 수행한다', correct: true },
          { text: '리스트 길이를 제한한다', leadsTo: 1 },
          { text: '삭제를 하지 않는다', leadsTo: 3 },
          { text: '버킷 수를 고정한다', leadsTo: 0 },
        ],
        rationale:
          '데이터가 꽉 찰수록 충돌이 잦아져 성능이 급격히 떨어진다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '해시 충돌이 발생했을 때의 해결책은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '선형 탐색이 만드는 문제는?',
        choices: [
          { text: '데이터가 뭉치는 클러스터링', correct: true },
          { text: '메모리 오버헤드', leadsTo: 0 },
          { text: '삭제 불가', leadsTo: 4 },
          { text: '해시 함수 재계산', leadsTo: 1 },
        ],
        rationale:
          '2차 해시 함수를 쓰거나 무작위로 탐색해 뭉침을 흩는다.',
      },
      {
        kind: 'misconception',
        stem: '버킷을 트리로 바꾸는 것은 해시 테이블의 일반 동작인가?',
        choices: [
          { text: '그렇다. 표준으로 정해져 있다', leadsTo: 2 },
          { text: '그렇다. 모든 해시 테이블이 그렇게 한다', leadsTo: 2 },
          { text: '아니다. 자바 8 이후 HashMap 같은 일부 구현의 이야기다', correct: true },
          { text: '아니다. 어떤 구현도 그렇게 하지 않는다', leadsTo: 2 },
        ],
        rationale:
          '한 버킷이 임계치를 넘으면 리스트를 레드-블랙 트리로 바꾸는 구현이 있다.',
      },
      {
        kind: 'boundary',
        stem: '두 방식이 치르는 대가는 각각 무엇인가?',
        choices: [
          { text: '체이닝이 클러스터링을 겪는다', leadsTo: 3 },
          { text: '둘 다 메모리 오버헤드', leadsTo: 3 },
          { text: '둘 다 클러스터링', leadsTo: 3 },
          { text: '체이닝은 메모리 오버헤드, 오픈 어드레싱은 클러스터링', correct: true },
        ],
        rationale:
          '체이닝은 버킷 밖에, 오픈 어드레싱은 배열 안에 담는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '최단 경로 알고리즘의 선택 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '가중치가 없을 때 가장 빠른 것은?',
        choices: [
          { text: '다익스트라', leadsTo: 4 },
          { text: 'BFS', correct: true },
          { text: '벨만-포드', leadsTo: 1 },
          { text: '어느 쪽도 못 쓴다', leadsTo: 3 },
        ],
        rationale:
          '모든 노드를 동일한 거리로 계산하기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '간선에 0이 있으면 다익스트라를 못 쓰는가?',
        choices: [
          { text: '그렇다. 벨만-포드로 바꿔야 한다', leadsTo: 1 },
          { text: '그렇다. 양수만 허용된다', leadsTo: 0 },
          { text: '아니다. 0인 간선은 있어도 된다', correct: true },
          { text: '아니다. 대신 BFS를 써야 한다', leadsTo: 3 },
        ],
        rationale:
          '문제가 되는 것은 음수 가중치다.',
      },
      {
        kind: 'boundary',
        stem: '시작점에서 닿는 음수 사이클이 있으면?',
        choices: [
          { text: '다익스트라로 우회하면 된다', leadsTo: 0 },
          { text: '벨만-포드가 대신 최단 거리를 구해 준다', leadsTo: 1 },
          { text: '최단 거리 자체가 없고 벨만-포드는 그것을 알려 줄 뿐이다', correct: true },
          { text: '사이클을 무시하고 계산한다', leadsTo: 1 },
        ],
        rationale:
          '돌수록 거리가 줄어드니 최솟값이 정해지지 않는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '문자열 검색 최적화 시 어떤 기준으로 알고리즘을 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: 'KMP가 비교를 줄이는 원리는?',
        choices: [
          { text: '텍스트를 정렬해 둔다', leadsTo: 1 },
          { text: '해시 값으로 먼저 걸러낸다', leadsTo: 2 },
          { text: '패턴 내부의 반복 구조를 미리 계산해 건너뛴다', correct: true },
          { text: '접두사를 트리로 공유한다', leadsTo: 0 },
        ],
        rationale:
          '텍스트를 되돌아가지 않아 각 글자를 거듭 비교하지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '라빈-카프는 해시를 쓰니 항상 빠른가?',
        choices: [
          { text: '아니다. 대신 KMP보다 항상 느리다', leadsTo: 1 },
          { text: '그렇다. 항상 평균 시간으로 끝난다', leadsTo: 2 },
          { text: '그렇다. 해시가 충돌하지 않는다', leadsTo: 2 },
          { text: '아니다. 최악에는 O(nm)까지 간다', correct: true },
        ],
        rationale:
          '해시가 일치할 때만 실제 문자열을 대조하기 때문이다.',
      },
      {
        kind: 'boundary',
        stem: '트라이를 쓸 때 감수하는 것은?',
        choices: [
          { text: '한 번에 하나의 패턴만 찾는다', leadsTo: 3 },
          { text: '검색이 문자열 길이보다 오래 걸린다', leadsTo: 0 },
          { text: '접두사를 공유하지 못한다', leadsTo: 0 },
          { text: '각 노드의 포인터 배열이 메모리를 많이 쓴다', correct: true },
        ],
        rationale:
          '한 번 구축하면 검색 시간이 문자열 길이에 비례한다는 대가다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '스택과 큐는 어떤 상황에서 구분해 쓰는가?',
    items: [
      {
        kind: 'concept',
        stem: '큐의 두 연산 이름은?',
        choices: [
          { text: 'enqueue와 dequeue', correct: true },
          { text: 'push와 pop', leadsTo: 0 },
          { text: 'insert와 delete', leadsTo: 2 },
          { text: 'add와 remove만', leadsTo: 2 },
        ],
        rationale:
          '스택은 push와 pop으로 한쪽 끝에서만 넣고 뺀다.',
      },
      {
        kind: 'misconception',
        stem: '큐를 배열로 구현하면 삭제도 O(1)인가?',
        choices: [
          { text: '그렇다. 배열이 가장 빠르다', leadsTo: 1 },
          { text: '그렇다. 인덱스만 옮기면 된다', leadsTo: 1 },
          { text: '아니다. 데이터 시프팅이 발생한다', correct: true },
          { text: '아니다. 대신 삽입이 느려진다', leadsTo: 1 },
        ],
        rationale:
          '원형 큐나 연결 리스트로 구현하면 요소를 옮기는 비용이 사라진다.',
      },
      {
        kind: 'boundary',
        stem: '스택과 큐가 각각 맡는 역할을 한마디로 하면?',
        choices: [
          { text: '둘 다 흐름 제어', leadsTo: 0 },
          { text: '스택은 흐름 제어, 큐는 맥락 유지', leadsTo: 0 },
          { text: '둘 다 맥락 유지', leadsTo: 3 },
          { text: '스택은 맥락 유지, 큐는 흐름 제어', correct: true },
        ],
        rationale:
          '큐는 요청이 몰릴 때 부하를 조절하는 버퍼 역할을 한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '트라이를 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '트라이는 키를 어떻게 찾는가?',
        choices: [
          { text: '정렬된 배열을 이진 탐색한다', leadsTo: 4 },
          { text: '키 전체를 해싱한다', leadsTo: 2 },
          { text: '키 전체를 비교한다', leadsTo: 2 },
          { text: '문자 경로를 따라간다', correct: true },
        ],
        rationale:
          '검색 속도가 문자열 길이만큼으로 줄어든다.',
      },
      {
        kind: 'misconception',
        stem: '평균 O(1)인 해시 맵이 항상 나은가?',
        choices: [
          { text: '그렇다. 평균이 더 빠르면 항상 낫다', leadsTo: 2 },
          { text: '아니다. 최악에는 충돌로 떨어지지만 트라이는 O(L)을 보장한다', correct: true },
          { text: '그렇다. 트라이는 최악이 더 나쁘다', leadsTo: 2 },
          { text: '아니다. 대신 트라이가 메모리도 적게 쓴다', leadsTo: 0 },
        ],
        rationale:
          '보장하는 최악값이 다르다는 것이 갈리는 지점이다.',
      },
      {
        kind: 'boundary',
        stem: '트라이가 특히 맞는 기능은?',
        choices: [
          { text: '범위 합계 계산', leadsTo: 4 },
          { text: '단건 키 조회', leadsTo: 2 },
          { text: '자동 완성이나 사전 검색', correct: true },
          { text: '정렬', leadsTo: 4 },
        ],
        rationale:
          '공통 접두사를 공유하는 구조 덕분이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '이진 탐색 트리를 사용하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '정렬된 배열과 비교했을 때 이진 탐색 트리가 나은 연산은?',
        choices: [
          { text: '순회', leadsTo: 1 },
          { text: '탐색', leadsTo: 3 },
          { text: '삽입과 삭제', correct: true },
          { text: '모든 연산', leadsTo: 0 },
        ],
        rationale:
          '균형이 잡혀 있으면 탐색은 정렬된 배열의 이진 탐색과 같은 O(log n)이다.',
      },
      {
        kind: 'misconception',
        stem: '트리로 바꾸면 정렬된 배열보다 항상 빠른가?',
        choices: [
          { text: '아니다. 대신 삽입만 느려진다', leadsTo: 4 },
          { text: '그렇다. 구조가 더 유연해서 빠르다', leadsTo: 0 },
          { text: '그렇다. 탐색이 늘 절반씩 줄어든다', leadsTo: 0 },
          { text: '아니다. 기울면 O(n)이 되어 오히려 느리다', correct: true },
        ],
        rationale:
          '데이터가 정렬된 순서로 들어오면 편향 트리가 된다.',
      },
      {
        kind: 'boundary',
        stem: '편향을 스스로 막는 트리는?',
        choices: [
          { text: 'AVL 트리나 레드-블랙 트리', correct: true },
          { text: '완전 이진 트리', leadsTo: 2 },
          { text: '편향 트리', leadsTo: 0 },
          { text: '이진 탐색 트리 자체가 막는다', leadsTo: 2 },
        ],
        rationale:
          '넣고 지울 때 높이를 조절해 최악을 O(log n)으로 묶는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '재귀 함수 사용 시 스택 오버플로가 발생하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '호출할 때마다 쌓이는 것은?',
        choices: [
          { text: '전역 변수', leadsTo: 4 },
          { text: '힙에 할당된 객체', leadsTo: 4 },
          { text: '스택 프레임', correct: true },
          { text: '프로그램의 기계어', leadsTo: 4 },
        ],
        rationale:
          '각 호출은 이전 상태를 기억해야 하므로 공간을 계속 점유한다.',
      },
      {
        kind: 'misconception',
        stem: '스택이 힙에 부딪혀서 터지는가?',
        choices: [
          { text: '그렇다. 힙이 비어 있으면 안 터진다', leadsTo: 4 },
          { text: '그렇다. 두 영역이 만나면 터진다', leadsTo: 4 },
          { text: '아니다. 미리 정해진 스택 크기를 넘는 순간 걸린다', correct: true },
          { text: '아니다. 대신 전체 메모리가 다 차야 터진다', leadsTo: 4 },
        ],
        rationale:
          '스택마다 쓸 수 있는 크기가 미리 정해져 있다.',
      },
      {
        kind: 'boundary',
        stem: '반복문이 항상 나은가?',
        choices: [
          { text: '그렇다. 메모리 효율이 높으니 늘 낫다', leadsTo: 1 },
          { text: '아니다. 트리나 그래프 같은 계층 구조 탐색에는 재귀가 읽기 좋다', correct: true },
          { text: '그렇다. 재귀는 쓸 이유가 없다', leadsTo: 1 },
          { text: '아니다. 대신 재귀가 항상 빠르다', leadsTo: 3 },
        ],
        rationale:
          '반복문은 추가 스택 프레임이 없어 메모리 효율이 높다는 것이 맞바꾸는 지점이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '우선순위 큐를 힙으로 구현하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '힙에서 삽입과 삭제의 시간 복잡도는?',
        choices: [
          { text: '둘 다 O(log N)', correct: true },
          { text: '삽입 O(1), 삭제 O(N)', leadsTo: 2 },
          { text: '둘 다 O(N)', leadsTo: 2 },
          { text: '둘 다 O(1)', leadsTo: 2 },
        ],
        rationale:
          '완전 이진 트리 구조라 높이가 눌려 있다.',
      },
      {
        kind: 'misconception',
        stem: '정렬해 두면 우선순위 큐로 충분한가?',
        choices: [
          { text: '그렇다. 삽입도 상수 시간이다', leadsTo: 0 },
          { text: '그렇다. 꺼내기만 하면 되니 빠르다', leadsTo: 0 },
          { text: '아니다. 넣을 자리를 만드느라 O(N)이 든다', correct: true },
          { text: '아니다. 대신 꺼내기가 O(N)이 된다', leadsTo: 1 },
        ],
        rationale:
          '정렬하지 않으면 넣기는 싸지만 가장 급한 것을 찾는 데 O(N)이 든다.',
      },
      {
        kind: 'boundary',
        stem: '힙이 맞는 환경은?',
        choices: [
          { text: '우선순위가 계속 바뀌는 곳', correct: true },
          { text: '한 번 정렬하고 읽기만 하는 곳', leadsTo: 1 },
          { text: '순서가 상관없는 곳', leadsTo: 0 },
          { text: '데이터가 아주 적은 곳', leadsTo: 2 },
        ],
        rationale:
          '다익스트라 알고리즘이나 OS의 스케줄러가 그런 자리다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'B-tree는 왜 디스크에 유리한가?',
    items: [
      {
        kind: 'concept',
        stem: '갈래를 백으로 늘리면 백만 건에 몇 번이면 닿는가?',
        choices: [
          { text: '셋', correct: true },
          { text: '스물', leadsTo: 0 },
          { text: '백', leadsTo: 0 },
          { text: '천', leadsTo: 0 },
        ],
        rationale:
          '균형 잡힌 이진 트리도 백만 건이면 깊이가 스물이다.',
      },
      {
        kind: 'misconception',
        stem: '읽기 횟수가 항상 깊이만큼인가?',
        choices: [
          { text: '그렇다. 캐시는 색인에 쓰이지 않는다', leadsTo: 2 },
          { text: '그렇다. 매번 깊이만큼 읽는다', leadsTo: 2 },
          { text: '아니다. 위쪽 노드는 대개 버퍼 캐시에 남아 실제 읽기는 더 적다', correct: true },
          { text: '아니다. 대신 항상 한 번만 읽는다', leadsTo: 0 },
        ],
        rationale:
          '캐시가 비어 있을 때라야 깊이만큼 디스크를 읽는다.',
      },
      {
        kind: 'boundary',
        stem: '최악에도 O(log n)을 지키는 이유는?',
        choices: [
          { text: '위쪽 노드가 캐시에 채워져 있어서', leadsTo: 2 },
          { text: '노드가 커서 균형이 필요 없다', leadsTo: 0 },
          { text: '디스크가 한 번에 블록 단위로 읽어서', leadsTo: 3 },
          { text: '노드를 쪼개고 합쳐 잎을 같은 깊이에 둔다', correct: true },
        ],
        rationale:
          '메모리만 쓰는 색인에서는 블록 이점이 줄어든다.',
      },
    ],
  },
  {
    identityScope: 'datastructure',
    question: 'B-Tree가 디스크에 맞는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '노드 하나의 크기를 무엇에 맞추는가?',
        choices: [
          { text: '키 하나의 크기', leadsTo: 1 },
          { text: '디스크 블록 크기', correct: true },
          { text: '캐시 라인 크기', leadsTo: 1 },
          { text: '전체 트리 크기', leadsTo: 1 },
        ],
        rationale:
          '한 번 읽어 온 블록 안에서 여러 번 비교하므로 내려가는 횟수가 준다.',
      },
      {
        kind: 'misconception',
        stem: 'B-Tree는 비교 횟수도 줄여 주는가?',
        choices: [
          { text: '아니다. 총 비교 횟수는 오히려 늘 수도 있다', correct: true },
          { text: '그렇다. 높이가 낮으니 비교도 준다', leadsTo: 1 },
          { text: '그렇다. 둘은 같은 말이다', leadsTo: 1 },
          { text: '아니다. 대신 디스크 읽기도 늘어난다', leadsTo: 1 },
        ],
        rationale:
          '줄이는 것은 디스크 읽기 횟수다.',
      },
      {
        kind: 'boundary',
        stem: '메모리 안에서만 논다면?',
        choices: [
          { text: '똑같다', leadsTo: 4 },
          { text: '이점이 더 커진다', leadsTo: 4 },
          { text: '이점이 거의 없어 다른 구조를 쓴다', correct: true },
          { text: '아예 쓸 수 없다', leadsTo: 4 },
        ],
        rationale:
          '읽어 오는 값이 싸기 때문이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '메모리보다 큰 데이터를 정렬할 때 무엇을 쓰는가?',
    items: [
      {
        kind: 'concept',
        stem: '메모리에 올릴 만큼 읽어 정렬해 저장한 조각을 무엇이라 하는가?',
        choices: [
          { text: '페이지', leadsTo: 0 },
          { text: '블록', leadsTo: 0 },
          { text: '버퍼', leadsTo: 3 },
          { text: '런', correct: true },
        ],
        rationale:
          '이후 여러 런을 동시에 읽으며 가장 작은 값을 결과 파일에 쓴다.',
      },
      {
        kind: 'misconception',
        stem: '전체 시간을 좌우하는 것은 비교 횟수인가?',
        choices: [
          { text: '그렇다. 힙 연산 비용이 지배한다', leadsTo: 1 },
          { text: '그렇다. 정렬은 비교가 전부다', leadsTo: 3 },
          { text: '아니다. 디스크를 읽고 쓰는 횟수다', correct: true },
          { text: '아니다. 대신 런의 개수만 본다', leadsTo: 0 },
        ],
        rationale:
          '메모리 버퍼를 키우고 한 번에 병합할 런 수를 조절해 병합 단계 수를 줄인다.',
      },
      {
        kind: 'boundary',
        stem: '병합 단계에서 최소 힙을 쓰는 이유는?',
        choices: [
          { text: '런을 정렬하려고', leadsTo: 0 },
          { text: '여러 런에서 가장 작은 값을 빠르게 고르려고', correct: true },
          { text: '메모리를 아끼려고', leadsTo: 3 },
          { text: '디스크 쓰기를 미루려고', leadsTo: 3 },
        ],
        rationale:
          '병합 속도가 힙으로 올라간다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '메시지 큐를 두면 무엇을 얻고 무엇을 잃는가?',
    items: [
      {
        kind: 'concept',
        stem: '큐를 두어 얻는 가장 큰 이득은?',
        choices: [
          { text: '메시지가 절대 유실되지 않는다', leadsTo: 0 },
          { text: '트래픽이 몰려도 받는 쪽이 자기 속도로 처리한다', correct: true },
          { text: '처리 순서가 항상 보장된다', leadsTo: 2 },
          { text: '중복이 사라진다', leadsTo: 1 },
        ],
        rationale:
          '보내는 쪽과 받는 쪽의 시간을 떼어내는 것이 핵심이다.',
      },
      {
        kind: 'misconception',
        stem: '큐 제품을 고르면 전달 보장이 따라오는가?',
        choices: [
          { text: '그렇다. 제품의 고정 속성이다', leadsTo: 0 },
          { text: '아니다. 영속·복제 설정과 확인과 재전송과 멱등성을 합친 결과다', correct: true },
          { text: '그렇다. 브로커가 알아서 보장한다', leadsTo: 1 },
          { text: '아니다. 어떤 설정으로도 보장할 수 없다', leadsTo: 0 },
        ],
        rationale:
          '먼저 ack하고 죽으면 유실되고, 안전하게 재전송하면 중복이 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '같은 주문의 순서가 필요하면?',
        choices: [
          { text: '컨슈머를 하나만 둬 처리 순서를 직렬로 만든다', leadsTo: 2 },
          { text: '같은 키를 같은 파티션으로 보내고 병렬성을 제한한다', correct: true },
          { text: '파티션을 늘려 각 주문이 따로 흐르게 한다', leadsTo: 2 },
          { text: '큐가 전역 순서를 지키므로 손댈 것이 없다', leadsTo: 2 },
        ],
        rationale:
          '순서는 파티션 수와 컨슈머 병렬성에 따라 달라진다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '캐시를 지우는 일이 어려운 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '원본 반영과 캐시 삭제가 어긋나면?',
        choices: [
          { text: '원본도 함께 되돌아간다', leadsTo: 3 },
          { text: '이전 값이 캐시에 남는다', correct: true },
          { text: '캐시가 비워진다', leadsTo: 1 },
          { text: '아무 일도 없다', leadsTo: 1 },
        ],
        rationale:
          '둘이 서로 다른 실패 단위를 갖기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '삭제가 성공했으면 낡은 값이 다시 들어오지 않는가?',
        choices: [
          { text: '그렇다. 캐시가 순서를 보장한다', leadsTo: 3 },
          { text: '그렇다. 삭제 뒤에는 새 값만 들어온다', leadsTo: 3 },
          { text: '아니다. 먼저 이전 값을 읽은 요청이 뒤늦게 채울 수 있다', correct: true },
          { text: '아니다. 대신 삭제 자체가 무의미하다', leadsTo: 1 },
        ],
        rationale:
          '버전 비교나 조건부 쓰기로 오래된 채우기를 막아야 한다.',
      },
      {
        kind: 'boundary',
        stem: '같은 시각에 많은 키가 만료되지 않게 하려면?',
        choices: [
          { text: 'TTL을 없애고 쓰기가 있을 때만 지운다', leadsTo: 1 },
          { text: 'TTL을 모두 같게 맞춰 만료를 예측 가능하게 한다', leadsTo: 0 },
          { text: 'TTL에 jitter를 주고 동시 재조회는 하나로 합친다', correct: true },
          { text: '주기적으로 캐시를 통째로 비운다', leadsTo: 0 },
        ],
        rationale:
          '캐시는 성능을 돕는 계층이지 원본을 쓰러뜨리는 단일 실패점이 되면 안 된다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '분산 시스템에서 CAP 중 무엇을 포기하게 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '충돌이 실제로 나타나는 구간은?',
        choices: [
          { text: '평상시 모든 요청', leadsTo: 0 },
          { text: '네트워크 분단이 이어지는 동안', correct: true },
          { text: '노드를 늘릴 때', leadsTo: 2 },
          { text: '쓰기가 몰릴 때', leadsTo: 1 },
        ],
        rationale:
          '분단이 없을 때의 지연과 일관성 절충은 PACELC 같은 별도 관점으로 본다.',
      },
      {
        kind: 'misconception',
        stem: '셋 중 둘을 제품 차원에서 한 번 고르는 것인가?',
        choices: [
          { text: '아니다. 대신 셋 다 가질 수 있다', leadsTo: 0 },
          { text: '그렇다. 데이터베이스를 고르면 정해진다', leadsTo: 4 },
          { text: '그렇다. 평상시에도 둘만 갖는다', leadsTo: 0 },
          { text: '아니다. 연산과 업무 규칙에 가깝다', correct: true },
        ],
        rationale:
          '상품 설명 조회와 남은 좌석 확정은 분단 중 다르게 대응할 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '분리된 양쪽이 모두 쓰기를 받으면?',
        choices: [
          { text: '일관성과 함께 가용성도 잃는다', leadsTo: 4 },
          { text: '나중에 자동으로 합쳐진다', leadsTo: 3 },
          { text: '권한이 없는 한쪽이 자동으로 멈춘다', leadsTo: 4 },
          { text: '서로의 최신 값을 알 수 없어 갈라진다', correct: true },
        ],
        rationale:
          '한쪽을 멈추면 일관성은 지키지만 멈춘 쪽의 가용성을 잃는다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '재시도가 있는 시스템에서 멱등성이 필요한 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '응답이 오지 않았다는 사실이 뜻하는 것은?',
        choices: [
          { text: '서버가 처리했다는 것', leadsTo: 1 },
          { text: '서버가 처리하지 않았다는 것', leadsTo: 1 },
          { text: '서버가 처리했는지 알 수 없다는 것', correct: true },
          { text: '요청이 도착하지 않았다는 것', leadsTo: 1 },
        ],
        rationale:
          '그래서 같은 의도의 요청이 다시 와도 추가 효과를 만들지 않는 계약이 필요하다.',
      },
      {
        kind: 'misconception',
        stem: '키가 없는지 확인한 뒤 처리하고 키를 기록하면 되는가?',
        choices: [
          { text: '아니다. 같은 요청 둘이 동시에 그 틈을 지나갈 수 있다', correct: true },
          { text: '그렇다. 순서만 지키면 안전하다', leadsTo: 3 },
          { text: '그렇다. 확인이 먼저면 충분하다', leadsTo: 3 },
          { text: '아니다. 대신 키를 먼저 기록하면 된다', leadsTo: 3 },
        ],
        rationale:
          '키 선점과 업무 변경을 하나의 원자적 경계에 둬야 한다.',
      },
      {
        kind: 'boundary',
        stem: '같은 키에 다른 요청 내용이 오면?',
        choices: [
          { text: '새 작업으로 처리한다', leadsTo: 0 },
          { text: '새 내용으로 덮어쓴다', leadsTo: 0 },
          { text: '이전 결과를 그대로 돌려준다', leadsTo: 0 },
          { text: '재시도로 취급하지 않고 불일치 오류를 낸다', correct: true },
        ],
        rationale:
          '요청 본문만 해시하면 똑같은 주문을 두 번 하려는 경우와 재시도를 구분하지 못한다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '서킷 브레이커는 무엇을 막아주는가?',
    items: [
      {
        kind: 'concept',
        stem: '서킷이 열린 동안 얻는 것은?',
        choices: [
          { text: '스레드와 커넥션을 오래 붙잡지 않는다', correct: true },
          { text: '의존성이 복구된다', leadsTo: 0 },
          { text: '요청이 큐에 쌓인다', leadsTo: 3 },
          { text: '재시도가 자동으로 돈다', leadsTo: 4 },
        ],
        rationale:
          '서킷 브레이커가 의존성을 복구하는 것은 아니다.',
      },
      {
        kind: 'misconception',
        stem: '실패율 기준 하나만 정하면 되는가?',
        choices: [
          { text: '아니다. 대신 시간만 보면 된다', leadsTo: 1 },
          { text: '그렇다. 실패 비율만 보면 충분하다', leadsTo: 1 },
          { text: '그렇다. 몇 번을 불렀는지는 상관없다', leadsTo: 1 },
          { text: '아니다. 최소 호출 수가 없으면 한두 번으로 열린다', correct: true },
        ],
        rationale:
          '윈도와 최소 호출 수, 실패로 셀 예외, 느린 호출 기준을 함께 정한다.',
      },
      {
        kind: 'boundary',
        stem: '반열림에서 확인 호출 수를 제한하는 이유는?',
        choices: [
          { text: '서킷이 너무 빨리 닫히는 것을 늦추려고', leadsTo: 0 },
          { text: '대기 요청을 한꺼번에 보내면 회복 중인 의존성을 다시 무너뜨린다', correct: true },
          { text: '확인 호출이 실패율 계산을 흐리지 않게 하려고', leadsTo: 1 },
          { text: '회복이 빠른지 재시도 횟수로 재려고', leadsTo: 4 },
        ],
        rationale:
          '동시 호출 수 자체를 제한하는 일은 벌크헤드의 몫이다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '노드를 늘릴 때 일관된 해싱이 필요한 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '나머지 연산으로 노드를 고르면 노드 추가 때 무슨 일이 생기는가?',
        choices: [
          { text: '키 절반이 사라진다', leadsTo: 1 },
          { text: '새 노드가 맡을 분량만 옮겨진다', leadsTo: 0 },
          { text: '아무 키도 옮겨지지 않는다', leadsTo: 1 },
          { text: '분모가 바뀌어 대부분의 키가 재배치된다', correct: true },
        ],
        rationale:
          '일관된 해싱은 옮겨야 하는 키를 새 노드가 맡을 분량으로 줄인다.',
      },
      {
        kind: 'misconception',
        stem: '키 이동이 적으면 부하도 고른가?',
        choices: [
          { text: '그렇다. 링 구조가 보장한다', leadsTo: 3 },
          { text: '그렇다. 해시가 균등하니 자동으로 고르다', leadsTo: 0 },
          { text: '아니다. 링의 노드 지점이 적으면 구간 크기가 들쭉날쭉하다', correct: true },
          { text: '아니다. 대신 이동량이 늘어난다', leadsTo: 0 },
        ],
        rationale:
          '가상 노드를 여러 개 두거나 용량에 따라 가중치를 줘 분포를 보정한다.',
      },
      {
        kind: 'boundary',
        stem: '해싱 알고리즘 밖에서 따로 설계해야 하는 것은?',
        choices: [
          { text: '복제본 배치와 핫 키와 재배치 중 읽기·쓰기', correct: true },
          { text: '노드가 맡을 구간 계산', leadsTo: 0 },
          { text: '키의 해시 값', leadsTo: 2 },
          { text: '가상 노드 개수', leadsTo: 0 },
        ],
        rationale:
          '노드 증감이 잦은 분산 캐시와 저장소, 로드 밸런서에 잘 맞는 방식이다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '메시지 순서는 어디까지 보장되는가?',
    items: [
      {
        kind: 'concept',
        stem: '순서가 지켜지는 범위는?',
        choices: [
          { text: '같은 소비자 그룹 안', leadsTo: 2 },
          { text: '토픽 전체', leadsTo: 0 },
          { text: '같은 파티션 안', correct: true },
          { text: '브로커 전체', leadsTo: 0 },
        ],
        rationale:
          '여러 파티션에 흩어진 메시지 사이에는 전역 순서가 없다.',
      },
      {
        kind: 'misconception',
        stem: '같은 파티션이면 처리 순서까지 안전한가?',
        choices: [
          { text: '그렇다. 읽은 순서가 곧 처리 순서다', leadsTo: 2 },
          { text: '아니다. 여러 스레드가 나눠 처리하면 끝난 순서가 달라진다', correct: true },
          { text: '그렇다. 브로커가 처리까지 직렬화한다', leadsTo: 2 },
          { text: '아니다. 대신 읽는 순서도 보장되지 않는다', leadsTo: 0 },
        ],
        rationale:
          '소비자 쪽에서도 순서가 깨질 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '순서 요구 자체를 없애는 방법은?',
        choices: [
          { text: '상태를 순서 대신 버전으로 판단해 늦게 온 이벤트를 버린다', correct: true },
          { text: '파티션 하나로 몰아 전역 순서를 만든다', leadsTo: 0 },
          { text: '소비자를 하나만 둔다', leadsTo: 2 },
          { text: '번호를 매기는 자리를 따로 둔다', leadsTo: 3 },
        ],
        rationale:
          '전역 순서를 만들면 병목이 생겨 병렬로 얻던 것을 내놓게 된다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '읽기와 쓰기 모델을 나누면 무엇을 얻고 잃는가?',
    items: [
      {
        kind: 'concept',
        stem: '읽기를 분리해 얻는 것은?',
        choices: [
          { text: '쓰기가 빨라진다', leadsTo: 0 },
          { text: '즉시 일관성이 강해진다', leadsTo: 1 },
          { text: '복잡도가 줄어든다', leadsTo: 4 },
          { text: '조회가 조인 없이 끝난다', correct: true },
        ],
        rationale:
          '읽기를 화면이 필요한 모양으로 미리 만들어 두기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '읽기를 분리하면 저장소도 반드시 나눠야 하는가?',
        choices: [
          { text: '아니다. 저장소까지 나눌지는 선택이다', correct: true },
          { text: '그렇다. 저장소 분리가 전제다', leadsTo: 0 },
          { text: '그렇다. 같은 저장소면 의미가 없다', leadsTo: 0 },
          { text: '아니다. 대신 절대 나누면 안 된다', leadsTo: 2 },
        ],
        rationale:
          '쓰기는 바꾸기 좋은 모양으로, 읽기는 화면 모양으로 두는 것이 핵심이다.',
      },
      {
        kind: 'boundary',
        stem: '나누지 않는 편이 나은 자리는?',
        choices: [
          { text: '읽기와 쓰기 비율이 비슷한 곳', correct: true },
          { text: '읽기가 압도적으로 많아 조회가 잦은 곳', leadsTo: 0 },
          { text: '화면이 복잡해 조인이 여러 번 필요한 곳', leadsTo: 0 },
          { text: '조인이 많아 조회가 느린 곳', leadsTo: 0 },
        ],
        rationale:
          '그런 자리에서는 복잡도만 늘어난다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '여러 서비스를 거친 요청은 어떻게 따라가는가?',
    items: [
      {
        kind: 'concept',
        stem: '호출 경계를 넘을 때 함께 보내는 것은?',
        choices: [
          { text: '요청 원문 전체', leadsTo: 3 },
          { text: '사용자 식별자', leadsTo: 1 },
          { text: '같은 trace-id와 현재 부모 span 정보', correct: true },
          { text: '수집기 주소', leadsTo: 2 },
        ],
        rationale:
          '각 서비스는 자기 작업을 새 span으로 기록해 경로를 다시 조립한다.',
      },
      {
        kind: 'misconception',
        stem: 'tail sampling을 쓰면 중요한 trace가 다 남는가?',
        choices: [
          { text: '아니다. 대신 head sampling이 더 정확하다', leadsTo: 0 },
          { text: '그렇다. 결과를 보고 고르니 빠짐이 없다', leadsTo: 0 },
          { text: '그렇다. 오류는 전부 남는다', leadsTo: 0 },
          { text: '아니다. 어떤 방식도 무조건 보존한다고 가정하지 않는다', correct: true },
        ],
        rationale:
          'tail sampling은 수집기의 메모리와 처리량, 결정 지연을 치른다.',
      },
      {
        kind: 'boundary',
        stem: 'span 속성에 넣지 말아야 할 것은?',
        choices: [
          { text: '호출 상태', leadsTo: 1 },
          { text: '시작과 끝 시각', leadsTo: 1 },
          { text: '개인정보나 인증 토큰', correct: true },
          { text: '부모 span 정보', leadsTo: 1 },
        ],
        rationale:
          'trace-id는 사용자 식별자가 아니며 높은 카디널리티 값도 비용과 유출 위험을 키운다.',
      },
    ],
  },
  {
    identityScope: 'deploy',
    question: '배포 방식은 무엇을 기준으로 고르는가?',
    items: [
      {
        kind: 'concept',
        stem: '가장 먼저 보는 기준은?',
        choices: [
          { text: '팀 규모', leadsTo: 2 },
          { text: '자원 비용', leadsTo: 2 },
          { text: '배포 소요 시간', leadsTo: 0 },
          { text: '문제가 생겼을 때 몇 명이 겪느냐', correct: true },
        ],
        rationale:
          '되돌리는 속도와 자원 비용이 그다음이다.',
      },
      {
        kind: 'misconception',
        stem: '블루그린은 되돌리기가 빠르니 노출 위험도 작은가?',
        choices: [
          { text: '아니다. 대신 되돌리기도 느리다', leadsTo: 0 },
          { text: '그렇다. 일부부터 노출된다', leadsTo: 0 },
          { text: '그렇다. 되돌리기가 빠르면 위험도 작다', leadsTo: 0 },
          { text: '아니다. 전환하는 순간 모든 사용자가 새 버전을 만난다', correct: true },
        ],
        rationale:
          '카나리는 5%부터 늘려 겪는 사람 수를 제한한다.',
      },
      {
        kind: 'boundary',
        stem: '무중단 배포에서 컬럼을 지우는 순서는?',
        choices: [
          { text: '쓰기를 먼저 끊고 바로 지운다', leadsTo: 1 },
          { text: '지우고 나서 코드를 바꾼다', leadsTo: 1 },
          { text: '한 번에 지운다', leadsTo: 1 },
          { text: '읽기를 끊고, 쓰기를 끊고, 그다음에 지운다', correct: true },
        ],
        rationale:
          '구버전과 신버전이 같은 스키마를 함께 써야 한다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '호출 시간 제한은 무엇을 기준으로 정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '아래 호출로 무엇을 전달하는가?',
        choices: [
          { text: '재시도 횟수만', leadsTo: 1 },
          { text: '새로 초기화한 타이머', leadsTo: 3 },
          { text: '평균 지연 시간', leadsTo: 0 },
          { text: '남은 시간', correct: true },
        ],
        rationale:
          '서비스마다 새 타이머를 주면 이미 끝난 요청에 자원을 계속 쓴다.',
      },
      {
        kind: 'misconception',
        stem: 'deadline이 지나면 시작한 일이 알아서 취소되는가?',
        choices: [
          { text: '아니다. 대신 재시도로 정리된다', leadsTo: 1 },
          { text: '그렇다. 시간이 지나면 중단된다', leadsTo: 0 },
          { text: '그렇다. 라이브러리가 처리한다', leadsTo: 2 },
          { text: '아니다. 취소 신호를 호출 사슬에 전파해야 한다', correct: true },
        ],
        rationale:
          '외부 효과가 시작된 작업은 멱등 키와 결과 조회로 최종 상태를 확인한다.',
      },
      {
        kind: 'boundary',
        stem: '여러 계층이 각자 재시도하면?',
        choices: [
          { text: '가장 안쪽 계층만 재시도한다', leadsTo: 3 },
          { text: '합으로 늘어난다', leadsTo: 1 },
          { text: '시도 횟수가 곱으로 늘어난다', correct: true },
          { text: '변화가 없다', leadsTo: 1 },
        ],
        rationale:
          '재시도할 한 계층을 정하고 전체 예산 안에서 관리한다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '게이트웨이를 두면 무엇을 얻고 무엇을 걱정해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: '특히 값진 이득은?',
        choices: [
          { text: '클라이언트가 내부 구조를 모르게 되는 것', correct: true },
          { text: '트래픽을 고르게 나누는 것', leadsTo: 1 },
          { text: '서비스 수를 줄이는 것', leadsTo: 2 },
          { text: '배포가 빨라지는 것', leadsTo: 0 },
        ],
        rationale:
          '서비스를 쪼개거나 합쳐도 바깥 주소는 그대로 둘 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '게이트웨이의 대가는 성능 지연뿐인가?',
        choices: [
          { text: '그렇다. 이중화하면 대가가 없다', leadsTo: 0 },
          { text: '그렇다. 한 홉이 늘어날 뿐이다', leadsTo: 0 },
          { text: '아니다. 단일 장애점과 배포 병목이 따라온다', correct: true },
          { text: '아니다. 대신 대가가 전혀 없다', leadsTo: 0 },
        ],
        rationale:
          '모든 팀의 라우팅 규칙이 한 저장소에 모이면 고치는 순서가 줄서기가 된다.',
      },
      {
        kind: 'boundary',
        stem: '로드 밸런서와 어떻게 갈리는가?',
        choices: [
          { text: '이름만 다른 완전히 같은 것이다', leadsTo: 1 },
          { text: '로드 밸런서는 트래픽, 게이트웨이는 정책', correct: true },
          { text: '게이트웨이는 트래픽을 나누지 못한다', leadsTo: 1 },
          { text: '로드 밸런서가 인증까지 맡고 나눈다', leadsTo: 3 },
        ],
        rationale:
          'L7 로드 밸런서도 경로와 헤더를 보므로 겹치는 자리가 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '리팩토링과 기능 추가를 나눠서 하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '리팩토링 단계에서 기존 테스트는 어떻게 되어야 하는가?',
        choices: [
          { text: '새로 써야 한다', leadsTo: 1 },
          { text: '계속 통과해야 한다', correct: true },
          { text: '일부는 깨져도 된다', leadsTo: 1 },
          { text: '잠시 꺼 둔다', leadsTo: 1 },
        ],
        rationale:
          '구조만 바꾸고 외부 동작은 그대로 두는 작업이기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '한 번에 같이 하면 시간이 절약되는가?',
        choices: [
          { text: '아니다. 섞이면 어디서 버그가 났는지 찾기 힘들다', correct: true },
          { text: '그렇다. 어차피 같은 파일을 만진다', leadsTo: 0 },
          { text: '그렇다. 테스트가 한 번에 끝난다', leadsTo: 1 },
          { text: '아니다. 대신 리팩토링을 나중으로 미룬다', leadsTo: 4 },
        ],
        rationale:
          '수정 범위와 영향도를 구분해야 버그 가능성이 낮아진다.',
      },
      {
        kind: 'boundary',
        stem: '커밋 단위로 나누면 리뷰어에게 무엇이 달라지는가?',
        choices: [
          { text: '구조 개선인지 동작 변경인지 명확해져 인지 부하가 준다', correct: true },
          { text: '리뷰할 코드 양이 줄어든다', leadsTo: 2 },
          { text: '테스트를 안 봐도 된다', leadsTo: 1 },
          { text: '차이가 없다', leadsTo: 2 },
        ],
        rationale:
          '무엇을 검증해야 하는지가 갈려 검증 효율이 높아진다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '팩토리 메소드 패턴을 언제 사용하는가?',
    items: [
      {
        kind: 'concept',
        stem: '클라이언트가 알아야 하는 것은?',
        choices: [
          { text: '생성 순서', leadsTo: 1 },
          { text: '구체 클래스의 생성자', leadsTo: 0 },
          { text: '모든 자식 클래스 목록', leadsTo: 3 },
          { text: '팩토리 인터페이스만', correct: true },
        ],
        rationale:
          '어떤 구체 클래스가 생성되는지 몰라도 기능을 수행할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '새 제품이 생기면 부르는 쪽 코드를 고쳐야 하는가?',
        choices: [
          { text: '아니다. Creator를 상속한 클래스를 하나 더 만들어 붙인다', correct: true },
          { text: '그렇다. 조건 분기를 추가해야 한다', leadsTo: 0 },
          { text: '그렇다. 인터페이스를 바꿔야 한다', leadsTo: 0 },
          { text: '아니다. 대신 팩토리를 없애야 한다', leadsTo: 3 },
        ],
        rationale:
          '생성자를 직접 부르면 새 타입 추가마다 코드를 고쳐야 한다.',
      },
      {
        kind: 'boundary',
        stem: '추상 팩토리와 갈리는 지점은?',
        choices: [
          { text: '단일 제품의 생성 책임을 분리하는 데 집중한다', correct: true },
          { text: '여러 제품군을 함께 만든다', leadsTo: 0 },
          { text: '인스턴스를 하나만 만든다', leadsTo: 2 },
          { text: '상속을 쓰지 않는다', leadsTo: 4 },
        ],
        rationale:
          '객체 생성 로직을 자식 클래스에서 결정하게 하는 것이 목적이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '객체 지향의 5대 원칙을 지키는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '절차 지향과 객체 지향은 무엇이 중심인가?',
        choices: [
          { text: '둘 다 순서와 로직', leadsTo: 3 },
          { text: '절차 지향은 순서와 로직, 객체 지향은 데이터와 행위', correct: true },
          { text: '둘 다 데이터와 행위', leadsTo: 3 },
          { text: '객체 지향은 순서 중심', leadsTo: 3 },
        ],
        rationale:
          '서로 관련된 데이터와 행위를 한 객체에 모은다.',
      },
      {
        kind: 'misconception',
        stem: '내부 로직을 바꾸면 호출하는 쪽도 바꿔야 하는가?',
        choices: [
          { text: '그렇다. 상속을 쓰면 반드시 함께 바뀐다', leadsTo: 1 },
          { text: '그렇다. 구현이 바뀌면 호출도 바뀐다', leadsTo: 2 },
          { text: '아니다. 인터페이스로 분리하면 영향을 받지 않는다', correct: true },
          { text: '아니다. 대신 상속으로만 가능하다', leadsTo: 1 },
        ],
        rationale:
          '인터페이스가 구현체와 사용자를 갈라놓는다.',
      },
      {
        kind: 'boundary',
        stem: '객체 사이의 의존을 줄이면?',
        choices: [
          { text: '실행 속도가 빨라진다', leadsTo: 4 },
          { text: '한 기능의 변경이 다른 곳으로 번지는 범위가 작아진다', correct: true },
          { text: '객체 수가 줄어든다', leadsTo: 3 },
          { text: '상속이 필요 없어진다', leadsTo: 1 },
        ],
        rationale:
          '유지보수 비용을 낮추는 것이 원칙을 지키는 이유다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '스트레티지 패턴을 사용하는 판단 기준은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '조건문 구조와 갈리는 결정적 지점은?',
        choices: [
          { text: '클래스 수가 준다', leadsTo: 4 },
          { text: '코드가 짧아진다', leadsTo: 4 },
          { text: '실행 중에 동적으로 교체할 수 있다', correct: true },
          { text: '인터페이스가 필요 없다', leadsTo: 0 },
        ],
        rationale:
          '조건문은 로직을 추가할 때마다 코드를 고쳐야 한다.',
      },
      {
        kind: 'misconception',
        stem: '조건문이 보이면 전략으로 바꾸는 편이 나은가?',
        choices: [
          { text: '그렇다. 조건문은 항상 나쁘다', leadsTo: 0 },
          { text: '아니다. 전략이 적거나 거의 안 바뀌면 클래스 수만 늘어난다', correct: true },
          { text: '그렇다. 확장성이 언제나 우선이다', leadsTo: 0 },
          { text: '아니다. 대신 상태 패턴으로 바꾼다', leadsTo: 1 },
        ],
        rationale:
          '구조가 복잡해지는 오버헤드가 이득보다 클 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '전략을 인터페이스에 의존시키면 무엇을 얻는가?',
        choices: [
          { text: '전략 사이의 공통 코드가 사라진다', leadsTo: 0 },
          { text: '기존 코드를 고치지 않고 전략을 추가할 수 있다', correct: true },
          { text: '런타임 비용이 준다', leadsTo: 4 },
          { text: '전략을 하나로 합칠 수 있다', leadsTo: 2 },
        ],
        rationale:
          '결제 수단이 늘어날 때 각각을 전략 클래스로 분리하는 식이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '컴포지트 패턴을 어떤 상황에서 사용하는가?',
    items: [
      {
        kind: 'concept',
        stem: '공통 인터페이스를 부르면 각각 무엇을 하는가?',
        choices: [
          { text: '컴포지트만 동작하고 리프는 무시된다', leadsTo: 0 },
          { text: '둘 다 자식을 순회하므로 리프도 재귀한다', leadsTo: 0 },
          { text: '둘 다 자기 일만 하고 자식에게 넘기지 않는다', leadsTo: 0 },
          { text: '리프는 자기 일을, 컴포지트는 자식에게 시킨다', correct: true },
        ],
        rationale:
          '클라이언트는 형변환도 타입 구분도 하지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '같은 인터페이스로 다루니 제약도 쉽게 걸 수 있는가?',
        choices: [
          { text: '아니다. 대신 제약을 걸 방법이 아예 없다', leadsTo: 4 },
          { text: '그렇다. 타입으로 막을 수 있다', leadsTo: 4 },
          { text: '그렇다. 인터페이스가 제약을 표현한다', leadsTo: 1 },
          { text: '아니다. 자식 요소 제약은 런타임에 확인해야 한다', correct: true },
        ],
        rationale:
          '인터페이스가 모든 메서드를 지원해야 해서 생기는 단점이다.',
      },
      {
        kind: 'boundary',
        stem: '이 패턴이 잘 맞는 데이터 모양은?',
        choices: [
          { text: '키-값 쌍', leadsTo: 0 },
          { text: '평평한 목록', leadsTo: 0 },
          { text: '순환 그래프', leadsTo: 2 },
          { text: '트리 구조', correct: true },
        ],
        rationale:
          '폴더와 파일로 구성된 파일 시스템이나 UI 컴포넌트 계층이 대표적이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'Raft는 왜 과반수를 요구하는가?',
    items: [
      {
        kind: 'concept',
        stem: '과반수를 요구하면 무엇이 보장되는가?',
        choices: [
          { text: '쓰기가 빨라진다', leadsTo: 2 },
          { text: '모든 노드가 같은 값을 본다', leadsTo: 3 },
          { text: '어떤 두 무리를 잡아도 최소 하나를 공유한다', correct: true },
          { text: '리더가 절대 바뀌지 않는다', leadsTo: 0 },
        ],
        rationale:
          '겹치는 표가 있어야 두 무리가 동시에 결정을 내리지 못한다.',
      },
      {
        kind: 'misconception',
        stem: '겹침만 있으면 결정이 갈리지 않는가?',
        choices: [
          { text: '아니다. 한 임기에 한 번만 투표한다는 규칙이 함께 있어야 한다', correct: true },
          { text: '그렇다. 과반수면 충분하다', leadsTo: 0 },
          { text: '그렇다. 임기 번호는 부수적이다', leadsTo: 0 },
          { text: '아니다. 대신 만장일치가 필요하다', leadsTo: 1 },
        ],
        rationale:
          '임기 번호는 오래된 리더를 밀어내는 역할을 한다.',
      },
      {
        kind: 'boundary',
        stem: '복제본을 늘리면 쓰기가 빨라지는가?',
        choices: [
          { text: '그렇다. 병렬로 써서 빨라진다', leadsTo: 3 },
          { text: '아니다. 과반수를 채우는 마지막 응답만큼 걸린다', correct: true },
          { text: '그렇다. 가장 빠른 응답으로 끝난다', leadsTo: 3 },
          { text: '아니다. 대신 모든 응답을 기다린다', leadsTo: 1 },
        ],
        rationale:
          '느린 소수는 안 기다리지만 과반수는 채워야 한다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '처리에 실패한 메시지는 어디로 가는가?',
    items: [
      {
        kind: 'concept',
        stem: '재시도와 실패 큐 이동은 어떻게 정해지는가?',
        choices: [
          { text: '메시지 내용에 따라 정해진다', leadsTo: 4 },
          { text: '브로커가 알아서 한다', leadsTo: 0 },
          { text: '소비자가 죽으면 자동으로 옮겨진다', leadsTo: 0 },
          { text: '큐와 소비자 설정으로 정해 두는 것이다', correct: true },
        ],
        rationale:
          '저절로 되는 것이 아니라 횟수와 간격을 정해 두는 일이다.',
      },
      {
        kind: 'misconception',
        stem: '순서를 지키는 자리에서는 실패한 것을 계속 다시 주면 되는가?',
        choices: [
          { text: '그렇다. 뒤엣것은 건너뛰고 처리된다', leadsTo: 3 },
          { text: '그렇다. 순서를 지키려면 옮기면 안 된다', leadsTo: 3 },
          { text: '아니다. 맨 앞이 계속 실패하면 뒤엣것이 영영 처리되지 않는다', correct: true },
          { text: '아니다. 대신 순서를 포기하면 그만이다', leadsTo: 3 },
        ],
        rationale:
          '다만 옮기는 순간 원래 순서는 깨진다.',
      },
      {
        kind: 'boundary',
        stem: '실패 큐로 옮긴 뒤에 해야 할 일은?',
        choices: [
          { text: '원래 큐로 자동 반환한다', leadsTo: 1 },
          { text: '주기적으로 비운다', leadsTo: 1 },
          { text: '쌓이면 알리도록 걸어 둔다', correct: true },
          { text: '아무것도 없다', leadsTo: 1 },
        ],
        rationale:
          '쌓인 것을 아무도 안 보면 조용히 잃은 것과 같다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '부하가 늘면 서버를 어떻게 늘리는가?',
    items: [
      {
        kind: 'concept',
        stem: '오토스케일러가 동작하는 방식은?',
        choices: [
          { text: '관리자가 정한 일정대로 움직인다', leadsTo: 4 },
          { text: '지표가 기준을 넘는 순간 곧바로 반응한다', leadsTo: 1 },
          { text: '주기마다 지표를 읽어 필요한 대수를 다시 셈한다', correct: true },
          { text: '요청 하나마다 판단한다', leadsTo: 1 },
        ],
        rationale:
          '상태를 보고 판단하는 것이 아니라 고리를 돈다.',
      },
      {
        kind: 'misconception',
        stem: '늘릴 때 0초, 줄일 때 300초는 모든 오토스케일러의 규칙인가?',
        choices: [
          { text: '그렇다. 바꿀 수 없는 값이다', leadsTo: 1 },
          { text: '그렇다. 표준으로 정해져 있다', leadsTo: 1 },
          { text: '아니다. 쿠버네티스의 기본 설정값일 뿐이다', correct: true },
          { text: '아니다. 대신 양쪽 다 0초가 맞다', leadsTo: 1 },
        ],
        rationale:
          '바로 반응하면 잠깐 튄 값에 늘렸다 줄이기를 되풀이한다.',
      },
      {
        kind: 'boundary',
        stem: '진짜 제약이 되는 것은?',
        choices: [
          { text: '서버가 뜨고 받을 준비를 마칠 때까지 걸리는 시간', correct: true },
          { text: '지표를 읽는 주기', leadsTo: 0 },
          { text: '완충 시간의 길이', leadsTo: 1 },
          { text: '최대 대수 설정', leadsTo: 4 },
        ],
        rationale:
          '그 몇 분은 이미 밀린다. 미리 늘려 두는 편이 나은 자리가 있다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '보내는 쪽이 받는 쪽보다 빠르면 무엇이 터지는가?',
    items: [
      {
        kind: 'concept',
        stem: '큐 길이에 한도가 없으면?',
        choices: [
          { text: '오래된 것부터 버려진다', leadsTo: 1 },
          { text: '보내는 쪽이 자동으로 느려진다', leadsTo: 2 },
          { text: '겉으로는 다 받아 주다가 메모리가 바닥난다', correct: true },
          { text: '받는 쪽이 빨라진다', leadsTo: 3 },
        ],
        rationale:
          '문제가 늦게 드러나는 것이 한도가 없을 때의 위험이다.',
      },
      {
        kind: 'misconception',
        stem: '자리가 없으면 멈추게 하는 것이 유일한 선택인가?',
        choices: [
          { text: '그렇다. 버리면 데이터가 사라져 안 된다', leadsTo: 1 },
          { text: '그렇다. 백프레셔뿐이다', leadsTo: 2 },
          { text: '아니다. 버리거나 거절하는 선택도 있다', correct: true },
          { text: '아니다. 대신 한도를 없애면 된다', leadsTo: 0 },
        ],
        rationale:
          '실시간 지표처럼 늦은 값이 쓸모없으면 오래된 것부터 버리는 편이 낫다.',
      },
      {
        kind: 'boundary',
        stem: '백프레셔가 하는 일은?',
        choices: [
          { text: '받는 쪽 처리량을 자동으로 늘려 준다', leadsTo: 3 },
          { text: '느린 쪽의 속도가 앞으로 전해진다', correct: true },
          { text: '큐 크기를 자동으로 키운다', leadsTo: 0 },
          { text: '자리가 없으면 오래된 메시지를 버린다', leadsTo: 1 },
        ],
        rationale:
          '사이에 낀 큐가 먼저 터지는 것을 막는 방식이다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '단계마다 타임아웃을 5초씩 주면 무엇이 잘못되는가?',
    items: [
      {
        kind: 'concept',
        stem: '단계가 셋이고 각각 5초면 최악에 얼마인가?',
        choices: [
          { text: '단계 수와 무관하다', leadsTo: 0 },
          { text: '5초', leadsTo: 0 },
          { text: '10초', leadsTo: 0 },
          { text: '15초', correct: true },
        ],
        rationale:
          '따로 주면 시간이 더해진다.',
      },
      {
        kind: 'misconception',
        stem: '사용자가 떠나면 서버 일도 멈추는가?',
        choices: [
          { text: '아니다. 대신 재시도가 멈춘다', leadsTo: 2 },
          { text: '그렇다. 연결이 끊기면 중단된다', leadsTo: 1 },
          { text: '그렇다. 타임아웃이 정리해 준다', leadsTo: 1 },
          { text: '아니다. 아무도 안 볼 답을 만드느라 자원을 쓴다', correct: true },
        ],
        rationale:
          '취소 신호도 아래 단계까지 전해져야 한다.',
      },
      {
        kind: 'boundary',
        stem: '남은 것이 없으면 각 단계는 어떻게 하는가?',
        choices: [
          { text: '재시도부터 한다', leadsTo: 2 },
          { text: '새 타이머로 시작한다', leadsTo: 0 },
          { text: '절반의 시간으로 시작한다', leadsTo: 0 },
          { text: '아예 시작하지 않는다', correct: true },
        ],
        rationale:
          '남은 시간을 안 보고 재시도하면 예산을 넘긴 채로 계속 두드린다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '남의 서버에 일이 생긴 것을 어떻게 아는가?',
    items: [
      {
        kind: 'concept',
        stem: '알림을 받으면 무엇을 먼저 하는가?',
        choices: [
          { text: '큐에 넣고 받았다고 바로 답한다', correct: true },
          { text: '무거운 처리를 끝내고 답한다', leadsTo: 2 },
          { text: '상대에게 다시 조회한다', leadsTo: 3 },
          { text: '서명 확인을 생략하고 처리한다', leadsTo: 1 },
        ],
        rationale:
          '그 자리에서 무거운 일을 하면 상대의 제한 시간을 넘겨 다시 보내게 만든다.',
      },
      {
        kind: 'misconception',
        stem: '등록한 주소로 온 요청이면 믿어도 되는가?',
        choices: [
          { text: '그렇다. 내용이 맞으면 진짜다', leadsTo: 1 },
          { text: '그렇다. 등록한 상대만 안다', leadsTo: 1 },
          { text: '아니다. 그 주소는 누구나 부를 수 있어 서명을 확인해야 한다', correct: true },
          { text: '아니다. 대신 주소를 자주 바꾼다', leadsTo: 1 },
        ],
        rationale:
          '확인 없이 믿으면 남이 결제 성공을 지어낼 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '우리 서버가 꺼져 있던 동안의 알림은?',
        choices: [
          { text: '그 사이 알림은 복구할 방법이 없다', leadsTo: 3 },
          { text: '상대가 반드시 다시 보낸다', leadsTo: 3 },
          { text: '다시 켜지면 자동으로 복구된다', leadsTo: 3 },
          { text: '상대의 재시도 정책에 달렸다', correct: true },
        ],
        rationale:
          '못 받은 구간을 다시 맞추는 경로가 필요하다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '서버마다 시계가 다르면 무엇이 깨지는가?',
    items: [
      {
        kind: 'concept',
        stem: '어긋난 폭이 두 사건 사이의 간격보다 크면?',
        choices: [
          { text: '순서는 그대로 유지된다', leadsTo: 0 },
          { text: '두 사건이 같은 시각으로 기록된다', leadsTo: 0 },
          { text: '기록이 남지 않는다', leadsTo: 1 },
          { text: '나중 일이 먼저 일어난 것으로 기록된다', correct: true },
        ],
        rationale:
          '여러 서버의 로그를 시각순으로 모으면 그 뒤집힘이 사실처럼 읽힌다.',
      },
      {
        kind: 'misconception',
        stem: '시계를 맞추면 문제가 사라지는가?',
        choices: [
          { text: '그렇다. 오차가 0이 된다', leadsTo: 1 },
          { text: '그렇다. 동기화하면 정확해진다', leadsTo: 2 },
          { text: '아니다. 맞추는 순간 튀어 같은 시각이 두 번 지나갈 수 있다', correct: true },
          { text: '아니다. 대신 시계를 아예 쓰지 않는다', leadsTo: 0 },
        ],
        rationale:
          '뒤로 당겨지면 시각을 섞어 만든 식별자가 겹칠 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '순서가 중요한 곳에서는 무엇을 쓰는가?',
        choices: [
          { text: '가장 정확한 서버의 시각을 쓴다', leadsTo: 1 },
          { text: '사건마다 세는 값을 따로 두거나 한 곳에서 번호를 받아 온다', correct: true },
          { text: '시각을 더 잘게 쪼갠다', leadsTo: 0 },
          { text: '기록 시각 대신 도착 시각을 쓴다', leadsTo: 0 },
        ],
        rationale:
          '시각은 사람이 읽는 값이고 순서를 정하는 값은 따로 두는 것이 안전하다.',
      },
    ],
  },
  {
    identityScope: 'distributed',
    question: '메시지 형식을 바꾸면 옛 소비자는 어떻게 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '생산자가 새 형식만 보내기 시작하면 소비자는?',
        choices: [
          { text: '큐에 남은 옛 메시지 때문에 아직 둘 다 읽어야 한다', correct: true },
          { text: '새 형식만 읽으면 된다', leadsTo: 4 },
          { text: '옛 형식만 읽으면 된다', leadsTo: 1 },
          { text: '읽기를 잠시 멈춘다', leadsTo: 1 },
        ],
        rationale:
          '보내는 쪽과 받는 쪽을 같은 순간에 바꿀 수 없다.',
      },
      {
        kind: 'misconception',
        stem: '이름을 그대로 두고 뜻만 바꾸면 호환이 유지되는가?',
        choices: [
          { text: '그렇다. 이름이 같으니 안전하다', leadsTo: 0 },
          { text: '아니다. 형식은 통과하는데 값이 틀려 조용히 잘못된 결과가 나온다', correct: true },
          { text: '그렇다. 칸을 지우는 것보다 낫다', leadsTo: 0 },
          { text: '아니다. 대신 오류가 바로 난다', leadsTo: 0 },
        ],
        rationale:
          '새 이름을 쓰는 편이 낫다.',
      },
      {
        kind: 'boundary',
        stem: '옛 소비자가 못 읽는 변경이면 배포 순서는?',
        choices: [
          { text: '동시에 배포한다', leadsTo: 1 },
          { text: '생산자를 먼저 배포한다', leadsTo: 1 },
          { text: '소비자를 먼저 배포한다', correct: true },
          { text: '순서는 상관없다', leadsTo: 1 },
        ],
        rationale:
          '뒤집히면 아직 안 바뀐 소비자가 못 읽는 메시지가 쌓인다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '이벤트 소싱을 도입할 때의 트레이드오프는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '현재 상태를 알려면 무엇을 해야 하는가?',
        choices: [
          { text: '이벤트를 순차적으로 재생해야 한다', correct: true },
          { text: '최종 상태 테이블을 읽는다', leadsTo: 0 },
          { text: '마지막 이벤트만 본다', leadsTo: 1 },
          { text: '스냅샷만 본다', leadsTo: 1 },
        ],
        rationale:
          '데이터를 최종 상태가 아니라 발생한 모든 이벤트로 저장하기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: '과거 이벤트를 고쳐서 형식 변경에 대응하면 되는가?',
        choices: [
          { text: '그렇다. 스냅샷만 다시 만들면 된다', leadsTo: 1 },
          { text: '그렇다. 저장소를 일괄 갱신하면 된다', leadsTo: 2 },
          { text: '아니다. 수정할 수 없어 업캐스팅 같은 진화 전략이 필요하다', correct: true },
          { text: '아니다. 대신 형식을 바꾸면 안 된다', leadsTo: 2 },
        ],
        rationale:
          '새 버전의 이벤트 스키마로 하위 호환성을 유지해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '재생 비용이 커지면 무엇으로 줄이는가?',
        choices: [
          { text: '오래된 이벤트를 지운다', leadsTo: 2 },
          { text: '특정 시점의 상태를 스냅샷으로 저장한다', correct: true },
          { text: '이벤트를 합쳐 하나로 만든다', leadsTo: 2 },
          { text: '재생을 생략한다', leadsTo: 0 },
        ],
        rationale:
          '조회용 모델을 따로 두는 CQRS와 함께 쓰는 경우가 많다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'JWT를 세션 대신 쓸 때 무엇을 잃는가?',
    items: [
      {
        kind: 'concept',
        stem: '권한을 회수해도 이미 발급한 토큰은?',
        choices: [
          { text: '서명 검증에서 걸린다', leadsTo: 1 },
          { text: '즉시 무효가 된다', leadsTo: 1 },
          { text: '다음 요청에서 갱신된다', leadsTo: 0 },
          { text: '만료 전까지 통과할 수 있다', correct: true },
        ],
        rationale:
          '발급 때 넣은 claim이 만료까지 남기 때문이다.',
      },
      {
        kind: 'misconception',
        stem: 'JWT와 세션은 서로 반대되는 선택지인가?',
        choices: [
          { text: '아니다. 세션 식별자를 JWT에 담을 수도 있다', correct: true },
          { text: '그렇다. 둘 중 하나만 고른다', leadsTo: 4 },
          { text: '그렇다. JWT는 무상태 전용이다', leadsTo: 0 },
          { text: '아니다. 대신 둘은 같은 것이다', leadsTo: 4 },
        ],
        rationale:
          'JWT는 토큰 형식이고 세션은 로그인 상태를 관리하는 방식이다.',
      },
      {
        kind: 'boundary',
        stem: '서명 검증만 하면 충분한가?',
        choices: [
          { text: '아니다. 대신 서명은 볼 필요가 없다', leadsTo: 3 },
          { text: '그렇다. 서명이 맞으면 신뢰할 수 있다', leadsTo: 3 },
          { text: '그렇다. 서명이 내용까지 숨겨 주기 때문이다', leadsTo: 3 },
          { text: '아니다. 알고리즘과 issuer, 만료 시간도 본다', correct: true },
        ],
        rationale:
          'JWT 서명은 claim을 숨기지 않아 암호화하지 않은 내용은 가진 사람이 읽는다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'HTTPS는 무엇을 보장하고 무엇을 못 하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'HTTPS가 지키는 구간은?',
        choices: [
          { text: '전체 생애주기', leadsTo: 2 },
          { text: '서버에 저장된 뒤까지', leadsTo: 2 },
          { text: '브라우저 메모리 안까지', leadsTo: 2 },
          { text: '이동 중', correct: true },
        ],
        rationale:
          '비밀번호를 평문으로 저장하는 서버는 HTTPS를 써도 털린다.',
      },
      {
        kind: 'misconception',
        stem: '자물쇠가 붙었으면 안전한 사이트인가?',
        choices: [
          { text: '아니다. 대신 인증서는 의미가 없다', leadsTo: 0 },
          { text: '그렇다. 인증서가 사이트의 정직함을 보증한다', leadsTo: 0 },
          { text: '그렇다. 검증을 통과했으니 안전하다', leadsTo: 3 },
          { text: '아니다. 피싱 사이트도 자기 도메인에는 유효한 인증서를 받는다', correct: true },
        ],
        rationale:
          '서버가 접속한 이름에 유효한 인증서와 개인 키를 가졌는지를 확인할 뿐이다.',
      },
      {
        kind: 'boundary',
        stem: 'TLS 1.3의 일반적인 인증서 방식에서 키는 어떻게 정해지는가?',
        choices: [
          { text: '서버 공개 키로 대칭키를 암호화해 보낸다', leadsTo: 1 },
          { text: '임시 (EC)DHE 값으로 양쪽이 같은 비밀을 만든다', correct: true },
          { text: '인증서 안에 대칭키가 들어 있다', leadsTo: 0 },
          { text: '클라이언트가 정해 평문으로 알린다', leadsTo: 1 },
        ],
        rationale:
          'HKDF로 트래픽 키를 유도하고 실제 데이터는 그 키로 AEAD 보호한다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'CORS는 무엇을 막는가?',
    items: [
      {
        kind: 'concept',
        stem: 'CORS가 막는 것은 정확히 무엇인가?',
        choices: [
          { text: '다른 출처 스크립트가 응답을 읽는 것', correct: true },
          { text: '요청이 서버에 도착하는 것', leadsTo: 4 },
          { text: '쿠키가 전송되는 것', leadsTo: 2 },
          { text: '서버가 응답을 만드는 것', leadsTo: 4 },
        ],
        rationale:
          '서버에는 도착하고 브라우저가 결과를 스크립트에 안 넘긴다.',
      },
      {
        kind: 'misconception',
        stem: 'CORS를 걸면 서버가 보호되는가?',
        choices: [
          { text: '그렇다. 허용 목록이 서버를 지킨다', leadsTo: 4 },
          { text: '아니다. 사용자의 브라우저에 있는 자격 증명을 지키는 장치다', correct: true },
          { text: '그렇다. 인증을 대신한다', leadsTo: 4 },
          { text: '아니다. 대신 CSRF까지 막아 준다', leadsTo: 1 },
        ],
        rationale:
          '서버 인증은 따로 있어야 하고 폼 전송 공격은 CSRF 토큰의 몫이다.',
      },
      {
        kind: 'boundary',
        stem: '쿠키를 함께 보내려면 무엇이 달라지는가?',
        choices: [
          { text: '예비 확인을 건너뛴다', leadsTo: 0 },
          { text: '출처를 *로 열 수 없고 정확한 주소를 적어야 한다', correct: true },
          { text: '메서드 제한이 사라진다', leadsTo: 0 },
          { text: '달라지는 것이 없다', leadsTo: 2 },
        ],
        rationale:
          '개발 중에 *로 열어놓고 배포에서 막히는 일이 여기서 나온다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '공개키와 비밀키는 무엇으로 구분하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'A의 공개키로 암호화한 데이터는 무엇으로 푸는가?',
        choices: [
          { text: '둘 중 아무거나', leadsTo: 1 },
          { text: 'A의 공개키', leadsTo: 1 },
          { text: '보낸 사람의 비밀키', leadsTo: 1 },
          { text: 'A의 비밀키', correct: true },
        ],
        rationale:
          '서로 다른 키로 암호화와 복호화를 수행하는 방식이다.',
      },
      {
        kind: 'misconception',
        stem: '대칭키는 빠르니 그것만 쓰면 되는가?',
        choices: [
          { text: '아니다. 키를 안전하게 전달하는 과정에서 탈취될 위험이 크다', correct: true },
          { text: '그렇다. 속도가 가장 중요하다', leadsTo: 2 },
          { text: '그렇다. 키 전달은 문제가 아니다', leadsTo: 2 },
          { text: '아니다. 대신 공개키만 쓴다', leadsTo: 0 },
        ],
        rationale:
          '양쪽이 같은 키 하나를 나눠 갖기 때문이다.',
      },
      {
        kind: 'boundary',
        stem: '실제로는 둘을 어떻게 섞어 쓰는가?',
        choices: [
          { text: '둘 중 하나만 골라 쓰고 섞지 않는다', leadsTo: 2 },
          { text: '데이터를 공개키로 직접 암호화한다', leadsTo: 0 },
          { text: '대칭키를 평문으로 보내고 본문만 암호화한다', leadsTo: 2 },
          { text: '대칭키를 공개키로 전달하고 데이터는 대칭키로', correct: true },
        ],
        rationale:
          '전달받은 대칭키로 실제 통신을 빠르게 처리한다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '대칭키와 공개키 중 무엇을 선택하는가?',
    items: [
      {
        kind: 'concept',
        stem: '공개키가 느린 이유는?',
        choices: [
          { text: '키 길이가 짧기 때문이다', leadsTo: 1 },
          { text: '복잡한 수학 연산을 수행하기 때문이다', correct: true },
          { text: '네트워크를 거치기 때문이다', leadsTo: 2 },
          { text: '서명을 매번 만들기 때문이다', leadsTo: 3 },
        ],
        rationale:
          '전체 데이터를 공개키로 암호화하면 성능 저하가 심하다.',
      },
      {
        kind: 'misconception',
        stem: '요즘 TLS는 공개키로 대칭키를 암호화해 보내는가?',
        choices: [
          { text: '그렇다. 서버 공개키로 세션 키를 암호화한다', leadsTo: 2 },
          { text: '아니다. 양쪽이 값을 주고받아 공유 비밀을 만들고 거기서 뽑는다', correct: true },
          { text: '그렇다. 대칭키를 인증서에 담아 보낸다', leadsTo: 4 },
          { text: '아니다. 대신 대칭키만 쓴다', leadsTo: 0 },
        ],
        rationale:
          '공개키는 서버가 진짜인지 서명으로 확인하는 데 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '각각 어디에 쓰는가?',
        choices: [
          { text: '대칭키는 본문 암호화, 공개키는 키 교환과 서명', correct: true },
          { text: '반대다', leadsTo: 3 },
          { text: '둘 다 본문 암호화에 쓴다', leadsTo: 0 },
          { text: '둘 다 서명에만 쓴다', leadsTo: 3 },
        ],
        rationale:
          '대량 데이터 전송에는 대칭키가, 초기 키 교환과 인증에는 공개키가 맞는다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: 'TLS 핸드셰이크의 핵심 목적은 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '핸드셰이크로 이루려는 두 가지는?',
        choices: [
          { text: '서버가 진짜인지 확인하고 양쪽이 같은 대칭키를 갖는 것', correct: true },
          { text: '클라이언트 신원 확인과 키 교환', leadsTo: 0 },
          { text: '데이터 압축과 무결성 검사', leadsTo: 2 },
          { text: '세션 재사용과 속도 향상', leadsTo: 4 },
        ],
        rationale:
          '클라이언트 쪽 신원 확인은 기본이 아니다.',
      },
      {
        kind: 'misconception',
        stem: '인증서의 공개키는 데이터를 잠그는 데 쓰이는가?',
        choices: [
          { text: '아니다. 서버가 그 인증서의 주인이 맞다는 것을 서명으로 보이는 데 쓴다', correct: true },
          { text: '그렇다. 전송 데이터를 그 키로 암호화한다', leadsTo: 1 },
          { text: '그렇다. 세션 키를 그 키로 잠가 보낸다', leadsTo: 1 },
          { text: '아니다. 대신 아무 역할도 없다', leadsTo: 0 },
        ],
        rationale:
          '믿을 만한 기관이 서명한 인증서를 확인해 중간자를 막는다.',
      },
      {
        kind: 'boundary',
        stem: 'TLS 1.3이 1-RTT로 줄인 방법은?',
        choices: [
          { text: '인증서 검증을 생략해 왕복을 줄인다', leadsTo: 3 },
          { text: '첫 왕복에 키 재료까지 함께 보낸다', correct: true },
          { text: '양쪽이 대칭키를 미리 나눠 갖고 시작한다', leadsTo: 4 },
          { text: '핸드셰이크 자체를 건너뛰고 바로 보낸다', leadsTo: 2 },
        ],
        rationale:
          '한 번 붙었던 서버에는 0-RTT로 더 줄일 수도 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '세션 하이재킹은 왜 성립하는가?',
    items: [
      {
        kind: 'concept',
        stem: '서버가 요청을 그 사용자의 것으로 처리하는 근거는?',
        choices: [
          { text: '접속한 IP가 같다는 것', leadsTo: 0 },
          { text: '유효한 토큰을 제시했다는 것', correct: true },
          { text: '기기 정보가 같다는 것', leadsTo: 0 },
          { text: '비밀번호를 다시 확인했다는 것', leadsTo: 3 },
        ],
        rationale:
          '대개의 세션이 토큰만 제시하면 통하는 방식이다.',
      },
      {
        kind: 'misconception',
        stem: 'IP가 바뀌면 바로 끊는 것이 안전한가?',
        choices: [
          { text: '아니다. 이동 통신에서는 정상 사용자의 IP도 자주 바뀐다', correct: true },
          { text: '그렇다. 탈취를 확실히 막는다', leadsTo: 0 },
          { text: '그렇다. 오탐이 없다', leadsTo: 0 },
          { text: '아니다. 대신 IP는 볼 필요가 없다', leadsTo: 4 },
        ],
        rationale:
          '보조 신호로 쓸 수는 있지만 어긋났다고 바로 끊으면 멀쩡한 사용자를 쫓아낸다.',
      },
      {
        kind: 'boundary',
        stem: '로그인 성공 시 토큰을 새로 만드는 이유는?',
        choices: [
          { text: '로그인 시점부터 만료를 다시 세려고', leadsTo: 3 },
          { text: '토큰 길이를 늘려 추측을 어렵게 하려고', leadsTo: 2 },
          { text: '미리 심어 둔 토큰이 로그인 뒤에도 통하는 것을 끊는다', correct: true },
          { text: '스크립트가 토큰을 읽지 못하게 막으려고', leadsTo: 0 },
        ],
        rationale:
          '이전 것을 함께 폐기해야 효과가 있다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '권한은 왜 최소로 주는가?',
    items: [
      {
        kind: 'concept',
        stem: '권한이 정하는 것은?',
        choices: [
          { text: '계정이 뚫렸을 때 출발점의 넓이', correct: true },
          { text: '최종 피해의 크기 전부', leadsTo: 1 },
          { text: '공격이 성공할 확률', leadsTo: 4 },
          { text: '탐지까지 걸리는 시간', leadsTo: 0 },
        ],
        rationale:
          '공격자는 권한 상승이나 그 계정이 쥔 비밀로 피해를 더 키울 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '최소 권한은 처음에 좁게 주면 끝인가?',
        choices: [
          { text: '그렇다. 한 번 정하면 바뀌지 않는다', leadsTo: 3 },
          { text: '그렇다. 초기 설정이 전부다', leadsTo: 3 },
          { text: '아니다. 정기적으로 살펴 불필요해진 권한을 회수하는 일까지다', correct: true },
          { text: '아니다. 대신 넓게 주고 감시한다', leadsTo: 0 },
        ],
        rationale:
          '임시로 넓힌 권한이 안 돌아오고 쌓이기 쉽다.',
      },
      {
        kind: 'boundary',
        stem: '서비스 계정과 CI 토큰이 더 위험한 이유는?',
        choices: [
          { text: '비밀을 쥐지 않아서', leadsTo: 0 },
          { text: '사람보다 실수를 많이 해서', leadsTo: 1 },
          { text: '권한 상승이 불가능해서', leadsTo: 1 },
          { text: '장기 유효하거나 권한이 넓고 감시가 부족하기 쉽다', correct: true },
        ],
        rationale:
          '자동화된 자리라 넓은 권한을 받기 쉽다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '비밀키를 코드에 넣으면 왜 안 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '키를 지운 커밋을 올리면 해결되는가?',
        choices: [
          { text: '그렇다. 최신 코드에 없으면 안전하다', leadsTo: 3 },
          { text: '아니다. 히스토리와 이미 만들어진 복제본에는 남는다', correct: true },
          { text: '그렇다. 깃이 이전 기록을 지운다', leadsTo: 3 },
          { text: '아니다. 대신 클론만 다시 받으면 된다', leadsTo: 3 },
        ],
        rationale:
          '저장소가 복사되는 곳마다 키도 따라간다.',
      },
      {
        kind: 'misconception',
        stem: '유출된 키의 대응은 삭제인가?',
        choices: [
          { text: '그렇다. 저장소만 비공개로 돌리면 된다', leadsTo: 0 },
          { text: '그렇다. 지우면 회수된다', leadsTo: 3 },
          { text: '아니다. 폐기다. 무효로 만들고 필요하면 새 키로 바꾼다', correct: true },
          { text: '아니다. 대신 그대로 쓴다', leadsTo: 0 },
        ],
        rationale:
          '어디까지 쓰였는지 접근 기록을 살피는 것도 대응의 일부다.',
      },
      {
        kind: 'boundary',
        stem: '키는 어떻게 전달하는가?',
        choices: [
          { text: '코드와 분리해 별도 브랜치에 둔다', leadsTo: 3 },
          { text: '설정 파일에 적어 함께 커밋한다', leadsTo: 3 },
          { text: '찾기 쉽게 주석으로 남긴다', leadsTo: 3 },
          { text: '환경 변수나 시크릿 매니저로 주입한다', correct: true },
        ],
        rationale:
          '코드에는 어떤 키가 필요한지만 남는다.',
      },
    ],
  },
  {
    identityScope: 'http',
    question: 'HSTS는 무엇을 막는가?',
    items: [
      {
        kind: 'concept',
        stem: '정책을 기억한 브라우저는 무엇을 하는가?',
        choices: [
          { text: 'HTTP 요청을 네트워크에 보내기 전에 HTTPS로 바꾼다', correct: true },
          { text: 'HTTP로 보낸 뒤 리다이렉트를 따른다', leadsTo: 3 },
          { text: '인증서를 더 엄격히 검사한다', leadsTo: 4 },
          { text: '접속을 차단한다', leadsTo: 1 },
        ],
        rationale:
          '공격이 낄 창문이 닫힌다.',
      },
      {
        kind: 'misconception',
        stem: '서버가 HTTPS로 리다이렉트하면 충분한가?',
        choices: [
          { text: '그렇다. 결국 HTTPS로 넘어간다', leadsTo: 2 },
          { text: '아니다. 리다이렉트는 HTTP 응답이라 공격자가 바꿀 수 있다', correct: true },
          { text: '그렇다. 리다이렉트도 암호화된다', leadsTo: 3 },
          { text: '아니다. 대신 리다이렉트를 없애야 한다', leadsTo: 3 },
        ],
        rationale:
          'HTTP로 붙는 그 순간을 노리는 다운그레이드 공격이다.',
      },
      {
        kind: 'boundary',
        stem: '남는 빈틈은?',
        choices: [
          { text: '인증서를 갱신할 때', leadsTo: 4 },
          { text: 'max-age가 끝난 뒤', leadsTo: 0 },
          { text: '헤더를 아직 못 받은 첫 방문', correct: true },
          { text: '빈틈이 없다', leadsTo: 1 },
        ],
        rationale:
          'preload 목록에 올리면 그 브라우저에서는 첫 방문부터 강제된다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '컨테이너는 가상 머신과 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: '컨테이너가 쓰는 커널은?',
        choices: [
          { text: '커널 없이 동작한다', leadsTo: 0 },
          { text: '컨테이너마다 게스트 커널을 띄운다', leadsTo: 0 },
          { text: '호스트 커널을 여러 컨테이너가 공유한다', correct: true },
          { text: '런타임이 커널을 대신한다', leadsTo: 1 },
        ],
        rationale:
          '가상 머신은 가상 하드웨어 위에 게스트 커널을 띄운다.',
      },
      {
        kind: 'misconception',
        stem: '이미지만 같으면 어느 호스트에서나 똑같이 실행되는가?',
        choices: [
          { text: '그렇다. 커널도 이미지에 들어 있다', leadsTo: 2 },
          { text: '그렇다. 이미지가 모든 것을 담는다', leadsTo: 2 },
          { text: '아니다. CPU 아키텍처와 호스트 커널의 시스템 호출에 맞아야 한다', correct: true },
          { text: '아니다. 대신 런타임이 변환해 준다', leadsTo: 1 },
        ],
        rationale:
          '이미지에는 커널이 없어 보통 가상 머신 이미지보다 작다.',
      },
      {
        kind: 'boundary',
        stem: '격리 강도는 무엇으로 정해지는가?',
        choices: [
          { text: '포장 형식이 아니라 설정까지 봐야 한다', correct: true },
          { text: '컨테이너냐 가상 머신이냐로 정해진다', leadsTo: 3 },
          { text: '이미지 크기로 정해진다', leadsTo: 2 },
          { text: 'cgroup 제한만 보면 된다', leadsTo: 1 },
        ],
        rationale:
          '과한 Linux capability와 privileged 실행, 호스트 파일 시스템 마운트가 경계를 약하게 만든다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: 'SQL 인젝션은 무엇으로 막는가?',
    items: [
      {
        kind: 'concept',
        stem: '값 바인딩이 안전한 이유는?',
        choices: [
          { text: '읽기 전용 권한으로 낮춰 실행한다', leadsTo: 4 },
          { text: '위험한 문자를 자동으로 지운다', leadsTo: 0 },
          { text: '입력 길이를 제한해 긴 구문을 막는다', leadsTo: 0 },
          { text: '문법을 먼저 고정하고 입력은 값으로 넘긴다', correct: true },
        ],
        rationale:
          '따옴표나 연산자가 있어도 문법으로 해석되지 않는다.',
      },
      {
        kind: 'misconception',
        stem: 'ORM을 쓰면 자동으로 안전한가?',
        choices: [
          { text: '아니다. 대신 ORM은 더 위험하다', leadsTo: 1 },
          { text: '그렇다. ORM이 모든 질의를 검사한다', leadsTo: 1 },
          { text: '그렇다. 저장 프로시저도 안전하다', leadsTo: 2 },
          { text: '아니다. raw query에 문자열을 합치면 같은 취약점이 생긴다', correct: true },
        ],
        rationale:
          '저장 프로시저도 내부에서 동적 SQL을 이어 붙이면 위험하다.',
      },
      {
        kind: 'boundary',
        stem: '열 이름처럼 값으로 바인딩할 수 없는 자리는?',
        choices: [
          { text: '읽기 전용 계정으로 실행한다', leadsTo: 4 },
          { text: '이스케이프해서 이어 붙인다', leadsTo: 0 },
          { text: '입력 검증만 통과시키면 된다', leadsTo: 0 },
          { text: '코드의 허용 목록에서 매핑한다', correct: true },
        ],
        rationale:
          '최소 권한은 피해를 줄이는 두 번째 방어선이지 인젝션 자체를 막지 않는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '죽은 파드는 누가 다시 만드는가?',
    items: [
      {
        kind: 'concept',
        stem: '사용자가 남기는 것은?',
        choices: [
          { text: '재시작 스크립트', leadsTo: 1 },
          { text: '"파드를 만들어라"는 명령', leadsTo: 0 },
          { text: '"셋이어야 한다"는 상태', correct: true },
          { text: '노드 배치 계획', leadsTo: 3 },
        ],
        rationale:
          '그 차이를 메우는 일은 컨트롤러가 되풀이한다.',
      },
      {
        kind: 'misconception',
        stem: '컨트롤러는 주기마다 API 서버에 묻는가?',
        choices: [
          { text: '그렇다. 짧은 주기로 계속 조회한다', leadsTo: 1 },
          { text: '아니다. 바뀔 때 알려주고 컨트롤러는 사본을 기준으로 맞춘다', correct: true },
          { text: '그렇다. 파드마다 확인한다', leadsTo: 1 },
          { text: '아니다. 대신 kubelet이 알려준다', leadsTo: 2 },
        ],
        rationale:
          'API 서버가 변경을 알리는 방식이다.',
      },
      {
        kind: 'boundary',
        stem: '다시 만들어지지 않는 경우는?',
        choices: [
          { text: '컨테이너만 죽은 경우', leadsTo: 2 },
          { text: 'Deployment가 만든 파드', leadsTo: 0 },
          { text: 'ReplicaSet이 만든 파드', leadsTo: 0 },
          { text: '상위 컨트롤러 없이 만든 파드', correct: true },
        ],
        rationale:
          '컨테이너만 죽으면 kubelet이 같은 파드 안에서 다시 띄운다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '이미지를 고쳐도 조금만 받는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '이미 가진 층을 안 받는 근거는?',
        choices: [
          { text: '층마다 고유한 지문이 있다', correct: true },
          { text: '층 이름이 같으면 건너뛴다', leadsTo: 0 },
          { text: '크기를 비교한다', leadsTo: 0 },
          { text: '수정 시각을 본다', leadsTo: 0 },
        ],
        rationale:
          '바뀐 층만 새로 내려온다.',
      },
      {
        kind: 'misconception',
        stem: '한 명령에서 캐시를 못 쓰면 그 명령만 다시 도는가?',
        choices: [
          { text: '그렇다. 해당 층만 다시 만든다', leadsTo: 1 },
          { text: '아니다. 그 명령과 뒤따르는 명령이 전부 다시 실행된다', correct: true },
          { text: '그렇다. 앞뒤와 무관하다', leadsTo: 1 },
          { text: '아니다. 대신 전체가 처음부터 다시 돈다', leadsTo: 0 },
        ],
        rationale:
          '그래서 자주 바뀌는 것을 뒤에 둔다.',
      },
      {
        kind: 'boundary',
        stem: '다음 층에서 지운 비밀값은?',
        choices: [
          { text: '완전히 사라진다', leadsTo: 2 },
          { text: '아래층에 그대로 남아 이미지 안에 있다', correct: true },
          { text: '압축되어 읽을 수 없다', leadsTo: 2 },
          { text: '빌드가 실패한다', leadsTo: 3 },
        ],
        rationale:
          '지운 파일도 아래층에 남는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '빌드는 통과했는데 배포에서 깨지는 이유는?',
    items: [
      {
        kind: 'concept',
        stem: '결과물은 몇 번 만드는가?',
        choices: [
          { text: '단계마다 다시 만든다', leadsTo: 2 },
          { text: '한 번만 만들어 끝까지 들고 간다', correct: true },
          { text: '시험과 배포에서 각각 만든다', leadsTo: 2 },
          { text: '환경마다 하나씩 만든다', leadsTo: 1 },
        ],
        rationale:
          '배포에서 다시 빌드하면 시험이 확인한 것은 배포된 것이 아니게 된다.',
      },
      {
        kind: 'misconception',
        stem: '같은 소스면 언제 빌드해도 같은 결과물인가?',
        choices: [
          { text: '그렇다. 잠금 파일이 있으면 항상 같다', leadsTo: 2 },
          { text: '그렇다. 소스가 결과를 결정한다', leadsTo: 2 },
          { text: '아니다. 그사이 바뀐 의존성이 섞여 들어갈 수 있다', correct: true },
          { text: '아니다. 대신 매번 다르게 나온다', leadsTo: 2 },
        ],
        rationale:
          '시험한 것과 배포한 것이 달라지는 지점이다.',
      },
      {
        kind: 'boundary',
        stem: '이 방식으로도 남는 차이는?',
        choices: [
          { text: '시험 환경과 운영 환경의 자원·권한·이웃 서비스', correct: true },
          { text: '결과물의 내용', leadsTo: 0 },
          { text: '의존성 버전', leadsTo: 2 },
          { text: '남는 차이가 없다', leadsTo: 4 },
        ],
        rationale:
          '설정을 결과물 밖에 둬도 환경 자체의 차이는 남는다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '비밀번호를 앱에 안 주고 로그인하는 방법은?',
    items: [
      {
        kind: 'concept',
        stem: '인가 서버가 앱 서버에 먼저 주는 것은?',
        choices: [
          { text: '비밀번호', leadsTo: 0 },
          { text: '토큰', leadsTo: 3 },
          { text: '인가 코드', correct: true },
          { text: '갱신 토큰', leadsTo: 2 },
        ],
        rationale:
          '앱 서버는 코드와 앱 비밀키를 주고 토큰으로 바꾼다.',
      },
      {
        kind: 'misconception',
        stem: '코드와 토큰을 나누는 것이 절차상 형식인가?',
        choices: [
          { text: '그렇다. 표준이라 따를 뿐이다', leadsTo: 0 },
          { text: '그렇다. 한 번에 토큰을 줘도 같다', leadsTo: 3 },
          { text: '아니다. 코드는 주소 기록이나 referrer에 남을 수 있다', correct: true },
          { text: '아니다. 대신 코드만으로도 토큰이 된다', leadsTo: 0 },
        ],
        rationale:
          '그래서 코드만으로는 토큰이 되지 않게 한다.',
      },
      {
        kind: 'boundary',
        stem: '비밀키를 숨길 데가 없는 앱은?',
        choices: [
          { text: '인가 코드를 생략한다', leadsTo: 0 },
          { text: '비밀키를 코드에 넣는다', leadsTo: 0 },
          { text: '토큰을 주소창으로 바로 받는다', leadsTo: 3 },
          { text: 'PKCE로 묶는다', correct: true },
        ],
        rationale:
          '지금 권고는 어느 쪽이든 PKCE를 쓰는 것이다.',
      },
    ],
  },
  {
    identityScope: 'generic',
    question: '이미지와 컨테이너는 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: '컨테이너가 이미지 위에 얹는 것은?',
        choices: [
          { text: '런타임 층 사본', leadsTo: 1 },
          { text: '베이스 층 사본', leadsTo: 1 },
          { text: '쓰기 층 하나', correct: true },
          { text: '아무것도 얹지 않는다', leadsTo: 2 },
        ],
        rationale:
          '이미지는 읽기만 되는 층들이다.',
      },
      {
        kind: 'misconception',
        stem: '같은 이미지로 열 개를 띄우면 디스크도 열 배인가?',
        choices: [
          { text: '그렇다. 각자 이미지를 복사한다', leadsTo: 1 },
          { text: '아니다. 읽기 전용 층을 함께 쓰고 얇은 쓰기 층만 는다', correct: true },
          { text: '그렇다. 층마다 사본이 생긴다', leadsTo: 1 },
          { text: '아니다. 대신 전혀 늘지 않는다', leadsTo: 2 },
        ],
        rationale:
          '그 뒤로는 각자 쓴 파일과 로그만큼 는다.',
      },
      {
        kind: 'boundary',
        stem: '컨테이너를 고쳐 저장하는 방식을 안 쓰는 이유는?',
        choices: [
          { text: '쓰기 층이 사라져서', leadsTo: 2 },
          { text: '용량이 커져서', leadsTo: 4 },
          { text: '기술적으로 불가능해서', leadsTo: 3 },
          { text: '무엇이 들었는지 아무도 모르는 이미지가 된다', correct: true },
        ],
        rationale:
          '고칠 것은 만드는 파일 쪽이다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '비밀번호를 그냥 해시하면 왜 안 되는가?',
    items: [
      {
        kind: 'concept',
        stem: '소금이 막는 것은?',
        choices: [
          { text: '미리 만든 표로 한꺼번에 대조하는 것', correct: true },
          { text: '한 사람을 노린 공격', leadsTo: 0 },
          { text: '해시 함수가 빠른 것', leadsTo: 3 },
          { text: '유출 자체', leadsTo: 0 },
        ],
        rationale:
          '사용자마다 다른 값을 붙여 같은 비밀번호여도 결과가 달라진다.',
      },
      {
        kind: 'misconception',
        stem: '소금을 붙였으면 안전한가?',
        choices: [
          { text: '그렇다. 소금이면 충분하다', leadsTo: 0 },
          { text: '아니다. 한 사람을 노려 그 소금으로 다시 만들면 된다', correct: true },
          { text: '그렇다. 소금을 숨기면 완전하다', leadsTo: 1 },
          { text: '아니다. 대신 소금은 필요 없다', leadsTo: 0 },
        ],
        rationale:
          '빠른 함수라면 그게 오래 안 걸린다.',
      },
      {
        kind: 'boundary',
        stem: '느리게 만드는 정도는 무엇으로 정하는가?',
        choices: [
          { text: '사용자 수에 비례해', leadsTo: 3 },
          { text: '가능한 한 최대로', leadsTo: 3 },
          { text: '해시 길이에 맞춰', leadsTo: 2 },
          { text: '서버가 견디는 선', correct: true },
        ],
        rationale:
          '로그인 한 번에 수백 밀리초쯤이 흔한 기준이다.',
      },
    ],
  },
  {
    identityScope: 'git',
    question: '되돌리기와 지우기는 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: '되돌리기는 이력을 어떻게 바꾸는가?',
        choices: [
          { text: '무르는 기록을 하나 더 얹는다', correct: true },
          { text: '해당 기록을 이력에서 뺀다', leadsTo: 1 },
          { text: '가지가 가리키는 자리를 뒤로 옮긴다', leadsTo: 2 },
          { text: '이력을 바꾸지 않는다', leadsTo: 4 },
        ],
        rationale:
          '지우기는 가리키는 자리를 옮겨 그 뒤 기록을 이력에서 뺀다.',
      },
      {
        kind: 'misconception',
        stem: '남이 받아 간 가지도 지워서 정리하면 되는가?',
        choices: [
          { text: '그렇다. 남도 자동으로 맞춰진다', leadsTo: 1 },
          { text: '그렇다. 이력이 깔끔해진다', leadsTo: 3 },
          { text: '아니다. 남의 기록과 갈라져 다음 합칠 때 충돌한다', correct: true },
          { text: '아니다. 대신 혼자 쓰는 가지도 지우면 안 된다', leadsTo: 3 },
        ],
        rationale:
          '혼자 쓰는 가지라면 지워도 된다.',
      },
      {
        kind: 'boundary',
        stem: '실수로 올린 비밀번호는 되돌리기로 해결되는가?',
        choices: [
          { text: '그렇다. 다음 커밋이 덮어 흔적이 없어진다', leadsTo: 0 },
          { text: '그렇다. 무르는 커밋을 얹으면 함께 사라진다', leadsTo: 1 },
          { text: '아니다. 되돌린 기록도 이력에 남는다', correct: true },
          { text: '아니다. 대신 지우기로 해결된다', leadsTo: 0 },
        ],
        rationale:
          '기록 자체를 다시 써야 하고 이미 나갔다면 폐기가 먼저다.',
      },
    ],
  },
  {
    identityScope: 'infra',
    question: '요청이 한꺼번에 몰릴 때 어떻게 막는가?',
    items: [
      {
        kind: 'concept',
        stem: '토큰 버킷이 짧은 급증을 허용하는 원리는?',
        choices: [
          { text: '거절을 미룬다', leadsTo: 3 },
          { text: '대기열을 늘린다', leadsTo: 3 },
          { text: '한도를 일시적으로 올린다', leadsTo: 4 },
          { text: '평소 남겨 둔 토큰을 쓴다', correct: true },
        ],
        rationale:
          '계속 몰리면 토큰이 채워지는 속도까지만 통과한다.',
      },
      {
        kind: 'misconception',
        stem: 'rate limit을 걸면 서버 과부하도 막히는가?',
        choices: [
          { text: '그렇다. 두 가지는 같은 문제다', leadsTo: 3 },
          { text: '그렇다. 초당 요청 수를 막으면 충분하다', leadsTo: 4 },
          { text: '아니다. 느린 요청 100개가 오래 붙잡으면 자원이 바닥난다', correct: true },
          { text: '아니다. 대신 대기열을 늘리면 된다', leadsTo: 3 },
        ],
        rationale:
          '실제 동시 요청 수와 대기열, CPU와 지연을 보고 진입을 줄여야 한다.',
      },
      {
        kind: 'boundary',
        stem: '할당량 초과와 서비스 과부하는 어떻게 구분하는가?',
        choices: [
          { text: '둘 다 429로 답한다', leadsTo: 1 },
          { text: '429와 503으로 나눈다', correct: true },
          { text: '둘 다 503으로 답한다', leadsTo: 1 },
          { text: '구분하지 않는다', leadsTo: 1 },
        ],
        rationale:
          '재시도를 허용할 때는 Retry-After와 지수 백오프, jitter를 함께 안내한다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '누가 무엇을 할 수 있는지 어떻게 정하는가?',
    items: [
      {
        kind: 'concept',
        stem: '사람에게 붙는 것은?',
        choices: [
          { text: '조건식', leadsTo: 2 },
          { text: '권한 하나하나', leadsTo: 1 },
          { text: '역할', correct: true },
          { text: '인증 결과', leadsTo: 0 },
        ],
        rationale:
          '권한이 바뀌면 역할 하나만 고쳐 그 역할을 가진 모두에게 반영된다.',
      },
      {
        kind: 'misconception',
        stem: '역할을 잘게 쪼갤수록 정밀해지는가?',
        choices: [
          { text: '그렇다. 잘게 나눌수록 정밀해서 낫다', leadsTo: 1 },
          { text: '아니다. 사람마다 역할이 하나씩 생기면 같아진다', correct: true },
          { text: '그렇다. 역할이 몇 개든 관리 비용은 같다', leadsTo: 1 },
          { text: '아니다. 대신 역할을 하나만 둔다', leadsTo: 3 },
        ],
        rationale:
          '역할을 사이에 두는 이점이 사라진다.',
      },
      {
        kind: 'boundary',
        stem: '"자기가 쓴 글만 고칠 수 있다"는 왜 역할로 안 되는가?',
        choices: [
          { text: '쓸 수 있는 역할 수가 부족해서', leadsTo: 1 },
          { text: '누구냐와 그 글이 누구 것이냐의 관계라서', correct: true },
          { text: '누구인지 인증이 안 되어서', leadsTo: 0 },
          { text: '붙일 권한 이름이 너무 길어서', leadsTo: 1 },
        ],
        rationale:
          '역할 이름만으로는 못 적어 조건을 함께 보는 방식을 쓴다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '인코딩과 암호화와 해싱은 무엇이 다른가?',
    items: [
      {
        kind: 'concept',
        stem: '셋을 가르는 기준은?',
        choices: [
          { text: '표준화 여부', leadsTo: 3 },
          { text: '결과 문자열의 길이', leadsTo: 4 },
          { text: '연산 속도', leadsTo: 1 },
          { text: '되돌릴 수 있는지와 무엇을 위해 쓰는지', correct: true },
        ],
        rationale:
          '인코딩은 옮기려고, 암호화는 감추려고, 해싱은 같은지 확인하려고 모양을 바꾼다.',
      },
      {
        kind: 'misconception',
        stem: 'base64로 담으면 내용이 감춰지는가?',
        choices: [
          { text: '아니다. 누구나 원래대로 되돌려 읽는다', correct: true },
          { text: '그렇다. 사람이 못 읽는 형태가 된다', leadsTo: 0 },
          { text: '그렇다. 열쇠가 있어야 되돌린다', leadsTo: 0 },
          { text: '아니다. 대신 되돌리는 계산이 없다', leadsTo: 0 },
        ],
        rationale:
          '바이너리를 글자만 다루는 통로로 보내려고 모양을 바꾼 것이다.',
      },
      {
        kind: 'boundary',
        stem: '되돌리는 계산이 없다는 것이 못 알아낸다는 뜻인가?',
        choices: [
          { text: '아니다. 대신 열쇠로 되돌린다', leadsTo: 2 },
          { text: '그렇다. 수학적으로 불가능하다', leadsTo: 1 },
          { text: '그렇다. 같은 값이 안 나온다', leadsTo: 4 },
          { text: '아니다. 후보가 적으면 하나씩 넣어 보며 찾는다', correct: true },
        ],
        rationale:
          '비밀번호에 소금과 느린 해시를 쓰는 이유가 이것이다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '무작위 값은 어디서 만들어야 안전한가?',
    items: [
      {
        kind: 'concept',
        stem: '씨앗을 시각으로 정하면 무엇이 가능해지는가?',
        choices: [
          { text: '같은 값이 자주 나와 중복이 생긴다', leadsTo: 2 },
          { text: '난수가 한쪽에 몰려 고르게 퍼지지 않는다', leadsTo: 0 },
          { text: '만들어지는 값의 길이가 짧아진다', leadsTo: 1 },
          { text: '만든 때를 아는 공격자가 씨앗 후보를 좁혀 수열을 재현한다', correct: true },
        ],
        rationale:
          '씨앗에 예측하기 어려운 값이 섞이면 이 재현이 안 된다.',
      },
      {
        kind: 'misconception',
        stem: '흔히 쓰는 난수 함수도 맞히기 어려운가?',
        choices: [
          { text: '그렇다. 고르게 퍼지면 안전하다', leadsTo: 0 },
          { text: '그렇다. 무작위면 예측할 수 없다', leadsTo: 0 },
          { text: '아니다. 몇 개만 보면 다음 값을 계산할 수 있는 것도 있다', correct: true },
          { text: '아니다. 대신 느려서 못 쓴다', leadsTo: 0 },
        ],
        rationale:
          '빠르고 고르게 퍼지도록 만들어졌지 맞히기 어렵게 만들어지지 않았다.',
      },
      {
        kind: 'boundary',
        stem: '원천이 좋으면 그것으로 충분한가?',
        choices: [
          { text: '그렇다. 원천이 전부다', leadsTo: 1 },
          { text: '아니다. 짧으면 전부 시도해 볼 수 있어 길이도 함께 본다', correct: true },
          { text: '그렇다. 길이는 상관없다', leadsTo: 1 },
          { text: '아니다. 대신 순번을 섞으면 된다', leadsTo: 4 },
        ],
        rationale:
          '주소에 순번이 드러나면 남의 자원을 순서대로 훑을 수 있다.',
      },
    ],
  },
  {
    identityScope: 'security',
    question: '사용자 입력을 왜 전부 의심해야 하는가?',
    items: [
      {
        kind: 'concept',
        stem: 'SQL 인젝션과 XSS가 공유하는 구조는?',
        choices: [
          { text: '인증을 건너뛰는 것', leadsTo: 3 },
          { text: '입력이 너무 긴 것', leadsTo: 3 },
          { text: '데이터가 코드로 해석되는 것', correct: true },
          { text: '권한이 넓은 것', leadsTo: 3 },
        ],
        rationale:
          '해석기는 어디까지가 데이터인지 모른다.',
      },
      {
        kind: 'misconception',
        stem: '이스케이프 한 번이면 어디서나 안전한가?',
        choices: [
          { text: '아니다. HTML과 자바스크립트 문자열과 URL은 위험한 글자가 다르다', correct: true },
          { text: '그렇다. 한 번의 치환으로 전부 막는다', leadsTo: 2 },
          { text: '그렇다. 문맥과 무관하다', leadsTo: 2 },
          { text: '아니다. 대신 바인딩으로 화면도 처리한다', leadsTo: 2 },
        ],
        rationale:
          'HTML 자체를 허용한다면 치환이 아니라 정화 도구가 필요하다.',
      },
      {
        kind: 'boundary',
        stem: '의심할 범위는 어디까지인가?',
        choices: [
          { text: '쿼리 문자열까지만', leadsTo: 4 },
          { text: '폼 입력만', leadsTo: 4 },
          { text: '헤더와 쿠키, URL 경로, 업로드된 파일 이름까지', correct: true },
          { text: '화면에서 검증을 통과하지 못한 것만', leadsTo: 3 },
        ],
        rationale:
          '신뢰 경계 밖에서 온 것은 전부 같은 자격이고 클라이언트 검증은 보안이 아니다.',
      },
    ],
  },
  {
    identityScope: 'docker',
    question: '컨테이너 이미지를 최소화해야 하는 이유는 무엇인가?',
    items: [
      {
        kind: 'concept',
        stem: '셸이나 도구가 많으면 무엇이 쉬워지는가?',
        choices: [
          { text: '컨테이너 시작', leadsTo: 2 },
          { text: '이미지 빌드', leadsTo: 1 },
          { text: '취약점 스캔', leadsTo: 4 },
          { text: '침투 후 내부망 탐색과 추가 악성 코드 설치', correct: true },
        ],
        rationale:
          'Distroless 이미지는 침투한 뒤 쓸 수 있는 도구를 줄인다.',
      },
      {
        kind: 'misconception',
        stem: '이미지를 줄이면 빌드 시간도 주는가?',
        choices: [
          { text: '아니다. 다단계 빌드 탓에 오히려 늘 수 있다', correct: true },
          { text: '그렇다. 작을수록 빨리 만든다', leadsTo: 1 },
          { text: '그렇다. 층이 줄어 빌드도 빨라진다', leadsTo: 1 },
          { text: '아니다. 대신 배포도 느려진다', leadsTo: 2 },
        ],
        rationale:
          '줄어드는 것은 저장 공간과 내려받는 양이다.',
      },
      {
        kind: 'boundary',
        stem: '오토스케일링 환경에서 특히 중요한 이유는?',
        choices: [
          { text: '취약점이 더 많아지기 때문이다', leadsTo: 4 },
          { text: '빌드를 자주 하기 때문이다', leadsTo: 1 },
          { text: '노드에 이미지를 빠르게 풀링하는 것이 가용성에 직결된다', correct: true },
          { text: '런타임 의존성이 늘기 때문이다', leadsTo: 2 },
        ],
        rationale:
          '새 노드가 뜰 때마다 내려받는 양이 그대로 지연이 된다.',
      },
    ],
  },
]
