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
          { text: 'DB로 나가는 커넥션 수에 상한을 둔다', correct: true },
          { text: '질의 결과를 캐시해 왕복을 줄인다', leadsTo: 1 },
          { text: '끊긴 커넥션을 자동으로 되살린다', leadsTo: 3 },
        ],
        rationale:
          '재사용은 눈에 띄는 쪽이고, 상한이 더 중요하다. 상한이 없으면 동시 요청이 몰릴 때 DB가 질의 대신 커넥션 생성과 해제에 자원을 쓴다.',
      },
      {
        kind: 'boundary',
        stem: '풀 크기를 크게 잡으면 생기는 일은?',
        choices: [
          { text: '처리량이 코어 수에 비례해 늘어난다', leadsTo: 1 },
          { text: 'DB 자원을 과점유한다', correct: true },
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
          { text: '가용성이 높아진다', correct: true },
          { text: '보상 로직을 안 짜도 된다', leadsTo: 0 },
          { text: '중간 상태가 외부에 안 보인다', leadsTo: 3 },
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
          { text: '누가 먼저 연결을 닫는지 확인한다', correct: true },
          { text: 'CLOSE_WAIT 수부터 줄인다', leadsTo: 4 },
        ],
        rationale:
          '설정을 만지기 전에 원인을 본다. 짧은 연결을 반복해 맺는 것이 원인이면 keep-alive와 연결 풀이 먼저다.',
      },
      {
        kind: 'boundary',
        stem: 'TIME_WAIT 소켓이 많다는 사실 자체가 뜻하는 것은?',
        choices: [
          { text: '이미 장애 상태다', leadsTo: 2 },
          { text: '그 호스트가 능동 종료를 많이 했다는 신호다', correct: true },
          { text: '상대가 FIN을 안 보내고 있다', leadsTo: 4 },
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
          { text: '레지스터와 PC를 저장·복원하는 직접 비용', leadsTo: 1 },
          { text: '캐시가 밀려나고 TLB를 다시 채우는 간접 비용', correct: true },
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
          { text: '대기 중인 스레드는 CPU를 점유하지 않는다', correct: true },
          { text: 'I/O는 컨텍스트 스위칭을 일으키지 않는다', leadsTo: 3 },
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
          { text: '쓸 수 없는 경우와 쓰지 않기로 한 경우', correct: true },
          { text: '읽기 질의냐 쓰기 질의냐', leadsTo: 4 },
          { text: '단일 인덱스냐 복합 인덱스냐', leadsTo: 0 },
        ],
        rationale:
          '실행 계획에서 후보에도 안 오르면 쓸 수 없는 경우이고, 후보에 있는데 안 고르면 통계나 비용 추정 문제다.',
      },
      {
        kind: 'misconception',
        stem: '인덱스 컬럼에 함수를 씌운 조건은 어떻게 되는가?',
        choices: [
          { text: '인덱스가 무력해진다', correct: true },
          { text: '옵티마이저가 알아서 풀어 준다', leadsTo: 2 },
          { text: '느려지지만 인덱스는 그대로 탄다', leadsTo: 2 },
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
          { text: '풀 스캔이 더 빠를 수 있다', correct: true },
          { text: '복합 인덱스로 바꾸면 해결된다', leadsTo: 0 },
          { text: '커버링 인덱스만이 답이다', leadsTo: 4 },
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
          { text: '응답을 요청 순서대로 내보내야 한다', correct: true },
          { text: '한 연결에 요청을 하나만 실을 수 있다', leadsTo: 2 },
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
          { text: '오히려 비용이 될 수 있다', correct: true },
          { text: '동작하지 않아 오류가 난다', leadsTo: 3 },
          { text: '서버 푸시가 자동으로 대신한다', leadsTo: 1 },
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
          { text: '다음에 물어볼 곳의 주소', correct: true },
          { text: '캐시에 저장된 이전 응답', leadsTo: 0 },
          { text: '도메인 전체 목록', leadsTo: 1 },
        ],
        rationale:
          '한 번에 답을 주는 것이 아니라 다음에 물을 곳을 알려준다. 루트가 모든 도메인을 알 필요가 없어서 이 구조가 버틴다.',
      },
      {
        kind: 'misconception',
        stem: '기존 53번 포트 DNS의 전송 프로토콜은?',
        choices: [
          { text: 'UDP 하나로 고정돼 있다', leadsTo: 2 },
          { text: 'UDP로 시작하는 경우가 많지만 TCP도 지원해야 한다', correct: true },
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
          { text: 'TTL을 미리 낮춰둔다', correct: true },
          { text: '옮긴 뒤에 TTL을 낮춘다', leadsTo: 0 },
          { text: '전 세계 캐시를 즉시 지운다', leadsTo: 0 },
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
          { text: '패킷 손실만이 유일한 신호다', leadsTo: 2 },
          { text: '손실 외에 ECN, 지연·전달률도 쓴다', correct: true },
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
          { text: '생략할 수 없다. 대신 연결을 재사용한다', correct: true },
          { text: '두 단계로 줄일 수 있다', leadsTo: 1 },
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
          { text: '핸드셰이크는 그대로 돌고 데이터를 SYN에 싣는다', correct: true },
          { text: '첫 연결부터 왕복 없이 보낸다', leadsTo: 3 },
          { text: '초기 순번 확인을 생략한다', leadsTo: 0 },
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
          { text: '일부 손실을 허용하고 최신 데이터가 더 중요할 때', correct: true },
          { text: '순서와 재전송 보장이 필요할 때', leadsTo: 2 },
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
          { text: 'max-age 안에 있고 재검증 강제 지시자가 없을 때', correct: true },
          { text: '검증자가 붙어 있을 때', leadsTo: 0 },
          { text: '같은 사용자가 다시 요청했을 때', leadsTo: 1 },
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
          { text: '저장은 되지만 쓸 때마다 재검증한다', correct: true },
          { text: '공유 캐시에만 저장한다', leadsTo: 1 },
          { text: '검증자를 무시한다', leadsTo: 3 },
        ],
        rationale:
          'no-cache는 저장 금지가 아니다. 캐시에 보관해도 되지만 사용할 때마다 ETag나 Last-Modified로 확인하라는 뜻이다. 저장을 막는 것은 no-store다.',
      },
      {
        kind: 'boundary',
        stem: '304 Not Modified를 받으면 무엇이 절약되는가?',
        choices: [
          { text: '전송량은 줄지만 왕복은 남는다', correct: true },
          { text: '왕복까지 사라진다', leadsTo: 4 },
          { text: '아무것도 절약되지 않는다', leadsTo: 0 },
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
          { text: '책임이 요청·권한 쪽인지 서버 처리 쪽인지', correct: true },
          { text: '오류의 심각도', leadsTo: 2 },
          { text: '재시도 횟수', leadsTo: 4 },
          { text: '응답 본문의 유무', leadsTo: 3 },
        ],
        rationale:
          '요청이나 인증·권한·사용량 제한 같은 클라이언트 측 조건 때문에 처리할 수 없으면 4xx, 서버가 정상 요청을 처리하지 못하면 5xx다.',
      },
      {
        kind: 'misconception',
        stem: '신원은 확인됐지만 권한이 없을 때는?',
        choices: [
          { text: '401을 쓴다', leadsTo: 1 },
          { text: '403을 쓴다', correct: true },
          { text: '400을 쓴다', leadsTo: 0 },
          { text: '409를 쓴다', leadsTo: 4 },
        ],
        rationale:
          '401은 인증이 필요하다는 뜻이고 403은 신원을 알아도 권한이 없다는 뜻이다. 존재를 숨기려면 404를 택할 수도 있다.',
      },
      {
        kind: 'boundary',
        stem: '내부 오류를 200으로 감싸면 생기는 문제는?',
        choices: [
          { text: '중간 장비가 실패를 오해한다', correct: true },
          { text: '클라이언트만 조금 헷갈린다', leadsTo: 4 },
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
          { text: '신뢰 사슬·도메인·유효 기간과 서버의 개인 키 소유', correct: true },
          { text: '사이트 운영자의 신원과 사업자 등록', leadsTo: 4 },
          { text: '전송 구간의 압축 여부', leadsTo: 3 },
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
          { text: '사이트의 신뢰성과 안전한 운영', correct: true },
          { text: '접속 호스트와 인증서 이름의 일치', leadsTo: 1 },
          { text: '상위 인증서의 서명', leadsTo: 0 },
        ],
        rationale:
          '사이트의 신뢰성이나 안전한 운영까지 보장하지는 않는다. 폐기 조회 실패를 엄격히 막지 않는 구현도 있어 절대적 보증으로 보면 안 된다.',
      },
      {
        kind: 'boundary',
        stem: '발급 대상이 다른 유효한 인증서를 가져오면?',
        choices: [
          { text: '도메인 이름 확인 단계에서 막힌다', correct: true },
          { text: '유효 기간이 남아 있으면 통과한다', leadsTo: 0 },
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
          { text: '암호 규칙 합의, 서버 인증, 통신 키 생성', correct: true },
          { text: '압축 방식과 언어 협상', leadsTo: 1 },
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
          { text: '일반적인 새 연결을 1-RTT로 줄였다', correct: true },
          { text: '인증서 검증을 생략했다', leadsTo: 0 },
          { text: '대칭 키를 안 쓰게 됐다', leadsTo: 2 },
        ],
        rationale:
          'TLS 1.3은 키 교환에 필요한 값을 첫 메시지부터 보내 일반적인 새 연결을 1-RTT로 줄였다. 왕복이 사라진 것은 아니다.',
      },
      {
        kind: 'boundary',
        stem: '0-RTT 데이터를 쓸 때 걸어야 할 제한은?',
        choices: [
          { text: '멱등한 요청에만 쓴다', correct: true },
          { text: '첫 연결에만 쓴다', leadsTo: 3 },
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
          { text: '접속하는 사용자', leadsTo: 0 },
          { text: '서비스 운영자', correct: true },
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
          { text: '요청 라우팅과 분산, TLS 종료 같은 공통 기능', correct: true },
          { text: '사내 인터넷 접근 통제', leadsTo: 0 },
          { text: '사용자 브라우저 캐시 관리', leadsTo: 3 },
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
          { text: '라운드 로빈', leadsTo: 3 },
          { text: '최소 연결', correct: true },
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
          { text: '연결당 비용이 다르면 틀릴 수 있다', correct: true },
          { text: '가중치를 주면 항상 정확해진다', leadsTo: 0 },
          { text: '헬스 체크가 있으면 정확해진다', leadsTo: 3 },
        ],
        rationale:
          'CPU와 지연을 반영하는 방식은 정확도가 높지만 측정 지연과 진동을 제어해야 한다. 정적 가중치는 실제 부하 변화를 늦게 반영한다.',
      },
      {
        kind: 'boundary',
        stem: '알고리즘을 고르기 전에 갖춰야 할 것은?',
        choices: [
          { text: '비정상 노드를 빼는 헬스 체크', correct: true },
          { text: '세션 고정 설정', leadsTo: 0 },
          { text: '무제한 재시도', leadsTo: 4 },
          { text: '노드 수를 2의 거듭제곱으로 맞추기', leadsTo: 1 },
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
          { text: '갱신이 잦고 낮은 지연이나 양방향 전송이 필요할 때', correct: true },
          { text: '갱신이 드물고 운영 단순함이 중요할 때', leadsTo: 0 },
          { text: '클라이언트가 많을수록 언제나', leadsTo: 2 },
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
          { text: '수용량·하트비트·재연결·역압력을 따로 설계해야 한다', correct: true },
          { text: '재연결만 붙이면 된다', leadsTo: 1 },
          { text: '폴링보다 항상 단순하다', leadsTo: 0 },
        ],
        rationale:
          '한 번 업그레이드한 뒤 프레임을 주고받지만, 연결 수용량과 하트비트, 재연결, 느린 소비자에 대한 역압력을 설계해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '서버에서 클라이언트로만 흐르는 경우의 대안은?',
        choices: [
          { text: 'Server-Sent Events', correct: true },
          { text: '짧은 폴링만이 답이다', leadsTo: 0 },
          { text: '양방향 웹소켓이 유일하다', leadsTo: 1 },
          { text: '하트비트를 없앤 연결', leadsTo: 2 },
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
          { text: '프록시와 관측 도구의 지원 여부', correct: true },
          { text: '데이터베이스 종류', leadsTo: 4 },
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
          { text: 'HTTP의 의미를 얼마나 충실히 사용하는가', correct: true },
          { text: '응답 속도가 얼마나 빠른가', leadsTo: 4 },
          { text: '문서가 얼마나 자세한가', leadsTo: 2 },
          { text: '지원하는 클라이언트 수', leadsTo: 1 },
        ],
        rationale:
          '리소스를 URI로 나누고 메서드와 상태 코드를 의미에 맞게 쓰며 응답이 다음 행동 링크를 제공하는지로 판단한다.',
      },
      {
        kind: 'misconception',
        stem: 'Level 3이 모든 API가 지향할 목표인가?',
        choices: [
          { text: '그렇다. 높을수록 좋은 API다', leadsTo: 1 },
          { text: '아니다. 복잡성의 이득이 있는지 따져야 한다', correct: true },
          { text: 'Level 3이 아니면 REST가 아니다', leadsTo: 0 },
          { text: '단계는 성능 순위를 뜻한다', leadsTo: 4 },
        ],
        rationale:
          '높은 단계가 모든 API의 품질 순위는 아니다. 조직의 클라이언트 통제 범위와 변경 빈도에 비해 복잡성의 이득이 있는지 판단해야 한다.',
      },
      {
        kind: 'boundary',
        stem: 'Level 2까지만 올라가도 얻는 것은?',
        choices: [
          { text: '자원과 행위, 오류 의미가 명확해진다', correct: true },
          { text: '클라이언트 결합이 완전히 사라진다', leadsTo: 1 },
          { text: '링크만 따라가면 되는 클라이언트가 된다', leadsTo: 1 },
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
          { text: '클라이언트가 서버에 요구하는 의미', correct: true },
          { text: 'CRUD 이름과의 대응', leadsTo: 0 },
          { text: '요청 본문의 크기', leadsTo: 4 },
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
          { text: '클라이언트가 대상 URI를 알면 PUT이 맞을 수 있다', correct: true },
          { text: 'PATCH로 만들어야 한다', leadsTo: 3 },
          { text: 'PUT은 수정에만 쓴다', leadsTo: 0 },
        ],
        rationale:
          '생성은 무조건 POST라는 규칙은 없다. 서버가 새 URI를 정하는 컬렉션 처리는 POST와 잘 맞고, 클라이언트가 URI를 알고 같은 표현으로 대체한다면 PUT이 맞을 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '멱등하다는 것은 무엇이 같다는 뜻인가?',
        choices: [
          { text: '서버에 요청한 효과가 한 번과 같다', correct: true },
          { text: '응답 코드까지 매번 같다', leadsTo: 1 },
          { text: '로그 기록까지 같다', leadsTo: 2 },
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
          { text: '포트 번호', correct: true },
          { text: 'IP 주소', leadsTo: 4 },
          { text: '프로세스 이름', leadsTo: 1 },
          { text: '패킷 도착 순서', leadsTo: 3 },
        ],
        rationale:
          '전송 계층은 포트 번호로 프로세스를 구분하고, 네트워크 계층은 IP 주소로 호스트를 구분한다.',
      },
      {
        kind: 'misconception',
        stem: 'UDP와 TCP는 같은 방식으로 소켓을 가려내는가?',
        choices: [
          { text: '같다. 둘 다 포트만 본다', leadsTo: 0 },
          { text: '다르다. TCP는 네 요소를 모두 본다', correct: true },
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
          { text: '첫 번째 자리 숫자', correct: true },
          { text: '마지막 자리 숫자', leadsTo: 0 },
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
          { text: '인증이나 한도처럼 그렇지 않은 것도 있다', correct: true },
          { text: '재시도만 하면 언제나 통과한다', leadsTo: 4 },
          { text: '서버가 고쳐야 한다', leadsTo: 4 },
        ],
        rationale:
          '4xx는 요청 쪽 사정으로 서버가 처리하지 못했다는 뜻이다. 고쳐 보내면 되는 것도 있고 인증이나 한도처럼 그렇지 않은 것도 있다.',
      },
      {
        kind: 'boundary',
        stem: '5xx가 뜻하는 것은?',
        choices: [
          { text: '요청은 멀쩡한데 서버가 못 해냈다', correct: true },
          { text: '요청 형식이 잘못됐다', leadsTo: 1 },
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
          { text: '변경 사항의 맥락 파악과 작성자와의 소통', correct: true },
          { text: '병합 도구의 자동 해결 기능', leadsTo: 4 },
          { text: '최신 커밋을 무조건 채택', leadsTo: 0 },
          { text: '작업 내용을 잠시 치워두기', leadsTo: 3 },
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
          { text: '웹소켓은 애플리케이션 계층, 소켓은 전송 계층', correct: true },
          { text: '둘 다 전송 계층이다', leadsTo: 4 },
          { text: '웹소켓이 더 아래에 있다', leadsTo: 0 },
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
          { text: '자기 프레임으로 양쪽이 아무 때나 보낸다', correct: true },
          { text: '계속 HTTP 요청-응답을 반복한다', leadsTo: 2 },
          { text: '서버만 보낼 수 있다', leadsTo: 3 },
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
          { text: '여러 개가 붙을 수 있고 사설 주소는 겹칠 수도 있다', correct: true },
          { text: '인터페이스와 무관하게 하나다', leadsTo: 1 },
          { text: '운영체제가 하나로 통합한다', leadsTo: 4 },
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
          { text: '같은 출처의 로컬 스토리지와 HttpOnly가 없는 쿠키', correct: true },
          { text: '모든 쿠키와 모든 출처의 저장소', leadsTo: 0 },
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
          { text: '스크립트가 그 쿠키를 못 읽는다', correct: true },
          { text: '똑같이 읽을 수 있다', leadsTo: 0 },
          { text: '암호화돼 있어 읽어도 못 쓴다', leadsTo: 2 },
          { text: '서버로만 전송되지 않는다', leadsTo: 0 },
        ],
        rationale:
          'HttpOnly가 붙어 있으면 스크립트가 그 쿠키를 못 읽는다. 로컬 스토리지에는 이런 보호가 없다.',
      },
      {
        kind: 'boundary',
        stem: '피해가 정보 유출에서 끝나는가?',
        choices: [
          { text: '페이지 내용을 바꿔 피싱으로도 이어진다', correct: true },
          { text: '읽기만 가능해 유출에서 끝난다', leadsTo: 1 },
          { text: '서버 파일까지 지울 수 있다', leadsTo: 3 },
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
          { text: '쿠키는 브라우저, 세션은 서버', correct: true },
          { text: '둘 다 브라우저', leadsTo: 3 },
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
          { text: '모든 요청에 실린다', leadsTo: 1 },
          { text: '도메인·경로와 Secure·SameSite 조건에 맞는 요청에만 실린다', correct: true },
          { text: '스크립트가 붙여야만 실린다', leadsTo: 1 },
          { text: '같은 탭에서만 실린다', leadsTo: 3 },
        ],
        rationale:
          '쿠키는 도메인·경로와 Secure·SameSite 조건에 맞는 요청에만 자동으로 실린다.',
      },
      {
        kind: 'boundary',
        stem: '세션 방식이 치르는 비용은?',
        choices: [
          { text: '사용자 수가 늘면 서버 부하가 늘어난다', correct: true },
          { text: '클라이언트가 데이터를 조작할 수 있다', leadsTo: 1 },
          { text: '저장 용량이 브라우저 한도에 묶인다', leadsTo: 3 },
          { text: '요청마다 전체 데이터를 실어 보낸다', leadsTo: 2 },
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
          { text: '캐시와 기존 연결이 남아 있는지 확인한다', correct: true },
          { text: '무조건 이름 조회부터 한다', leadsTo: 0 },
          { text: '바로 보안 연결을 맺는다', leadsTo: 2 },
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
          { text: '브라우저와 운영체제 캐시를 먼저 본다', correct: true },
          { text: '서버가 대신 찾아준다', leadsTo: 0 },
          { text: '연결이 있으면 이름이 바뀐다', leadsTo: 3 },
        ],
        rationale:
          '브라우저와 운영체제의 DNS 캐시에 주소가 없을 때만 설정된 재귀 리졸버에 묻는다.',
      },
      {
        kind: 'boundary',
        stem: 'HTTP/3에서 보안 연결은 어떻게 맺는가?',
        choices: [
          { text: 'QUIC 연결 설정에 TLS 1.3 핸드셰이크가 통합돼 있다', correct: true },
          { text: 'TCP를 맺은 뒤 따로 TLS를 한다', leadsTo: 2 },
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
          { text: '전송 계층 위에 얹은 TLS 보안 계층', correct: true },
          { text: '더 빠른 전송 프로토콜', leadsTo: 3 },
          { text: '압축 계층', leadsTo: 3 },
          { text: '새로운 요청 메서드', leadsTo: 0 },
        ],
        rationale:
          'HTTP에 SSL/TLS 프로토콜을 추가해 데이터를 암호화한 것이다. 암호화와 인증으로 도청과 변조, 위조를 막는다.',
      },
      {
        kind: 'misconception',
        stem: '대칭키는 어떻게 양쪽이 나눠 갖는가?',
        choices: [
          { text: '비대칭키로 암호화해 실어 보낸다', leadsTo: 1 },
          { text: '각자 낸 값을 합쳐 만든 공유 비밀에서 뽑는다', correct: true },
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
          { text: '기본이 아니다. 필요하면 따로 켠다', correct: true },
          { text: '항상 양쪽이 서로 확인한다', leadsTo: 2 },
          { text: '인증서가 있으면 자동으로 된다', leadsTo: 2 },
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
          { text: '별도 저장소 없이 사용자를 식별한다', correct: true },
          { text: '요청마다 데이터베이스를 읽는다', leadsTo: 4 },
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
          { text: '자동으로 공유된다', leadsTo: 4 },
          { text: '불일치가 생겨 외부 저장소로 모아야 한다', correct: true },
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
          { text: '실제 데이터를 서버가 관리해 조작이 어렵다', correct: true },
          { text: '전송 구간이 암호화되기 때문이다', leadsTo: 2 },
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
          { text: '상태를 바꾸는지와 멱등한지', correct: true },
          { text: '본문이 있는지와 캐시되는지', leadsTo: 2 },
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
          { text: '구현 방식에 따라 멱등할 수도 있다', correct: true },
          { text: '언제나 멱등이다', leadsTo: 1 },
          { text: '멱등성과 무관하다', leadsTo: 0 },
        ],
        rationale:
          'PATCH는 리소스의 일부만 수정한다. 구현 방식에 따라 멱등할 수도, 비멱등할 수도 있어 주의가 필요하다.',
      },
      {
        kind: 'boundary',
        stem: 'PUT이 멱등한 이유는?',
        choices: [
          { text: '전체를 교체하므로 여러 번 보내도 결과가 같다', correct: true },
          { text: '상태를 바꾸지 않기 때문이다', leadsTo: 4 },
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
          { text: '즉시 모두 끊긴다', leadsTo: 3 },
          { text: '이미 열린 연결은 이어질 수 있다', correct: true },
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
          { text: '죽은 서버가 계속 목록에 남는다', correct: true },
          { text: '멀쩡한 서버가 전부 빠진다', leadsTo: 1 },
          { text: '확인 주기가 늘어난다', leadsTo: 1 },
          { text: '연결이 두 배로 늘어난다', leadsTo: 3 },
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
          { text: '거리만큼 길어지던 왕복이 통째로 사라진다', correct: true },
          { text: '파일이 더 작게 압축된다', leadsTo: 0 },
          { text: '원본 서버가 더 빨라진다', leadsTo: 4 },
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
          { text: '보관 기간이 끝날 때까지 옛것을 준다', correct: true },
          { text: '자동으로 지워진다', leadsTo: 2 },
          { text: '원본을 다시 확인한다', leadsTo: 0 },
        ],
        rationale:
          '어려운 것은 지우는 일이다. 그래서 파일 이름에 내용 해시를 넣어 다른 파일로 만든다.',
      },
      {
        kind: 'boundary',
        stem: '사본이 있어도 원본까지 가는 때는?',
        choices: [
          { text: '기간이 지났거나 캐시를 건너뛰라고 적혀 있을 때', correct: true },
          { text: '사용자가 멀리 있을 때', leadsTo: 0 },
          { text: '파일이 클 때', leadsTo: 4 },
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
          { text: '함께 바뀌어 클라이언트가 고쳐야 한다', leadsTo: 2 },
          { text: '그대로다. 브라우저는 앱 서버를 모른다', correct: true },
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
          { text: '여기가 죽으면 전부 죽는다', correct: true },
          { text: '뒤쪽 서버가 하나 죽으면 전부 멈춘다', leadsTo: 3 },
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
          { text: '내 쪽 코드가 소켓을 안 닫고 있다', correct: true },
          { text: '커널의 대기 시간 설정', leadsTo: 1 },
          { text: '네트워크 장비의 패킷 유실', leadsTo: 3 },
        ],
        rationale:
          'CLOSE_WAIT가 쌓여 있으면 상대 탓이 아니다. FIN을 받고도 자기 쪽에서 닫지 않고 있다는 뜻이다.',
      },
      {
        kind: 'boundary',
        stem: 'TIME_WAIT는 어느 쪽에 생기는가?',
        choices: [
          { text: '먼저 닫은 쪽', correct: true },
          { text: '나중에 닫은 쪽', leadsTo: 0 },
          { text: '언제나 서버 쪽', leadsTo: 4 },
          { text: '언제나 클라이언트 쪽', leadsTo: 4 },
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
          { text: '두 배씩 늘리다 문턱을 넘으면 하나씩', correct: true },
          { text: '처음부터 최대치로 시작한다', leadsTo: 2 },
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
          { text: '시작이 작을 뿐 왕복마다 두 배로 늘어난다', correct: true },
          { text: '느리지만 안전해서 쓴다', leadsTo: 4 },
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
          { text: '중간에 잘리거나, 아예 못 가고 되돌아온다', correct: true },
          { text: '언제나 자동으로 잘려 전달된다', leadsTo: 3 },
          { text: '속도만 느려지고 전달은 된다', leadsTo: 1 },
          { text: '연결이 끊긴다', leadsTo: 2 },
        ],
        rationale:
          'IPv4는 자르지 말라는 표시가 붙었는지로 갈린다. 표시가 있으면 라우터는 자르지 않고 버린 뒤 감당할 크기를 알려 준다. IPv6는 라우터가 아예 자르지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '중간에서 잘린 조각 하나를 잃으면?',
        choices: [
          { text: '그 조각만 다시 받으면 된다', leadsTo: 1 },
          { text: '전체를 다시 보내야 한다', correct: true },
          { text: '받는 쪽이 알아서 메운다', leadsTo: 1 },
          { text: '아무 영향이 없다', leadsTo: 3 },
        ],
        rationale:
          '중간에서 자르는 방식은 손해가 크다. 받는 쪽은 다 모일 때까지 메모리를 붙들고 있어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '크기를 알려 주는 신호가 막히면 어떤 증상이 나오는가?',
        choices: [
          { text: '악수는 됐는데 큰 데이터만 안 간다', correct: true },
          { text: '연결 자체가 안 맺어진다', leadsTo: 2 },
          { text: '모든 요청이 느려진다', leadsTo: 0 },
          { text: '작은 요청부터 실패한다', leadsTo: 2 },
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
          { text: '상대가 바뀌었을 때 엉뚱한 곳으로 보낸다', correct: true },
          { text: '망이 소리로 가득 찬다', leadsTo: 0 },
          { text: '메모리가 부족해진다', leadsTo: 0 },
          { text: '아무 문제가 없다', leadsTo: 2 },
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
          { text: '출발지를 공인 주소로 바꿔 적고 표에 남긴다', correct: true },
          { text: '목적지를 사설 주소로 바꾼다', leadsTo: 4 },
          { text: '기기마다 공인 주소를 하나씩 받는다', leadsTo: 3 },
          { text: '주소를 바꾸지 않고 그대로 보낸다', leadsTo: 0 },
        ],
        rationale:
          '표가 있어야 돌아온 답을 누구에게 줄지 안다. 포트는 겹칠 때만 바꾼다.',
      },
      {
        kind: 'misconception',
        stem: '바깥에서 먼저 걸어오는 연결이 안 되는 이유는?',
        choices: [
          { text: '보안 정책이 막고 있어서', leadsTo: 0 },
          { text: '먼저 나간 적이 없어 표에 줄이 없어서', correct: true },
          { text: '공인 주소가 없어서', leadsTo: 3 },
          { text: '포트가 모두 쓰여서', leadsTo: 4 },
        ],
        rationale:
          '받으려면 어느 포트를 어디로 보낼지 미리 적어 둬야 한다.',
      },
      {
        kind: 'boundary',
        stem: '오래 열어 두는 연결에 필요한 것은?',
        choices: [
          { text: '주기적으로 뭔가를 보내 줄을 살려 둔다', correct: true },
          { text: '표의 줄은 영구히 남으니 둘 필요 없다', leadsTo: 1 },
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
          { text: '응답에 붙은 지시', correct: true },
          { text: '브라우저 설정값', leadsTo: 3 },
          { text: '파일 확장자', leadsTo: 2 },
          { text: '접속 속도', leadsTo: 1 },
        ],
        rationale:
          '아직 신선하면 요청 없이 그대로 쓰고, 수명이 지났으면 서버에 물어본다.',
      },
      {
        kind: 'misconception',
        stem: '수명이 지난 응답은 어떻게 되는가?',
        choices: [
          { text: '바로 버리고 새로 받는다', leadsTo: 1 },
          { text: '표식을 붙여 물어보고 안 바뀌었으면 그대로 쓴다', correct: true },
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
          { text: '보내는 쪽과 받는 쪽 모두의 CPU와 시간', correct: true },
          { text: '서버 디스크 용량만', leadsTo: 1 },
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
          { text: '켜면 언제나 이득이다', leadsTo: 0 },
          { text: '이미 압축된 형식과 작은 응답은 이득이 작다', correct: true },
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
          { text: '언제나 네 단계다', leadsTo: 0 },
          { text: 'ACK와 FIN이 합쳐지면 세 단계로 끝나기도 한다', correct: true },
          { text: '언제나 세 단계다', leadsTo: 0 },
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
          { text: '최종 답이나 오류만', correct: true },
          { text: '다음에 물어볼 서버의 주소', leadsTo: 2 },
          { text: '중간 단계마다의 응답 전부', leadsTo: 2 },
          { text: '캐시된 레코드 목록', leadsTo: 0 },
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
          { text: '목적지별 소켓 수, 에페머럴 포트 범위, 발생한 오류', correct: true },
          { text: '전체 소켓 수만', leadsTo: 1 },
          { text: 'CPU 사용률만', leadsTo: 3 },
          { text: '커널 버전만', leadsTo: 0 },
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
          { text: '커넥션 풀과 Keep-Alive', correct: true },
          { text: '커널 재사용 옵션', leadsTo: 0 },
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
          { text: '검사 대상과 깊이', correct: true },
          { text: '검사 주기만', leadsTo: 1 },
          { text: '응답 형식만', leadsTo: 0 },
          { text: '복구 기준만', leadsTo: 2 },
        ],
        rationale:
          'ICMP 응답으로 도달만 보는 것부터 TCP 소켓 연결, 설정한 응답 코드와 애플리케이션 내부 상태까지 깊이가 달라진다.',
      },
      {
        kind: 'misconception',
        stem: 'L4 검사가 성공하면 서비스가 정상인가?',
        choices: [
          { text: '정상이다. 연결이 되니까', leadsTo: 3 },
          { text: '프로세스가 멈췄거나 의존성이 끊겨도 성공할 수 있다', correct: true },
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
          { text: '서버 자체에 부담을 준다', correct: true },
          { text: '검사 정확도가 떨어진다', leadsTo: 0 },
          { text: '죽은 서버를 못 걸러낸다', leadsTo: 2 },
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
          { text: '커널이 정상 종료 절차를 밟으면 FIN이 나간다', correct: true },
          { text: '아무것도 안 나간다', leadsTo: 4 },
          { text: '상대가 먼저 RST를 보낸다', leadsTo: 4 },
        ],
        rationale:
          'SO_LINGER를 0으로 두고 닫는 것처럼 끊어 내는 방식으로 닫을 때 RST가 나간다.',
      },
      {
        kind: 'boundary',
        stem: 'RST를 받은 쪽은 어떻게 되는가?',
        choices: [
          { text: '버퍼의 미처리 데이터를 버리고 연결을 해제한다', correct: true },
          { text: '남은 데이터를 모두 처리한 뒤 닫는다', leadsTo: 0 },
          { text: '대기 상태로 남는다', leadsTo: 2 },
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
          { text: 'hashCode로 버킷을 정하고 그 안에서 equals로 견준다', correct: true },
          { text: 'equals로 전체를 훑고 hashCode로 정렬한다', leadsTo: 0 },
          { text: 'equals만으로 찾는다', leadsTo: 0 },
          { text: 'hashCode만으로 찾는다', leadsTo: 3 },
        ],
        rationale:
          'equals만 재정의하면 논리적으로 같은 두 객체가 서로 다른 버킷으로 흩어진다. equals 비교까지 가지도 못하므로 조회가 실패한다.',
      },
      {
        kind: 'misconception',
        stem: '규약은 어느 방향으로 성립하는가?',
        choices: [
          { text: 'equals가 true면 hashCode도 같아야 한다', correct: true },
          { text: 'hashCode가 같으면 equals도 true여야 한다', leadsTo: 0 },
          { text: '양방향으로 모두 성립해야 한다', leadsTo: 0 },
          { text: '둘은 서로 무관하다', leadsTo: 4 },
        ],
        rationale:
          '규약은 단방향이다. hashCode가 같아도 equals는 false일 수 있고 이게 해시 충돌이다.',
      },
      {
        kind: 'boundary',
        stem: '가변 필드를 hashCode에 쓰면?',
        choices: [
          { text: '컬렉션에 넣은 뒤 그 필드를 바꾸면 다시 찾지 못한다', correct: true },
          { text: '성능만 조금 떨어진다', leadsTo: 3 },
          { text: '컬렉션이 알아서 다시 계산한다', leadsTo: 2 },
          { text: '아무 문제가 없다', leadsTo: 2 },
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
          { text: '나중에 등록했어도 먼저 돈다', correct: true },
          { text: '등록 순서대로 나중에 돈다', leadsTo: 0 },
          { text: '둘은 같은 큐라 순서가 보장되지 않는다', leadsTo: 1 },
          { text: '동기 코드보다도 먼저 돈다', leadsTo: 0 },
        ],
        rationale:
          '마이크로태스크 큐는 매크로태스크보다 먼저, 그리고 스택이 빌 때마다 전부 비워진다.',
      },
      {
        kind: 'boundary',
        stem: 'setTimeout(0)의 쓸모가 실제로 드러나는 자리는?',
        choices: [
          { text: '무거운 작업을 잘라 사이사이 화면이 숨 쉬게 할 때', correct: true },
          { text: '가장 빨리 실행하고 싶을 때', leadsTo: 0 },
          { text: '애니메이션 프레임을 맞출 때', leadsTo: 3 },
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
          { text: '세는 동안 참조 관계가 바뀌면 이미 확인한 것이 틀려져서', correct: true },
          { text: '메모리를 물리적으로 지워야 해서', leadsTo: 1 },
          { text: '스레드를 새로 만들어야 해서', leadsTo: 1 },
          { text: '디스크에 기록해야 해서', leadsTo: 4 },
        ],
        rationale:
          '살아 있는 객체를 세는 동안 애플리케이션이 참조를 바꾸면 앞서 확인한 결과가 무너진다. 그 구간만 실행을 세운다.',
      },
      {
        kind: 'misconception',
        stem: '힙을 키우면 멈춤 문제가 해결되는가?',
        choices: [
          { text: '빈도는 줄지만 한 번의 멈춤은 길어진다', correct: true },
          { text: '빈도도 길이도 모두 준다', leadsTo: 2 },
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
          { text: '줄일 뿐 완전히 없애지는 못한다', correct: true },
          { text: '완전히 사라진다', leadsTo: 1 },
          { text: '오히려 늘어난다', leadsTo: 1 },
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
          { text: '여러 스레드가 공유하는가, 스레드마다 따로인가', correct: true },
          { text: '크기가 큰가 작은가', leadsTo: 4 },
          { text: '오래 사는가 짧게 사는가', leadsTo: 0 },
          { text: '기본형인가 참조형인가', leadsTo: 3 },
        ],
        rationale:
          '객체는 여러 스레드가 공유할 수 있어 힙에 두고, 호출 프레임은 스레드마다 독립된 실행 상태라 각 JVM 스택에 둔다.',
      },
      {
        kind: 'misconception',
        stem: '호출 프레임도 GC가 회수하는가?',
        choices: [
          { text: '메서드가 끝나면 사라져 별도 회수가 필요 없다', correct: true },
          { text: '힙 객체와 똑같이 회수된다', leadsTo: 0 },
          { text: '스레드가 끝날 때 한꺼번에 회수된다', leadsTo: 0 },
          { text: '수집기 종류에 따라 다르다', leadsTo: 4 },
        ],
        rationale:
          '프레임에는 지역 변수, 피연산자 스택, 반환 정보가 있다. 메서드가 끝나면 프레임이 사라진다.',
      },
      {
        kind: 'boundary',
        stem: '힙 객체는 참조가 끊기면 어떻게 되는가?',
        choices: [
          { text: '바로 사라지지 않고 도달 불가 판정 뒤에 회수된다', correct: true },
          { text: '즉시 메모리에서 지워진다', leadsTo: 1 },
          { text: '스택으로 옮겨진다', leadsTo: 3 },
          { text: '영원히 남는다', leadsTo: 1 },
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
          { text: '루트에서 안 닿으면 둘 다 회수된다', correct: true },
          { text: '서로 참조하므로 영원히 남는다', leadsTo: 0 },
          { text: '하나만 회수된다', leadsTo: 0 },
          { text: '약한 참조로 바꿔야 회수된다', leadsTo: 1 },
        ],
        rationale:
          '추적식 수집기는 참조 횟수가 아니라 도달 가능성을 본다.',
      },
      {
        kind: 'boundary',
        stem: 'GC 루트에 해당하는 것은?',
        choices: [
          { text: '실행 중인 스레드의 스택 참조와 정적 참조', correct: true },
          { text: '힙에 있는 모든 객체', leadsTo: 0 },
          { text: '가장 최근에 만든 객체', leadsTo: 2 },
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
          { text: '장벽 비용과 충분한 힙 여유가 필요하다', correct: true },
          { text: '아무 대가 없이 정지만 줄인다', leadsTo: 2 },
          { text: '처리량도 함께 올라간다', leadsTo: 0 },
          { text: '힙을 줄여도 된다', leadsTo: 3 },
        ],
        rationale:
          'ZGC는 표시와 재배치 대부분을 동시에 수행하지만 그만큼 자원을 쓴다. Parallel GC는 처리량이 높은 대신 살아 있는 집합이 크면 정지가 길어진다.',
      },
      {
        kind: 'boundary',
        stem: '고르기 전에 반드시 할 일은?',
        choices: [
          { text: '운영과 같은 부하에서 지연·처리량·GC CPU를 재 본다', correct: true },
          { text: '가장 최신 수집기를 고른다', leadsTo: 2 },
          { text: '힙을 최대로 잡는다', leadsTo: 0 },
          { text: '기본값을 그대로 쓴다', leadsTo: 4 },
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
          { text: '관찰에 기댄 가정이 깨지면 폐기하고 되돌린다', correct: true },
          { text: '한 번 만들면 끝까지 쓴다', leadsTo: 2 },
          { text: '주기적으로 다시 컴파일한다', leadsTo: 0 },
          { text: '메서드가 끝나면 버린다', leadsTo: 3 },
        ],
        rationale:
          'JIT는 관찰된 타입을 바탕으로 가상 호출을 인라이닝할 수 있다. 가정이 깨지면 최적화 코드를 폐기하고 디옵티마이즈한다.',
      },
      {
        kind: 'boundary',
        stem: '짧은 벤치마크가 잘못 읽히는 이유는?',
        choices: [
          { text: '워밍업과 컴파일 시간이 측정에 섞인다', correct: true },
          { text: '측정 단위가 너무 커서', leadsTo: 0 },
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
          { text: '바이너리 이름과 정의한 클래스 로더의 조합', correct: true },
          { text: '바이너리 이름만', leadsTo: 0 },
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
          { text: '같은 클래스다', correct: true },
          { text: '서로 다른 클래스다', leadsTo: 4 },
          { text: '인자 개수에 따라 다르다', leadsTo: 1 },
          { text: '실행할 때마다 달라진다', leadsTo: 3 },
        ],
        rationale:
          '컴파일러가 타입 안전성을 검사한 뒤 타입 인자를 소거한다. 형변환은 필요한 곳에 삽입된다.',
      },
      {
        kind: 'misconception',
        stem: '리플렉션으로 객체의 타입 인자를 알 수 있는가?',
        choices: [
          { text: '선언 정보는 읽지만 객체의 실제 인자는 복원하지 못한다', correct: true },
          { text: '언제나 읽을 수 있다', leadsTo: 3 },
          { text: '아무 제네릭 정보도 남지 않는다', leadsTo: 3 },
          { text: '배열로 만들면 읽을 수 있다', leadsTo: 1 },
        ],
        rationale:
          '필드와 메서드 선언의 제네릭 시그니처는 클래스 파일에 남을 수 있다. 그러나 그것은 선언이지 객체의 상태가 아니다.',
      },
      {
        kind: 'boundary',
        stem: '소거 때문에 막히는 것은?',
        choices: [
          { text: '구체 타입 인자를 붙인 타입의 instanceof 검사', correct: true },
          { text: '제네릭 메서드 선언', leadsTo: 0 },
          { text: '와일드카드 사용', leadsTo: 2 },
          { text: '상속받은 제네릭 타입', leadsTo: 0 },
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
          { text: '잠금 없이 여러 스레드가 공유하기 쉬워진다', correct: true },
          { text: '메모리를 덜 쓴다', leadsTo: 3 },
          { text: '실행 속도가 항상 빨라진다', leadsTo: 3 },
          { text: '가비지 컬렉션이 필요 없어진다', leadsTo: 3 },
        ],
        rationale:
          '해시 키도 안정된다. 대신 변경마다 새 객체가 필요하다.',
      },
      {
        kind: 'misconception',
        stem: '필드를 private final로 두면 불변인가?',
        choices: [
          { text: '부족하다. 가변 인자와 내부 컬렉션을 복사해야 한다', correct: true },
          { text: '그것으로 충분하다', leadsTo: 0 },
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
          { text: '생성 중 this가 외부로 노출될 때', correct: true },
          { text: '필드가 여러 개일 때', leadsTo: 1 },
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
          { text: '더 적게 써도 동등하면 같기만 하면 된다', correct: true },
          { text: '반드시 같은 필드를 모두 써야 한다', leadsTo: 3 },
          { text: '항상 한 필드만 써야 한다', leadsTo: 0 },
          { text: '필드와 무관하게 상수를 써도 좋다', leadsTo: 0 },
        ],
        rationale:
          '규약이 요구하는 것은 동등한 객체의 해시값이 같다는 조건 하나다. 다만 상수를 쓰면 모든 키가 한 버킷에 몰린다.',
      },
      {
        kind: 'boundary',
        stem: '상속 계층에서 값 동등성을 더하면 흔히 깨지는 것은?',
        choices: [
          { text: '대칭성', correct: true },
          { text: '반사성', leadsTo: 0 },
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
          { text: '호출 계층마다 의미 없는 catch와 throws가 퍼진다', correct: true },
          { text: '넓게 쓸수록 안전하다', leadsTo: 3 },
          { text: '성능만 조금 나빠진다', leadsTo: 2 },
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
          { text: '여러 중간 연산을 한 번의 순회로 결합한다', correct: true },
          { text: '메모리를 항상 덜 쓴다', leadsTo: 0 },
          { text: '자동으로 병렬 처리된다', leadsTo: 2 },
          { text: '순서가 보장된다', leadsTo: 3 },
        ],
        rationale:
          '종료 연산이 요구할 때까지 미루면 단계를 합칠 수 있고, 단락 종료로 필요한 원소만 처리할 수도 있다.',
      },
      {
        kind: 'misconception',
        stem: '지연 실행이면 버퍼를 안 쓰는가?',
        choices: [
          { text: '상태 있는 연산은 지연이어도 버퍼를 쓸 수 있다', correct: true },
          { text: '지연이면 절대 버퍼를 쓰지 않는다', leadsTo: 0 },
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
          { text: '전체 입력을 요구하는 연산 없이 단락 종료가 걸려야 한다', correct: true },
          { text: '병렬로 돌리면 된다', leadsTo: 2 },
          { text: '무한 스트림은 언제나 끝나지 않는다', leadsTo: 1 },
          { text: '중간 연산 개수를 줄이면 된다', leadsTo: 0 },
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
          { text: '검증된 원자 연산과 대기 정책을 재사용해 위험을 줄인다', correct: true },
          { text: '언제나 더 빠르기 때문', leadsTo: 3 },
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
          { text: '두 번의 연산이라 그 사이에 경쟁이 생긴다', correct: true },
          { text: '동시 컬렉션이니 안전하다', leadsTo: 0 },
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
          { text: '여러 필드에 걸친 불변식을 함께 지켜야 할 때', correct: true },
          { text: '값이 정수가 아닐 때', leadsTo: 1 },
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
          { text: '해당 접근을 경계로 한 가시성과 재정렬 제약', correct: true },
          { text: '복합 연산의 원자성', leadsTo: 3 },
          { text: '교착 상태 예방', leadsTo: 1 },
          { text: '스레드 수 제한', leadsTo: 1 },
        ],
        rationale:
          'volatile 쓰기는 뒤따르는 같은 변수의 읽기보다 먼저 일어난다. 다만 복합 연산을 원자화하지는 않는다.',
      },
      {
        kind: 'misconception',
        stem: 'volatile 변수에 count++는 안전한가?',
        choices: [
          { text: '읽기·계산·쓰기 세 단계라 갱신을 잃을 수 있다', correct: true },
          { text: 'volatile이므로 안전하다', leadsTo: 3 },
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
          { text: '그 값을 읽은 스레드에 함께 보인다', correct: true },
          { text: '보이지 않는다', leadsTo: 0 },
          { text: 'volatile 필드만 보인다', leadsTo: 0 },
          { text: '순서가 뒤바뀐다', leadsTo: 1 },
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
          { text: '한 시점에 스레드 하나만 바이트코드를 실행한다', correct: true },
          { text: '스레드 생성 비용이 커서', leadsTo: 2 },
          { text: '코어가 부족해서', leadsTo: 2 },
          { text: '메모리가 부족해서', leadsTo: 2 },
        ],
        rationale:
          'CPU 연산 스레드를 늘리면 GIL 경합과 전환 비용만 커질 수 있다. 늘린 만큼 기다리는 줄만 길어진다.',
      },
      {
        kind: 'misconception',
        stem: 'GIL이 있으면 데이터 경쟁도 막아 주는가?',
        choices: [
          { text: '복합 연산의 논리적 경쟁은 막지 못한다', correct: true },
          { text: '모든 경쟁을 막아 준다', leadsTo: 3 },
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
          { text: '대기가 긴 I/O와 GIL을 놓는 네이티브 확장', correct: true },
          { text: '순수 CPU 연산', leadsTo: 2 },
          { text: '모든 종류의 작업', leadsTo: 0 },
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
          { text: '서로를 가리키는 순환', correct: true },
          { text: '큰 객체', leadsTo: 1 },
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
          { text: '내부 함수가 그 렉시컬 환경을 계속 참조해서', correct: true },
          { text: '전역으로 옮겨져서', leadsTo: 2 },
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
          { text: '바인딩이라 나중 변경도 함께 본다', correct: true },
          { text: '만든 시점의 복사본이다', leadsTo: 0 },
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
          { text: '프로토타입을 따라 null에 닿을 때까지', correct: true },
          { text: '전역 객체', leadsTo: 3 },
          { text: '같은 파일의 다른 객체', leadsTo: 1 },
          { text: '더 찾지 않고 바로 오류를 낸다', leadsTo: 0 },
        ],
        rationale:
          '체인의 끝인 null에 닿으면 undefined가 된다.',
      },
      {
        kind: 'misconception',
        stem: '속성 대입은 언제나 자체 속성을 만드는가?',
        choices: [
          { text: '상속된 setter나 쓰기 금지 속성이 있으면 결과가 달라진다', correct: true },
          { text: '언제나 자체 속성을 만든다', leadsTo: 4 },
          { text: '언제나 프로토타입을 고친다', leadsTo: 1 },
          { text: '읽기와 같은 경로를 탄다', leadsTo: 0 },
        ],
        rationale:
          '하위 객체에 같은 키가 있으면 상속 속성을 가린다. 다만 대입 경로는 읽기와 규칙이 다르다.',
      },
      {
        kind: 'boundary',
        stem: 'class의 static 메서드는 어디에 놓이는가?',
        choices: [
          { text: '클래스 생성자 자체', correct: true },
          { text: 'prototype', leadsTo: 2 },
          { text: '인스턴스마다 하나씩', leadsTo: 2 },
          { text: '전역 객체', leadsTo: 3 },
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
          { text: '옮기지 않는다. 선언 등록과 초기화 시점을 설명하는 모델이다', correct: true },
          { text: '실제로 소스가 위로 이동한다', leadsTo: 1 },
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
          { text: 'ReferenceError가 난다', correct: true },
          { text: 'undefined가 나온다', leadsTo: 3 },
          { text: '"let"이 나온다', leadsTo: 3 },
          { text: '선언한 타입이 나온다', leadsTo: 1 },
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
          { text: '호출 형태', correct: true },
          { text: '함수를 정의한 위치', leadsTo: 4 },
          { text: '파일의 모듈 종류', leadsTo: 3 },
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
          { text: 'call로 this를 바꾸거나 new로 생성하는 것', correct: true },
          { text: '콜백으로 넘기는 것', leadsTo: 2 },
          { text: '값을 반환하는 것', leadsTo: 1 },
          { text: '인자를 받는 것', leadsTo: 1 },
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
          { text: '대상이 요구하는 멤버를 갖췄는가', correct: true },
          { text: '같은 이름으로 선언됐는가', leadsTo: 2 },
          { text: '같은 파일에 있는가', leadsTo: 2 },
          { text: '같은 인터페이스를 구현한다고 적었는가', leadsTo: 2 },
        ],
        rationale:
          '이름이나 선언 계보가 달라도 구조가 맞으면 대입할 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '속성이 더 많으면 대입이 막히는가?',
        choices: [
          { text: '대체로 허용된다. 새 객체 리터럴을 바로 넣을 때만 검사한다', correct: true },
          { text: '언제나 막힌다', leadsTo: 0 },
          { text: '언제나 허용된다', leadsTo: 0 },
          { text: '선택 속성일 때만 허용된다', leadsTo: 1 },
        ],
        rationale:
          '초과 속성 검사는 오타 가능성을 잡으려고 리터럴을 바로 대입하는 자리에만 걸린다.',
      },
      {
        kind: 'boundary',
        stem: '구조가 우연히 같은 식별자 타입을 가르려면?',
        choices: [
          { text: '브랜드 필드를 더해 명목적 구분을 흉내 낸다', correct: true },
          { text: '이름만 다르게 짓는다', leadsTo: 0 },
          { text: 'readonly를 붙인다', leadsTo: 3 },
          { text: '가를 방법이 없다', leadsTo: 2 },
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
          { text: '검사와 사용 사이에 값이 바뀔 수 있을 때', correct: true },
          { text: '값이 원시 타입일 때', leadsTo: 1 },
          { text: '함수가 길 때', leadsTo: 2 },
          { text: '검사를 두 번 했을 때', leadsTo: 4 },
        ],
        rationale:
          '지역 val로 고정하거나 안전 호출로 접근해야 한다. getter 결과가 달라질 수 있는 프로퍼티가 대표적이다.',
      },
      {
        kind: 'misconception',
        stem: 'Java에서 온 값의 널 가능성은?',
        choices: [
          { text: '플랫폼 타입이라 타입에 확정되지 않는다', correct: true },
          { text: '항상 널이 아닌 것으로 확정된다', leadsTo: 0 },
          { text: '항상 널 가능으로 확정된다', leadsTo: 0 },
          { text: '컴파일러가 자동으로 검사를 넣는다', leadsTo: 1 },
        ],
        rationale:
          '경계에서 어노테이션과 검증으로 불확실성을 좁혀야 내부의 널 안전성이 유지된다.',
      },
      {
        kind: 'boundary',
        stem: '안전 호출을 길게 잇는 방식의 문제는?',
        choices: [
          { text: '실패 원인을 숨긴다', correct: true },
          { text: '성능이 크게 나빠진다', leadsTo: 1 },
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
          { text: '다르다. 값도 힙에 놓일 수 있다', correct: true },
          { text: '같다. 값은 스택, 참조는 힙이다', leadsTo: 0 },
          { text: '언어마다 항상 스택에만 둔다', leadsTo: 4 },
          { text: '컴파일러가 정하므로 구분이 없다', leadsTo: 0 },
        ],
        rationale:
          '값도 최적화나 캡처에 따라 힙에 놓일 수 있고, 참조 값 자체는 스택 프레임에 놓일 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '인자를 항상 값으로 전달하는 언어에서 호출자가 보는 것은?',
        choices: [
          { text: '같은 객체의 변경은 보지만 재대입은 안 보인다', correct: true },
          { text: '변경도 재대입도 모두 보인다', leadsTo: 0 },
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
          { text: '소수점 위치를 고정하는가, 값에 따라 옮기는가', correct: true },
          { text: '정수인가 실수인가', leadsTo: 1 },
          { text: '비트 수가 몇인가', leadsTo: 1 },
          { text: '하드웨어가 지원하는가', leadsTo: 3 },
        ],
        rationale:
          '고정 소수점은 정수부와 소수부의 비트 수를 미리 정해둔다. 부동 소수점은 가수부와 지수부를 나눈다.',
      },
      {
        kind: 'misconception',
        stem: '2진 부동 소수점으로 정확히 표현되는 값은?',
        choices: [
          { text: '0.5는 정확하지만 0.1은 아니다', correct: true },
          { text: '10진 소수는 모두 정확하다', leadsTo: 0 },
          { text: '10진 소수는 모두 부정확하다', leadsTo: 0 },
          { text: '비트를 늘리면 모두 정확해진다', leadsTo: 1 },
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
          { text: '각 스레드가 값을 캐시에 복사해 쓰기 때문', correct: true },
          { text: '스레드가 너무 많아서', leadsTo: 4 },
          { text: '메모리가 부족해서', leadsTo: 4 },
          { text: '컴파일러가 변수를 지워서', leadsTo: 0 },
        ],
        rationale:
          '여러 스레드가 같은 변수를 수정할 때 각자 캐시만 보면 다른 값을 가지게 된다.',
      },
      {
        kind: 'misconception',
        stem: 'volatile은 캐시를 건너뛰게 만드는가?',
        choices: [
          { text: '아니다. 메모리 장벽으로 가시성과 순서를 강제한다', correct: true },
          { text: '그렇다. 캐시를 완전히 우회한다', leadsTo: 4 },
          { text: '캐시를 매번 비운다', leadsTo: 4 },
          { text: '캐시를 읽기 전용으로 만든다', leadsTo: 0 },
        ],
        rationale:
          '메모리 모델이 정한 가시성과 순서를 지키도록 강제하고, 캐시를 실제로 어떻게 다룰지는 JVM과 CPU가 정한다.',
      },
      {
        kind: 'boundary',
        stem: 'volatile로 해결되지 않는 것은?',
        choices: [
          { text: '읽기·수정·쓰기로 나뉘는 연산의 원자성', correct: true },
          { text: '값의 가시성', leadsTo: 0 },
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
          { text: '정의된 함수만 통해 접근하게 해 무결성을 지킨다', correct: true },
          { text: '메모리를 아낀다', leadsTo: 1 },
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
          { text: '누수가 아니라 붙잡고 있는 것이다. 닿을 길이 끊기면 걷힌다', correct: true },
          { text: '누수라서 영원히 남는다', leadsTo: 1 },
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
          { text: '이름 충돌', correct: true },
          { text: '함수 호출 횟수', leadsTo: 3 },
          { text: '코드 길이', leadsTo: 2 },
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
          { text: '객체의 형태와 멤버 타입', correct: true },
          { text: '선언된 이름', leadsTo: 0 },
          { text: '선언 순서', leadsTo: 1 },
          { text: '파일 경로', leadsTo: 4 },
        ],
        rationale:
          '이름이 달라도 가지고 있는 멤버의 타입과 형태가 같다면 동일한 타입으로 간주한다.',
      },
      {
        kind: 'misconception',
        stem: '인터페이스를 명시적으로 상속해야 통과하는가?',
        choices: [
          { text: '요구 속성만 갖추면 상속 없이도 통과한다', correct: true },
          { text: '반드시 상속해야 한다', leadsTo: 1 },
          { text: '같은 파일에 있어야 한다', leadsTo: 4 },
          { text: '이름이 같아야 한다', leadsTo: 0 },
        ],
        rationale:
          '덕분에 외부 라이브러리와의 타입 호환성을 확보하기 쉽다.',
      },
      {
        kind: 'boundary',
        stem: '구조적 타이핑이 만드는 위험은?',
        choices: [
          { text: '뜻이 다른 타입이 우연히 일치해 섞인다', correct: true },
          { text: '컴파일이 느려진다', leadsTo: 3 },
          { text: '런타임 성능이 나빠진다', leadsTo: 3 },
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
          { text: '그 스레드만 접근하므로 필요 없다', correct: true },
          { text: '공유 영역과 똑같이 필요하다', leadsTo: 1 },
          { text: '읽을 때만 필요하다', leadsTo: 1 },
          { text: '스레드가 넷을 넘으면 필요하다', leadsTo: 3 },
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
          { text: '참조 횟수 세기', correct: true },
          { text: '세대별 수집', leadsTo: 1 },
          { text: '표시하고 쓸기', leadsTo: 0 },
          { text: '수동 해제', leadsTo: 2 },
        ],
        rationale:
          '참조 횟수가 0이 되면 즉시 메모리에서 제거한다. 세대별 수집기는 순환을 걷어 내는 보조 수단이다.',
      },
      {
        kind: 'misconception',
        stem: '참조 횟수만으로 충분한가?',
        choices: [
          { text: '순환 참조는 횟수가 0이 되지 않아 남는다', correct: true },
          { text: '충분하다. 모든 객체를 해제한다', leadsTo: 0 },
          { text: '큰 객체만 놓친다', leadsTo: 0 },
          { text: '스레드가 많을 때만 놓친다', leadsTo: 3 },
        ],
        rationale:
          '두 객체가 서로를 가리키면 외부에서 닿지 않아도 횟수가 남는다. 그래서 세대별 수집기가 주기적으로 찾아낸다.',
      },
      {
        kind: 'boundary',
        stem: '세대를 몇 개로 두는지는?',
        choices: [
          { text: '판마다 바뀌어 왔다', correct: true },
          { text: '언제나 셋으로 고정이다', leadsTo: 1 },
          { text: '객체 수에 따라 자동으로 늘어난다', leadsTo: 1 },
          { text: '사용자가 반드시 정해야 한다', leadsTo: 1 },
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
          { text: 'undefined가 나와 조용히 지나간다', correct: true },
          { text: '오류가 나서 바로 잡힌다', leadsTo: 0 },
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
          { text: '선언 전 접근이 런타임 오류로 드러난다', correct: true },
          { text: '호이스팅 자체가 사라진다', leadsTo: 4 },
          { text: 'undefined 대신 null이 나온다', leadsTo: 0 },
          { text: '함수 스코프로 바뀐다', leadsTo: 2 },
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
          { text: '객체의 필드나 배열 원소면 힙에 놓인다', correct: true },
          { text: '언제나 스택이다', leadsTo: 0 },
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
          { text: '메모리 효율은 높지만 상태 변경 추적이 어렵다', correct: true },
          { text: '효율도 추적도 모두 낫다', leadsTo: 1 },
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
          { text: '상태 변경을 줄여 예측 가능성을 높이는 것', correct: true },
          { text: '실행 속도를 높이는 것', leadsTo: 1 },
          { text: '코드 줄 수를 줄이는 것', leadsTo: 3 },
          { text: '메모리를 아끼는 것', leadsTo: 1 },
        ],
        rationale:
          '순수 함수는 외부 상태를 바꾸지 않고 오직 입력값으로만 결과를 만든다.',
      },
      {
        kind: 'misconception',
        stem: '순수 함수가 시험하기 쉬운 까닭은?',
        choices: [
          { text: '입력과 출력만 비교하면 되기 때문', correct: true },
          { text: '코드가 짧기 때문', leadsTo: 0 },
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
          { text: '처리량 중심인가 응답 속도 중심인가', correct: true },
          { text: '힙 크기가 큰가 작은가', leadsTo: 4 },
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
          { text: '목표이지 어떤 환경에서든 지켜지는 약속은 아니다', correct: true },
          { text: '모든 환경에서 보장되는 상한이다', leadsTo: 2 },
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
          { text: '풀에 한 벌만 두고 함께 쓰기 때문', correct: true },
          { text: '내용이 같으면 자동으로 합쳐지기 때문', leadsTo: 0 },
          { text: '문자열이 값 타입이기 때문', leadsTo: 0 },
          { text: '컴파일러가 매번 새로 만들기 때문', leadsTo: 4 },
        ],
        rationale:
          '리터럴은 문자열 풀에 한 벌만 있고 변수는 그 자리를 가리킨다.',
      },
      {
        kind: 'misconception',
        stem: 'new로 만든 문자열은 풀에 있으면 재사용되는가?',
        choices: [
          { text: '풀에 있든 없든 힙에 새로 하나를 만든다', correct: true },
          { text: '풀에 있으면 그것을 쓴다', leadsTo: 1 },
          { text: '내용이 같으면 합쳐진다', leadsTo: 0 },
          { text: '오류가 난다', leadsTo: 2 },
        ],
        rationale:
          '그래서 참조로 견주면 거짓이고 내용으로 견줘야 참이다.',
      },
      {
        kind: 'boundary',
        stem: '참조 비교가 문자열에서 헷갈리는 근본 이유는?',
        choices: [
          { text: '내용이 아니라 참조를 견주기 때문', correct: true },
          { text: '문자열만 특별한 규칙을 쓰기 때문', leadsTo: 2 },
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
          { text: '합성만으로 도는 애니메이션', correct: true },
          { text: '클릭 처리', leadsTo: 3 },
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
          { text: '유니코드는 번호표, UTF-8은 그 번호를 바이트로 적는 방법', correct: true },
          { text: '같은 말이다', leadsTo: 0 },
          { text: 'UTF-8이 유니코드를 대체했다', leadsTo: 0 },
          { text: '유니코드가 바이트 표현까지 정한다', leadsTo: 4 },
        ],
        rationale:
          '둘은 다른 층이다. 같은 번호를 적는 방법이 여럿이라 규칙이 어긋날 여지가 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '어긋남을 먼저 의심할 자리는?',
        choices: [
          { text: 'DB 연결·응답 헤더·파일 읽기 같은 경계', correct: true },
          { text: '화면에 그리는 코드', leadsTo: 3 },
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
          { text: '이진에서 끝나지 않는 소수라 가장 가까운 값으로 반올림된다', correct: true },
          { text: '자릿수가 모자라서', leadsTo: 3 },
          { text: '언어가 소수를 잘 못 다뤄서', leadsTo: 3 },
          { text: '메모리가 손상돼서', leadsTo: 0 },
        ],
        rationale:
          '십진에서 1을 3으로 나눈 값을 끝없이 적는 것과 같은 일이다. 밑이 2인 자리로는 10분의 1을 유한하게 적을 수 없다.',
      },
      {
        kind: 'misconception',
        stem: '정밀도를 올리면 해결되는가?',
        choices: [
          { text: '오차가 작아질 뿐 성질은 그대로다', correct: true },
          { text: '완전히 해결된다', leadsTo: 3 },
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
          { text: '십진 소수 타입을 쓰거나 최소 단위 정수로 계산한다', correct: true },
          { text: '배정밀도로 충분하다', leadsTo: 3 },
          { text: '반올림을 마지막에만 하면 된다', leadsTo: 4 },
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
          { text: '안 맞으면 되돌아가 다시 맞춰 보느라 경우의 수가 폭발한다', correct: true },
          { text: '식이 길어서 파싱이 오래 걸린다', leadsTo: 0 },
          { text: '메모리를 많이 써서', leadsTo: 1 },
          { text: '엔진이 매번 다시 컴파일해서', leadsTo: 1 },
        ],
        rationale:
          '글자가 하나 늘 때마다 시도 수가 배로 늘어 금세 멈춘 것처럼 보인다.',
      },
      {
        kind: 'misconception',
        stem: '위험한 식만 있으면 바로 터지는가?',
        choices: [
          { text: '뒤쪽에서 실패가 겹쳐야 되돌아가기가 폭발한다', correct: true },
          { text: '식만 있으면 언제나 터진다', leadsTo: 0 },
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
          { text: '우리가 쓴 식에 남의 문자열이 들어가는 자리', correct: true },
          { text: '식을 상수로 박아 둔 자리', leadsTo: 0 },
          { text: '식이 짧은 자리', leadsTo: 0 },
          { text: '검증을 두 번 하는 자리', leadsTo: 2 },
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
          { text: '수명, 크기, 바꿀 일이 있는지', correct: true },
          { text: '언어, 버전, 플랫폼', leadsTo: 2 },
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
          { text: '객체의 필드나 배열 원소면 힙에 놓인다', correct: true },
          { text: '언제나 스택이다', leadsTo: 4 },
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
          { text: '힙에 쌓이고 GC가 그만큼 일한다', correct: true },
          { text: '전달할 때마다 전체가 복사된다', leadsTo: 0 },
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
          { text: '힙에 있는 객체를 가리키는 참조', correct: true },
          { text: '실제 데이터 값', leadsTo: 2 },
          { text: '값의 복사본', leadsTo: 2 },
          { text: '캐시된 정수', leadsTo: 0 },
        ],
        rationale:
          '원시 타입은 변수 공간에 실제 값을 직접 저장한다. 래퍼는 객체 헤더까지 함께 힙에 놓인다.',
      },
      {
        kind: 'misconception',
        stem: '래퍼 객체의 크기는 값 크기와 같은가?',
        choices: [
          { text: '객체 머리와 정렬, 참조 압축 설정에 따라 더 크다', correct: true },
          { text: '값과 똑같다', leadsTo: 2 },
          { text: '언제나 정확히 두 배다', leadsTo: 2 },
          { text: '값보다 작다', leadsTo: 0 },
        ],
        rationale:
          '값 자체는 4바이트지만 객체로 감싸면 구현과 옵션에 따라 그보다 훨씬 커진다.',
      },
      {
        kind: 'boundary',
        stem: '반복문에서 오토박싱이 위험해지는 이유는?',
        choices: [
          { text: '짧은 시간에 많은 객체가 생겨 GC 부담이 는다', correct: true },
          { text: '값이 잘못 변환된다', leadsTo: 0 },
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
          { text: '순환 대기', correct: true },
          { text: '상호 배제', leadsTo: 4 },
          { text: '비선점', leadsTo: 4 },
          { text: '점유하며 대기', leadsTo: 3 },
        ],
        rationale:
          '여러 자원을 잡는 모든 경로가 같은 전역 순서를 따르면 기다림 고리를 만들지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '오래 기다리면 데드락인가?',
        choices: [
          { text: '아니다. 긴 작업·자원 고갈·경합과 따로 구분해야 한다', correct: true },
          { text: '그렇다. 기다림이 길면 데드락이다', leadsTo: 1 },
          { text: '스레드가 둘 이상이면 데드락이다', leadsTo: 2 },
          { text: '타임아웃이 나면 데드락이다', leadsTo: 4 },
        ],
        rationale:
          'wait-for graph의 고리, 스레드 덤프나 데이터베이스 잠금 정보를 확인해야 한다.',
      },
      {
        kind: 'boundary',
        stem: '재시도에 무작위 지연이 없으면 생기는 것은?',
        choices: [
          { text: '두 작업이 계속 양보하는 livelock', correct: true },
          { text: '데드락이 확정된다', leadsTo: 0 },
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
          { text: '물리 메모리의 배치와 수명을 직접 관리하는 일', correct: true },
          { text: '메모리를 해제하는 일', leadsTo: 1 },
          { text: '디스크에 저장하는 일', leadsTo: 4 },
          { text: '스레드를 만드는 일', leadsTo: 0 },
        ],
        rationale:
          '커널은 주소 범위마다 권한과 어떤 데이터를 연결할지 정한다. 서로 다른 프로세스의 같은 가상 주소가 다른 물리 페이지를 가리킬 수 있어 격리도 쉬워진다.',
      },
      {
        kind: 'misconception',
        stem: 'page fault는 모두 디스크 읽기인가?',
        choices: [
          { text: '아니다. 처음 쓰는 익명 페이지와 copy-on-write도 fault다', correct: true },
          { text: '그렇다. 언제나 디스크를 읽는다', leadsTo: 1 },
          { text: '스왑이 켜져 있을 때만 fault가 난다', leadsTo: 2 },
          { text: 'fault는 오류라서 프로그램이 죽는다', leadsTo: 1 },
        ],
        rationale:
          '매핑이 없거나 권한 처리가 필요할 때 커널로 넘어가는 것이고, 해결 방법은 여러 가지다.',
      },
      {
        kind: 'boundary',
        stem: '큰 가상 주소 범위를 잡으면?',
        choices: [
          { text: '그만큼 물리 메모리가 확보된 것은 아니다', correct: true },
          { text: '그만큼 물리 메모리가 즉시 잡힌다', leadsTo: 2 },
          { text: '스왑이 그만큼 늘어난다', leadsTo: 2 },
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
          { text: '사용자 프로그램이 하드웨어를 직접 건드리지 못하게 하려고', correct: true },
          { text: '실행 속도를 높이려고', leadsTo: 3 },
          { text: '메모리를 아끼려고', leadsTo: 3 },
          { text: '스레드를 나누려고', leadsTo: 1 },
        ],
        rationale:
          '권한을 분리해 하드웨어 제어권을 독점한다. 커널 모드만 모든 하드웨어 권한을 가진다.',
      },
      {
        kind: 'misconception',
        stem: '허락받지 않은 메모리를 건드리면 어떻게 되는가?',
        choices: [
          { text: 'CPU가 예외를 일으켜 커널에 붙잡힌다', correct: true },
          { text: '커널 권한을 얻는다', leadsTo: 0 },
          { text: '조용히 무시된다', leadsTo: 1 },
          { text: '자동으로 시스템 콜로 바뀐다', leadsTo: 0 },
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
          { text: '데이터의 성격과 생명주기가 다르기 때문', correct: true },
          { text: '크기가 다르기 때문', leadsTo: 0 },
          { text: '접근 속도가 다르기 때문', leadsTo: 0 },
          { text: '언어마다 다르기 때문', leadsTo: 2 },
        ],
        rationale:
          '메모리 사용 목적에 따라 영역을 구분하고 각각 다르게 관리한다.',
      },
      {
        kind: 'misconception',
        stem: '스택과 힙의 시작 위치는 어디인가?',
        choices: [
          { text: '운영체제와 규약에 따라 다르다', correct: true },
          { text: '언제나 스택이 위, 힙이 아래다', leadsTo: 1 },
          { text: '언제나 힙이 위, 스택이 아래다', leadsTo: 1 },
          { text: '주소가 고정돼 있다', leadsTo: 2 },
        ],
        rationale:
          '흔한 배치에서 둘이 마주 보고 자라 가용 공간을 유동적으로 나눠 쓴다는 것이 요점이다.',
      },
      {
        kind: 'boundary',
        stem: '한 프로세스의 오류가 다른 프로세스를 오염시키지 않는 근거는?',
        choices: [
          { text: '가상 메모리로 독립된 주소 공간을 가지기 때문', correct: true },
          { text: '영역을 넷으로 나눴기 때문', leadsTo: 4 },
          { text: '스택이 아래로 자라기 때문', leadsTo: 1 },
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
          { text: '요청마다 스레드를 만들고 없애는 비용', correct: true },
          { text: '작업 큐를 유지하는 비용', leadsTo: 0 },
          { text: '컨텍스트 스위칭 비용', leadsTo: 1 },
          { text: '메모리 할당 비용 전부', leadsTo: 1 },
        ],
        rationale:
          '처리가 끝나면 스레드는 소멸하지 않고 다시 풀로 돌아가 다음 작업을 기다린다.',
      },
      {
        kind: 'misconception',
        stem: '풀을 크게 잡으면 처리량이 계속 오르는가?',
        choices: [
          { text: '컨텍스트 스위칭 비용이 커져 오히려 떨어진다', correct: true },
          { text: '크게 잡을수록 항상 좋다', leadsTo: 1 },
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
          { text: '실행 파일의 내용을 그대로 지키기 위해', correct: true },
          { text: '더 빨리 읽기 위해', leadsTo: 1 },
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
          { text: '사라지는 것은 스택이 아니라 그 위의 프레임이다', correct: true },
          { text: '스택 전체가 사라진다', leadsTo: 0 },
          { text: '스택이 절반으로 준다', leadsTo: 0 },
          { text: '힙으로 옮겨진다', leadsTo: 1 },
        ],
        rationale:
          '스택은 스레드마다 하나씩 있다. 함수를 부를 때마다 그 위에 프레임이 쌓이고 돌아올 때 걷힌다.',
      },
      {
        kind: 'boundary',
        stem: '스택은 무엇마다 하나씩 있는가?',
        choices: [
          { text: '스레드', correct: true },
          { text: '프로세스', leadsTo: 2 },
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
          { text: '지금 내주고도 모두가 끝날 수 있는 순서가 남는가', correct: true },
          { text: '요청한 자원이 지금 비어 있는가', leadsTo: 3 },
          { text: '요청한 프로세스의 우선순위가 높은가', leadsTo: 2 },
          { text: '이미 고리가 생겼는가', leadsTo: 2 },
        ],
        rationale:
          '남을 때만 준다. 남지 않으면 줄 수 있는 자원이어도 기다리게 한다.',
      },
      {
        kind: 'misconception',
        stem: '회피와 예방은 같은 것인가?',
        choices: [
          { text: '예방은 조건을 막고, 회피는 조건을 둔 채 그때그때 판단한다', correct: true },
          { text: '같은 말이다', leadsTo: 1 },
          { text: '회피가 조건을 없앤다', leadsTo: 1 },
          { text: '둘 다 탐지 뒤에 하는 일이다', leadsTo: 2 },
        ],
        rationale:
          '회피는 네 조건을 그대로 둔 채 요청마다 따진다.',
      },
      {
        kind: 'boundary',
        stem: '은행원 알고리즘의 쓰임이 좁은 까닭은?',
        choices: [
          { text: '프로세스마다 최대 사용량을 미리 알아야 해서', correct: true },
          { text: '계산이 너무 느려서', leadsTo: 3 },
          { text: '자원이 하나뿐일 때만 되어서', leadsTo: 0 },
          { text: '탐지를 함께 해야 해서', leadsTo: 2 },
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
          { text: '필요한 페이지만', correct: true },
          { text: '프로세스 전체', leadsTo: 1 },
          { text: '실행 파일 전체', leadsTo: 0 },
          { text: '스왑에 있는 것 전부', leadsTo: 4 },
        ],
        rationale:
          '나머지는 스왑에 있을 수도, 실행 파일이나 매핑한 파일에 그대로 있을 수도, 아직 아무 데도 없을 수도 있다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 넉넉하면 페이지 폴트가 안 나는가?',
        choices: [
          { text: '아직 안 올렸으면 넉넉해도 난다', correct: true },
          { text: '넉넉하면 나지 않는다', leadsTo: 0 },
          { text: '스왑이 꽉 찼을 때만 난다', leadsTo: 4 },
          { text: '폴트는 오류라서 프로그램이 죽는다', leadsTo: 0 },
        ],
        rationale:
          '건드린 가상 페이지가 지금 물리 메모리에 없으면 난다. 그때 운영체제가 가져온다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스 간 격리가 성립하는 근거는?',
        choices: [
          { text: '각자 독립된 주소 공간을 가지기 때문', correct: true },
          { text: '페이지 크기가 같기 때문', leadsTo: 1 },
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
          { text: 'CPU의 모드 비트', correct: true },
          { text: '프로세스 우선순위', leadsTo: 3 },
          { text: '메모리 영역 크기', leadsTo: 1 },
          { text: '실행 파일 형식', leadsTo: 0 },
        ],
        rationale:
          '사용자 모드는 제한된 권한, 커널 모드는 하드웨어 제어와 메모리 보호까지 맡는다.',
      },
      {
        kind: 'misconception',
        stem: '시스템 콜은 하드웨어 인터럽트인가?',
        choices: [
          { text: '아니다. 프로그램이 스스로 일으키는 전환이다', correct: true },
          { text: '그렇다. 하드웨어가 일으킨다', leadsTo: 2 },
          { text: '타이머가 대신 일으킨다', leadsTo: 2 },
          { text: '커널이 주기적으로 검사한다', leadsTo: 0 },
        ],
        rationale:
          '시스템 콜을 부르면 CPU가 전용 명령으로 커널 모드에 들어간다.',
      },
      {
        kind: 'boundary',
        stem: '잦은 시스템 콜을 줄이려고 쓰는 것은?',
        choices: [
          { text: 'io_uring 같은 기술', correct: true },
          { text: '스레드 수를 늘리는 것', leadsTo: 3 },
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
          { text: '단기 스케줄러', correct: true },
          { text: '장기 스케줄러', leadsTo: 0 },
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
          { text: '너무 자주면 문맥 교환 비용이 처리량을 깎는다', correct: true },
          { text: '자주 내릴수록 언제나 낫다', leadsTo: 3 },
          { text: '주기와 처리량은 무관하다', leadsTo: 3 },
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
          { text: '링커', correct: true },
          { text: '전처리기', leadsTo: 2 },
          { text: '컴파일러', leadsTo: 2 },
          { text: '어셈블러', leadsTo: 2 },
        ],
        rationale:
          '외부 함수 호출부의 실제 메모리 주소를 연결해 최종 실행 파일을 만든다.',
      },
      {
        kind: 'misconception',
        stem: '컴파일러가 잡아 주는 오류의 범위는?',
        choices: [
          { text: '구문과 타입 같은 정적 오류까지. 논리는 못 잡는다', correct: true },
          { text: '논리 오류까지 모두 잡는다', leadsTo: 1 },
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
          { text: '다른 모듈과의 연결 정보', correct: true },
          { text: '기계어', leadsTo: 2 },
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
          { text: '고정 크기로 나누는가, 논리적 단위로 나누는가', correct: true },
          { text: '가상인가 물리인가', leadsTo: 3 },
          { text: '읽기인가 쓰기인가', leadsTo: 1 },
          { text: '커널이 하는가 사용자가 하는가', leadsTo: 2 },
        ],
        rationale:
          '페이징은 같은 크기로, 세그멘테이션은 코드·데이터·스택처럼 의미론적 단위로 나눈다.',
      },
      {
        kind: 'misconception',
        stem: '페이징에서 생기는 단편화는?',
        choices: [
          { text: '마지막 페이지에 남는 내부 단편화', correct: true },
          { text: '조각 사이에 생기는 외부 단편화', leadsTo: 0 },
          { text: '단편화가 없다', leadsTo: 0 },
          { text: '둘 다 심하게 생긴다', leadsTo: 0 },
        ],
        rationale:
          '크기가 같으니 사이에 못 쓰는 틈은 안 생긴다. 대신 마지막으로 할당된 페이지에 공간이 남는다.',
      },
      {
        kind: 'boundary',
        stem: '세그멘테이션이 보호와 공유에 유리한 까닭은?',
        choices: [
          { text: '논리적 구조를 그대로 반영하기 때문', correct: true },
          { text: '크기가 고정이기 때문', leadsTo: 0 },
          { text: '단편화가 없기 때문', leadsTo: 0 },
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
          { text: '작업 완료를 누가 확인하느냐', correct: true },
          { text: '제어권을 언제 돌려주느냐', leadsTo: 2 },
          { text: '스레드를 몇 개 쓰느냐', leadsTo: 2 },
          { text: '커널을 거치느냐', leadsTo: 4 },
        ],
        rationale:
          '블로킹·논블로킹은 호출된 쪽이 제어권을 언제 돌려주는지의 구분이라 축이 다르다.',
      },
      {
        kind: 'misconception',
        stem: '논블로킹이면 완료를 저절로 알게 되는가?',
        choices: [
          { text: '직접 물어보거나 알림을 받아야 한다', correct: true },
          { text: '완료되면 자동으로 값이 채워진다', leadsTo: 0 },
          { text: '블로킹과 같은 방식으로 기다린다', leadsTo: 2 },
          { text: '완료 여부를 알 수 없다', leadsTo: 0 },
        ],
        rationale:
          '계속 물어보는 것을 폴링이라 하고, 콜백이나 이벤트 루프로 알림을 받을 수도 있다.',
      },
      {
        kind: 'boundary',
        stem: '블로킹 방식이 주는 이점은?',
        choices: [
          { text: '코드가 직관적이다', correct: true },
          { text: '자원 효율이 높다', leadsTo: 2 },
          { text: '처리량이 항상 크다', leadsTo: 2 },
          { text: '이점이 없다', leadsTo: 3 },
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
          { text: '한 비트가 뒤집힌 경우까지', correct: true },
          { text: '몇 비트든 되돌린다', leadsTo: 1 },
          { text: '되돌리지 못하고 검출만 한다', leadsTo: 0 },
          { text: '체크 비트 수만큼 되돌린다', leadsTo: 3 },
        ],
        rationale:
          '두 비트가 뒤집히면 있다는 것만 알고 자리는 못 찾는다.',
      },
      {
        kind: 'boundary',
        stem: '검출만으로 충분하지 않은 자리는?',
        choices: [
          { text: '지연이 길거나 재전송이 불가능한 곳', correct: true },
          { text: '데이터가 작은 곳', leadsTo: 0 },
          { text: '네트워크로 보내는 곳', leadsTo: 4 },
          { text: '어디서나 검출로 충분하다', leadsTo: 2 },
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
          { text: '완료 확인이 필요해 로직이 복잡해진다', correct: true },
          { text: '처리량이 반드시 떨어진다', leadsTo: 2 },
          { text: '스레드를 더 써야 한다', leadsTo: 4 },
          { text: '대가가 없다', leadsTo: 0 },
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
          { text: '접근 순서가 결과를 바꾸는 상황', correct: true },
          { text: '스레드가 많은 상황', leadsTo: 0 },
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
          { text: '안전해지지만 성능이 떨어진다', correct: true },
          { text: '넓을수록 언제나 낫다', leadsTo: 0 },
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
          { text: '원자적 변수처럼 하드웨어 수준 명령을 쓴다', correct: true },
          { text: '스레드를 줄인다', leadsTo: 2 },
          { text: '임계 구역을 없앤다', leadsTo: 0 },
          { text: '방법이 없다', leadsTo: 2 },
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
          { text: 'CPU가 직접 확인하는가, 장치가 깨우는가', correct: true },
          { text: '속도가 빠른가 느린가', leadsTo: 2 },
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
          { text: '소프트웨어 명령이나 예외로도 온다', correct: true },
          { text: '하드웨어에서만 온다', leadsTo: 1 },
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
          { text: '현대 운영체제의 멀티태스킹', correct: true },
          { text: '가상 메모리', leadsTo: 3 },
          { text: '파일 시스템', leadsTo: 0 },
          { text: '네트워크 통신', leadsTo: 2 },
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
          { text: '현재 프로세스의 PCB', correct: true },
          { text: '디스크의 스왑 영역', leadsTo: 4 },
          { text: '다음 프로세스의 스택', leadsTo: 0 },
          { text: '커널 힙', leadsTo: 0 },
        ],
        rationale:
          '프로그램 카운터와 레지스터 값을 옮겨 적어야 나중에 중단된 지점부터 이어 갈 수 있다.',
      },
      {
        kind: 'misconception',
        stem: '전환할 때 CPU 캐시는 지워지는가?',
        choices: [
          { text: '지워지는 것이 아니라 새 작업의 데이터에 밀린다', correct: true },
          { text: '통째로 지워진다', leadsTo: 1 },
          { text: '그대로 보존된다', leadsTo: 1 },
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
          { text: 'First-fit', correct: true },
          { text: 'Best-fit', leadsTo: 0 },
          { text: 'Worst-fit', leadsTo: 0 },
          { text: '셋이 같다', leadsTo: 2 },
        ],
        rationale:
          '리스트의 처음부터 찾다가 멈추므로 오버헤드가 적다.',
      },
      {
        kind: 'misconception',
        stem: '딱 맞는 조각을 고르면 낭비가 줄어드는가?',
        choices: [
          { text: '쓸 수 없을 만큼 작은 조각이 남아 외부 단편화가 심해진다', correct: true },
          { text: '낭비가 확실히 준다', leadsTo: 1 },
          { text: '탐색도 빨라진다', leadsTo: 0 },
          { text: '단편화가 사라진다', leadsTo: 2 },
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
          { text: '페이지 테이블을 매번 보러 가는 것이 느려서', correct: true },
          { text: '물리 메모리를 아끼려고', leadsTo: 2 },
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
          { text: '주소 공간에 꼬리표를 달 수 있으면 앞 항목을 남긴다', correct: true },
          { text: '언제나 통째로 비운다', leadsTo: 1 },
          { text: '절대 비우지 않는다', leadsTo: 0 },
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
          { text: '아니다. 어떤 전환인지와 대기 상황을 함께 봐야 한다', correct: true },
          { text: '많을수록 항상 나쁘다', leadsTo: 3 },
          { text: '적을수록 항상 좋다', leadsTo: 3 },
          { text: '횟수만 보면 충분하다', leadsTo: 3 },
        ],
        rationale:
          '기다리며 CPU를 놓는 voluntary switch와 밀려나는 involuntary switch는 뜻이 다르다. run queue 대기와 CPU 사용률을 함께 본다.',
      },
      {
        kind: 'boundary',
        stem: '간접 비용의 크기를 좌우하는 것은?',
        choices: [
          { text: '두 작업의 working set과 코어 이동', correct: true },
          { text: '전환 명령의 개수', leadsTo: 0 },
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
          { text: '소유권과 카운트가 표현하는 뜻', correct: true },
          { text: '속도', leadsTo: 3 },
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
          { text: '소유권이 없고 다른 스레드도 신호할 수 있어 다르다', correct: true },
          { text: '같은 도구다', leadsTo: 0 },
          { text: '더 안전하다', leadsTo: 0 },
          { text: '더 느릴 뿐 같다', leadsTo: 0 },
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
          { text: '운영체제가 CPU를 강제로 회수할 수 있다', correct: true },
          { text: '프로세스를 더 많이 만든다', leadsTo: 4 },
          { text: '우선순위를 쓰지 않는다', leadsTo: 2 },
          { text: '문맥 교환이 없다', leadsTo: 0 },
        ],
        rationale:
          '비선점형은 프로세스가 반납할 때까지 기다린다. 그래서 응답성이 갈린다.',
      },
      {
        kind: 'misconception',
        stem: '시간 조각을 짧게 할수록 좋은가?',
        choices: [
          { text: '너무 짧으면 문맥 교환 비용이 커진다', correct: true },
          { text: '짧을수록 언제나 낫다', leadsTo: 0 },
          { text: '길이는 성능과 무관하다', leadsTo: 3 },
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
          { text: '기다리는 스레드가 늘고 전환 비용이 붙어 느려진다', correct: true },
          { text: '많이 걸수록 좋다', leadsTo: 1 },
          { text: '성능과 무관하다', leadsTo: 1 },
          { text: '락을 걸면 전환이 사라진다', leadsTo: 0 },
        ],
        rationale:
          '안전과 속도를 맞바꾸는 자리라 필요한 만큼만 걸어야 한다.',
      },
      {
        kind: 'boundary',
        stem: '락 없이 일관성을 지키는 길은?',
        choices: [
          { text: 'CAS 같은 원자적 연산으로 구현한다', correct: true },
          { text: '동기화를 두 번 건다', leadsTo: 1 },
          { text: '스레드를 하나로 줄인다', leadsTo: 0 },
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
          { text: '논다. 디스크 입출력만 계속된다', correct: true },
          { text: '가장 바쁘게 돈다', leadsTo: 2 },
          { text: '평소와 같다', leadsTo: 4 },
          { text: '전환만 반복한다', leadsTo: 2 },
        ],
        rationale:
          '페이지 부재가 잦아져 쓸모 있는 일보다 페이지를 갈아 끼우는 데 더 많은 시간을 쓴다.',
      },
      {
        kind: 'misconception',
        stem: 'CPU 이용률이 낮을 때 프로세스를 더 올리면?',
        choices: [
          { text: '메모리 경쟁이 심해져 악순환이 깊어진다', correct: true },
          { text: '이용률이 올라가 해결된다', leadsTo: 0 },
          { text: '아무 변화가 없다', leadsTo: 3 },
          { text: '페이지 부재가 줄어든다', leadsTo: 2 },
        ],
        rationale:
          '각 프로세스에 할당된 메모리 공간이 줄어들어 페이지 부재가 더 심해진다.',
      },
      {
        kind: 'boundary',
        stem: '해결의 방향은?',
        choices: [
          { text: '프로세스가 필요한 최소 프레임을 보장한다', correct: true },
          { text: '프로세스를 더 많이 올린다', leadsTo: 0 },
          { text: '디스크를 빠른 것으로 바꾼다', leadsTo: 4 },
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
          { text: '실행 중 다른 프로세스가 끼어들지 못한다', correct: true },
          { text: '실행이 더 빨라진다', leadsTo: 1 },
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
          { text: '멀티코어에서 모든 CPU를 끄는 비용이 너무 크다', correct: true },
          { text: '단일 코어에서도 동작하지 않아서', leadsTo: 4 },
          { text: '원자성을 보장하지 못해서', leadsTo: 3 },
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
          { text: '메모리에서 데이터를 가져오는 지연', correct: true },
          { text: 'CPU의 연산 속도', leadsTo: 1 },
          { text: '코어 개수', leadsTo: 1 },
          { text: '둘 다 아니다', leadsTo: 2 },
        ],
        rationale:
          'CPU 연산보다 메모리 접근 지연이 훨씬 크다. 이를 메모리 벽이라 부른다.',
      },
      {
        kind: 'misconception',
        stem: 'CPU가 빠르면 처리 속도도 그만큼 오르는가?',
        choices: [
          { text: '데이터가 없으면 아무리 빨라도 논다', correct: true },
          { text: '비례해서 오른다', leadsTo: 2 },
          { text: '코어만 늘리면 된다', leadsTo: 1 },
          { text: '메모리와 무관하다', leadsTo: 2 },
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
          { text: '무엇을 공유하고 어디까지 실패를 격리하는가', correct: true },
          { text: '생성 속도', leadsTo: 2 },
          { text: '메모리 사용량', leadsTo: 2 },
          { text: '이름이 다를 뿐 같은 것', leadsTo: 0 },
        ],
        rationale:
          '프로세스는 자원과 보호의 경계이고, 스레드는 그 안에서 스케줄되는 실행 흐름이다.',
      },
      {
        kind: 'misconception',
        stem: '스레드는 스택만 따로 가진다고 해도 되는가?',
        choices: [
          { text: '스레드 ID·레지스터·signal mask·errno 등도 각자 가진다', correct: true },
          { text: '스택만 따로 가진다', leadsTo: 1 },
          { text: '아무것도 따로 갖지 않는다', leadsTo: 1 },
          { text: '힙도 따로 가진다', leadsTo: 0 },
        ],
        rationale:
          '공유 범위는 언어 런타임과 운영체제에 따라 세부가 달라진다.',
      },
      {
        kind: 'boundary',
        stem: '프로세스 전환은 항상 무겁고 스레드 전환은 항상 싼가?',
        choices: [
          { text: '고정하지 않는다. 스레드 전환에도 비용이 남는다', correct: true },
          { text: '그렇게 고정해도 된다', leadsTo: 1 },
          { text: '반대로 고정해야 한다', leadsTo: 1 },
          { text: '전환 비용은 없다', leadsTo: 1 },
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
          { text: '페이지와 프레임', correct: true },
          { text: '세그먼트와 페이지', leadsTo: 0 },
          { text: '블록과 섹터', leadsTo: 1 },
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
          { text: '외부 파편화', correct: true },
          { text: '내부 파편화', leadsTo: 0 },
          { text: '페이지 부재', leadsTo: 1 },
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
          { text: '프로세스 표의 한 줄과 종료 상태, 번호', correct: true },
          { text: '쓰던 메모리 전부', leadsTo: 2 },
          { text: '열린 파일과 소켓', leadsTo: 2 },
          { text: '실행 중이던 스레드', leadsTo: 4 },
        ],
        rationale:
          '쓰던 메모리는 이미 내놓았다. 부모가 종료 상태를 가져갈 때까지 커널이 그 자리를 남겨 둔다.',
      },
      {
        kind: 'misconception',
        stem: '고아 프로세스는 좀비인가?',
        choices: [
          { text: '아니다. 부모가 먼저 죽은 것뿐이고 init이 거둔다', correct: true },
          { text: '같은 말이다', leadsTo: 4 },
          { text: '고아가 더 위험하다', leadsTo: 4 },
          { text: '고아는 영원히 남는다', leadsTo: 4 },
        ],
        rationale:
          '좀비는 오히려 부모가 살아서 방치할 때 남는다.',
      },
      {
        kind: 'boundary',
        stem: '좀비가 실제로 문제가 되는 지점은?',
        choices: [
          { text: '표 한도를 채워 새 프로세스를 못 만들 때', correct: true },
          { text: '하나만 생겨도 메모리가 샌다', leadsTo: 0 },
          { text: 'CPU를 계속 쓴다', leadsTo: 0 },
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
          { text: '하드웨어', correct: true },
          { text: '컴파일러', leadsTo: 2 },
          { text: '운영체제 커널', leadsTo: 1 },
          { text: '프로그래머가 코드로', leadsTo: 2 },
        ],
        rationale:
          '캐시 줄마다 상태를 달아 두고 남이 같은 자리를 건드리면 상태를 바꾼다. 프로그래머가 다루는 것은 순서와 가시성 쪽이다.',
      },
      {
        kind: 'misconception',
        stem: '서로 다른 변수인데 성능이 나빠지는 경우가 있는가?',
        choices: [
          { text: '한 캐시 줄에 붙어 있으면 값이 계속 오간다', correct: true },
          { text: '다른 변수면 영향이 없다', leadsTo: 0 },
          { text: '같은 타입일 때만 영향이 있다', leadsTo: 3 },
          { text: '코어가 하나면 생긴다', leadsTo: 0 },
        ],
        rationale:
          '이것을 거짓 공유라 부른다. 변수 사이를 벌려 다른 줄에 놓으면 사라진다.',
      },
      {
        kind: 'boundary',
        stem: 'Shared 상태에서 쓰려면 무엇이 먼저인가?',
        choices: [
          { text: '다른 코어의 사본을 무효로 만든다', correct: true },
          { text: '바로 쓴다', leadsTo: 4 },
          { text: '커널에 알린다', leadsTo: 0 },
          { text: '메모리에 먼저 내린다', leadsTo: 1 },
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
          { text: '급한 쪽이 기다리는 잠금을 느린 쪽이 쥐었는데 그마저 밀릴 때', correct: true },
          { text: '급한 일의 우선순위를 잘못 매겼을 때', leadsTo: 1 },
          { text: '스케줄러가 고장 났을 때', leadsTo: 0 },
          { text: '잠금을 안 썼을 때', leadsTo: 4 },
        ],
        rationale:
          '느린 일이 중간 일에 밀려 돌지 못하면 결국 급한 일이 중간 일에 밀린 셈이 된다.',
      },
      {
        kind: 'misconception',
        stem: '이것은 기아 상태와 같은 것인가?',
        choices: [
          { text: '다르다. 우선순위대로면 일어날 수 없는 순서가 만들어진 것이다', correct: true },
          { text: '같은 현상의 다른 이름이다', leadsTo: 2 },
          { text: '기아가 더 심한 경우다', leadsTo: 2 },
          { text: '둘 다 잠금과 무관하다', leadsTo: 4 },
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
          { text: '프로세스별 표, 열린 파일 표, 아이노드', correct: true },
          { text: '곧바로 파일을 가리킨다', leadsTo: 1 },
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
          { text: '각자 따로 기억한다', correct: true },
          { text: '함께 움직인다', leadsTo: 1 },
          { text: '두 번째 열기가 실패한다', leadsTo: 3 },
          { text: '운영체제가 하나로 합친다', leadsTo: 1 },
        ],
        rationale:
          '가운데 표가 있는 이유가 그것이다. dup으로 복제하면 반대로 같은 칸을 가리켜 위치가 함께 움직인다.',
      },
      {
        kind: 'boundary',
        stem: '0, 1, 2번은 특별한 번호인가?',
        choices: [
          { text: '먼저 열려 있을 뿐이고 닫으면 다음 열기가 그 번호를 받는다', correct: true },
          { text: '커널이 예약해 둔 특별한 번호다', leadsTo: 0 },
          { text: '닫을 수 없다', leadsTo: 2 },
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
          { text: '한쪽을 골라 미리 진행한다', correct: true },
          { text: '멈춰서 기다린다', leadsTo: 2 },
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
          { text: '읽기 어려워져 재 보고 정해야 한다', correct: true },
          { text: '항상 느려진다', leadsTo: 2 },
          { text: '예측이 더 자주 틀린다', leadsTo: 2 },
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
          { text: '운영체제가 내용을 메모리에 들고 있어 디스크까지 안 간다', correct: true },
          { text: '디스크가 예열돼서', leadsTo: 4 },
          { text: '파일이 압축돼서', leadsTo: 3 },
          { text: '두 번째부터는 건너뛰어서', leadsTo: 0 },
        ],
        rationale:
          '페이지 캐시가 남는 메모리를 써서 파일 내용을 들고 있는다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 거의 다 찬 것처럼 보이면 문제인가?',
        choices: [
          { text: '정상이다. 다른 곳에서 필요하면 그때 내준다', correct: true },
          { text: '메모리 누수다', leadsTo: 1 },
          { text: '즉시 비워야 한다', leadsTo: 1 },
          { text: '캐시를 꺼야 한다', leadsTo: 3 },
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
          { text: '파일 크기에 비례하고 대개 그보다 더 든다', correct: true },
          { text: '파일 크기와 정확히 같다', leadsTo: 0 },
          { text: '파일 크기와 무관하다', leadsTo: 4 },
          { text: '항상 일정하다', leadsTo: 0 },
        ],
        rationale:
          '읽어 온 바이트를 문자열이나 객체로 바꾸면 그만큼이 또 든다. 파일 크기만 보고 여유를 재면 모자란다.',
      },
      {
        kind: 'misconception',
        stem: '메모리가 넉넉하면 통째로 읽어도 되는가?',
        choices: [
          { text: '같은 일을 동시에 열 명이 하면 열 배를 잡는다', correct: true },
          { text: '넉넉하면 문제없다', leadsTo: 1 },
          { text: '파일이 작으면 언제나 안전하다', leadsTo: 1 },
          { text: '운영체제가 알아서 나눠 준다', leadsTo: 0 },
        ],
        rationale:
          '혼자 시험하면 이 한계가 안 보인다.',
      },
      {
        kind: 'boundary',
        stem: '무엇을 보고 위험을 판단하는가?',
        choices: [
          { text: '메모리 사용량이 입력 크기에 비례하는지', correct: true },
          { text: '파일 확장자', leadsTo: 0 },
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
          { text: '자원 회수는 그대로 일어난다. 못 도는 것은 정리 코드다', correct: true },
          { text: '자원도 회수되지 않는다', leadsTo: 2 },
          { text: '메모리만 남는다', leadsTo: 0 },
          { text: '재부팅해야 회수된다', leadsTo: 2 },
        ],
        rationale:
          '잡을 수 없는 신호로 죽이면 종료 훅과 임시 파일 정리는 못 돌지만, 커널 자원 회수는 그와 무관하다.',
      },
      {
        kind: 'boundary',
        stem: '혼자 쥐고 있던 포트와 잠금은?',
        choices: [
          { text: '죽음과 함께 풀린다. 해제 코드를 못 돌렸어도 그렇다', correct: true },
          { text: '재부팅까지 잠긴 채 남는다', leadsTo: 3 },
          { text: '부모가 거둬야 풀린다', leadsTo: 0 },
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
          { text: '제어 터미널을 획득하는 것', correct: true },
          { text: '자식을 만드는 것', leadsTo: 1 },
          { text: '신호를 보내는 것', leadsTo: 2 },
          { text: '파일을 여는 것', leadsTo: 4 },
        ],
        rationale:
          '그래서 리더가 아닌 채로 남으면 터미널 쪽 신호와 엮이지 않는다.',
      },
      {
        kind: 'misconception',
        stem: '한 번 fork해서 setsid()만 부르면 충분한가?',
        choices: [
          { text: '그 자식이 리더가 되므로 한 번 더 fork한다', correct: true },
          { text: '충분하다. 터미널이 떨어진다', leadsTo: 1 },
          { text: 'setsid()만으로 리더가 아니게 된다', leadsTo: 0 },
          { text: 'fork를 세 번 해야 한다', leadsTo: 1 },
        ],
        rationale:
          'setsid()를 부르면 새 세션의 리더가 되면서 제어 터미널이 떨어진다. 여기서 한 번 더 fork해야 최종 데몬이 리더가 아니게 된다.',
      },
      {
        kind: 'boundary',
        stem: 'systemd가 띄우는 요즘 데몬은?',
        choices: [
          { text: '이 절차를 밟지 않는다', correct: true },
          { text: '같은 절차를 반드시 밟는다', leadsTo: 1 },
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
          { text: '동시성', correct: true },
          { text: '데이터 정확성', leadsTo: 0 },
          { text: '저장 공간', leadsTo: 1 },
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
          { text: '취소된 트랜잭션을 다시 시도하는 코드', correct: true },
          { text: '아무것도 없다', leadsTo: 3 },
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
          { text: '깨지면 안 되는 업무 규칙과 재시도 가능 여부', correct: true },
          { text: '격리 수준의 이름', leadsTo: 4 },
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
          { text: '다르게 구현한다. 기본값도 제품마다 다르다', correct: true },
          { text: '표준이라 모두 같다', leadsTo: 2 },
          { text: '이름만 다르고 동작은 같다', leadsTo: 2 },
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
          { text: '민감한 정보를 뺀 컬럼만 노출한다', correct: true },
          { text: '데이터를 암호화한다', leadsTo: 3 },
          { text: '접근 로그를 남긴다', leadsTo: 3 },
          { text: '원본을 읽기 전용으로 만든다', leadsTo: 1 },
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
          { text: '삽입·수정·삭제에서 생기는 이상 현상', correct: true },
          { text: '조회 속도 저하', leadsTo: 0 },
          { text: '디스크 용량 초과', leadsTo: 2 },
          { text: '동시 접근 충돌', leadsTo: 3 },
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
          { text: 'Nested Loop', correct: true },
          { text: 'Hash Join', leadsTo: 1 },
          { text: 'Merge Join', leadsTo: 0 },
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
          { text: '통계 정보를 보는 옵티마이저', correct: true },
          { text: '개발자가 쿼리에 적는다', leadsTo: 0 },
          { text: '무작위로 정해진다', leadsTo: 2 },
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
          { text: '아니다. 연산과 열 순서, 선택도가 맞아야 한다', correct: true },
          { text: '모든 읽기가 빨라진다', leadsTo: 0 },
          { text: '조회 컬럼과 무관하게 빨라진다', leadsTo: 0 },
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
          { text: '밀도', correct: true },
          { text: '중심점과의 거리', leadsTo: 0 },
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
          { text: 'K-means는 클러스터 개수, DBSCAN은 밀도 기준', correct: true },
          { text: '둘 다 클러스터 개수', leadsTo: 0 },
          { text: '둘 다 파라미터가 없다', leadsTo: 1 },
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
          { text: '유일하고 바뀌지 않을 것', correct: true },
          { text: '사람이 읽기 쉬울 것', leadsTo: 4 },
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
          { text: '한 페이지에 적게 담겨 훑을 페이지가 는다', correct: true },
          { text: '유일성이 깨진다', leadsTo: 0 },
          { text: '외래 키를 못 만든다', leadsTo: 1 },
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
          { text: '넣을 때마다 인덱스의 순서를 유지해야 해서', correct: true },
          { text: '디스크에 두 번 쓰기 때문에만', leadsTo: 3 },
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
          { text: '디스크 입출력이 늘어 전체 성능이 떨어진다', correct: true },
          { text: '조회만 계속 빨라진다', leadsTo: 1 },
          { text: '쓰기만 느려지고 나머지는 같다', leadsTo: 0 },
          { text: '옵티마이저가 알아서 무시한다', leadsTo: 2 },
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
          { text: '키가 얼마나 겹치느냐', correct: true },
          { text: '조인한 테이블 개수', leadsTo: 3 },
          { text: '컬럼 개수', leadsTo: 0 },
          { text: '인덱스 개수', leadsTo: 0 },
        ],
        rationale:
          '겹침이 많으면 중간 결과가 부풀고 정렬과 병합이 따라 는다.',
      },
      {
        kind: 'misconception',
        stem: 'Hash Join은 언제나 대량 데이터에 유리한가?',
        choices: [
          { text: '메모리가 모자라면 디스크 입출력이 생겨 느려진다', correct: true },
          { text: '데이터 양과 무관하게 언제나 빠르다', leadsTo: 1 },
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
          { text: '연결 재사용과 동시 작업 수 제한', correct: true },
          { text: '질의 결과 캐시와 재사용', leadsTo: 0 },
          { text: '자동 재시도와 로드 밸런싱', leadsTo: 1 },
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
          { text: '사용자 요청의 남은 시간보다 짧게', correct: true },
          { text: '가능한 한 길게', leadsTo: 1 },
          { text: '제한을 두지 않는다', leadsTo: 1 },
          { text: '질의 실행 시간과 같게', leadsTo: 0 },
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
          { text: '사본을 두어 가용성과 읽기를 늘린다', correct: true },
          { text: '쓰기 처리량을 늘린다', leadsTo: 1 },
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
          { text: '복제를 동기로 걸었는지에 따라 다르다', correct: true },
          { text: '언제나 즉시 같다', leadsTo: 0 },
          { text: '영원히 어긋난 채로 남는다', leadsTo: 0 },
          { text: '읽기 요청이 있어야 맞춰진다', leadsTo: 4 },
        ],
        rationale:
          '데이터가 복사되는 시점차로 복제 지연이 생긴다.',
      },
      {
        kind: 'boundary',
        stem: '쓰기가 잦고 중단 없는 운영이 우선이면?',
        choices: [
          { text: '클러스터링을 검토한다', correct: true },
          { text: '복제본을 더 늘린다', leadsTo: 0 },
          { text: '읽기 전용으로 바꾼다', leadsTo: 4 },
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
          { text: '충돌을 언제 발견하고 누가 기다리거나 다시 시도하느냐', correct: true },
          { text: '데이터 정확성', leadsTo: 0 },
          { text: '지원하는 데이터베이스', leadsTo: 3 },
          { text: '트랜잭션 사용 여부', leadsTo: 3 },
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
          { text: '고정하지 않는다. 조건부 갱신·고유 제약·멱등 키와 비교한다', correct: true },
          { text: '반드시 비관적이어야 한다', leadsTo: 1 },
          { text: '반드시 낙관적이어야 한다', leadsTo: 0 },
          { text: '분산 락만이 답이다', leadsTo: 2 },
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
          { text: '일정 비율을 넘으면 전체 스캔이 빠르다', correct: true },
          { text: '언제나 인덱스가 빠르다', leadsTo: 2 },
          { text: '언제나 전체 스캔이 빠르다', leadsTo: 2 },
          { text: '데이터 양과 무관하다', leadsTo: 0 },
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
          { text: '아니다. 하나는 질의 언어, 하나는 여러 모델을 묶은 이름', correct: true },
          { text: '같은 층위의 두 제품군이다', leadsTo: 1 },
          { text: '둘 다 질의 언어다', leadsTo: 1 },
          { text: '둘 다 저장 엔진 이름이다', leadsTo: 3 },
        ],
        rationale:
          '둘을 하나의 성질로 단정하면 선택 기준이 흐려진다.',
      },
      {
        kind: 'misconception',
        stem: '스키마 유연성은 스키마가 없다는 뜻인가?',
        choices: [
          { text: '아니다. 문서 데이터베이스도 검증 규칙을 둘 수 있다', correct: true },
          { text: '그렇다. 아무 형태나 넣을 수 있다', leadsTo: 2 },
          { text: '스키마는 관계형에만 있는 개념이다', leadsTo: 2 },
          { text: '검증은 애플리케이션만 할 수 있다', leadsTo: 2 },
        ],
        rationale:
          '관계형도 복제와 파티셔닝으로 수평 확장할 수 있다. 실제 차이는 분할 경계를 넘는 질의와 트랜잭션의 비용에서 드러난다.',
      },
      {
        kind: 'boundary',
        stem: '용도만 보고 고를 수 있는가?',
        choices: [
          { text: '없다. 대표 읽기·쓰기를 작게 시험해 비교한다', correct: true },
          { text: '로그는 무조건 비관계형이다', leadsTo: 1 },
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
          { text: '무엇을 고칠지 적은 로그', correct: true },
          { text: '고쳐진 데이터 페이지', leadsTo: 3 },
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
          { text: '로그가 디스크에 닿은 시점', correct: true },
          { text: '데이터 페이지가 디스크에 닿은 시점', leadsTo: 2 },
          { text: '메모리에서 고친 시점', leadsTo: 2 },
          { text: '체크포인트가 돈 시점', leadsTo: 0 },
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
          { text: '고른 격리 수준', correct: true },
          { text: '읽는 행의 개수', leadsTo: 1 },
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
          { text: '대부분 옛 버전을 남겨 두고 자기 시점을 읽는다', correct: true },
          { text: '언제나 잠근다', leadsTo: 2 },
          { text: '쓰기만 잠근다면 읽기도 막힌다', leadsTo: 2 },
          { text: '격리 수준과 무관하게 안 잠근다', leadsTo: 0 },
        ],
        rationale:
          '그래서 읽기가 쓰기를 안 막는다. 다만 가장 높은 수준에서는 겹치면 잠그거나 커밋 때 검사해 어긋난 쪽을 되돌린다.',
      },
      {
        kind: 'boundary',
        stem: '가장 먼저 확인할 것은?',
        choices: [
          { text: '쓰는 데이터베이스의 기본 격리 수준', correct: true },
          { text: '표준이 정한 기본값', leadsTo: 3 },
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
          { text: '등호로 걸리는 칸', correct: true },
          { text: '범위로 걸리는 칸', leadsTo: 0 },
          { text: '정렬에 쓰는 칸', leadsTo: 2 },
          { text: '값이 가장 큰 칸', leadsTo: 4 },
        ],
        rationale:
          '거기서 범위를 좁히고, 범위로 걸리는 칸을 뒤에 둔다.',
      },
      {
        kind: 'misconception',
        stem: '범위 조건 뒤의 칸은 어떻게 되는가?',
        choices: [
          { text: '찾아 들어갈 범위를 더 못 좁힌다', correct: true },
          { text: '똑같이 범위를 좁힌다', leadsTo: 0 },
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
          { text: '쓰기 비용과 옵티마이저의 선택 오류', correct: true },
          { text: '조회 속도 저하만', leadsTo: 4 },
          { text: '정렬 실패', leadsTo: 2 },
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
          { text: '키를 다시 배치해야 한다', correct: true },
          { text: '새 조각만 채우면 된다', leadsTo: 2 },
          { text: '아무 영향이 없다', leadsTo: 2 },
          { text: '샤드 키를 바꿔야 한다', leadsTo: 0 },
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
          { text: '인덱스를 쓸 수 있게 묻는 방식이라 싼 것이다', correct: true },
          { text: '방식 자체가 싸다', leadsTo: 4 },
          { text: '언제나 일정한 시간이 걸린다', leadsTo: 4 },
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
          { text: '동시에 돌릴 수 있는 CPU 작업 수를 정하기 때문', correct: true },
          { text: '연결 하나가 코어 하나를 쓰기 때문', leadsTo: 2 },
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
          { text: '아니다. 다른 병목이 없다면 더 크게 잡을 수 있다', correct: true },
          { text: '언제나 코어 수를 넘으면 안 된다', leadsTo: 4 },
          { text: 'I/O 작업은 풀을 쓰지 않는다', leadsTo: 4 },
          { text: '대기 시간과 무관하다', leadsTo: 0 },
        ],
        rationale:
          '풀 크기는 코어 수와 디스크 대기 시간을 함께 보고 정한다.',
      },
      {
        kind: 'boundary',
        stem: '공식으로 나온 값을 그대로 쓰는가?',
        choices: [
          { text: '출발점일 뿐이고 부하 시험으로 확정한다', correct: true },
          { text: '그대로 쓰면 된다', leadsTo: 3 },
          { text: '두 배로 늘려 쓴다', leadsTo: 3 },
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
          { text: '그 DB가 모르는 캐시나 외부 자원', correct: true },
          { text: '같은 DB의 다른 테이블', leadsTo: 3 },
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
          { text: '저장소의 일관성 모델과 락 알고리즘만큼만 강하다', correct: true },
          { text: '옮기기만 하면 완전히 안전하다', leadsTo: 1 },
          { text: '오히려 더 위험해진다', leadsTo: 0 },
          { text: '알고리즘과 무관하다', leadsTo: 1 },
        ],
        rationale:
          '모든 서버가 같은 저장소를 바라보고 누가 락을 쥐었는지 한 자리에서 정한다는 것이 요점이다.',
      },
      {
        kind: 'boundary',
        stem: '만료된 소유자의 뒤늦은 쓰기를 막으려면?',
        choices: [
          { text: '보호 대상이 fencing token을 검증해 거부해야 한다', correct: true },
          { text: '만료 시간을 늘린다', leadsTo: 1 },
          { text: '락을 다시 잡는다', leadsTo: 2 },
          { text: '막을 방법이 없다', leadsTo: 1 },
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
          { text: '풀릴 때까지 두드리는가, 풀릴 때 깨우는가', correct: true },
          { text: '락을 거는 곳이 다르다', leadsTo: 4 },
          { text: '만료 시간이 다르다', leadsTo: 1 },
          { text: '알고리즘이 다르다', leadsTo: 4 },
        ],
        rationale:
          '스핀은 반복 요청으로 Redis 부하를 키우고, Pub/Sub은 해제할 때 알림을 발행해 헛된 왕복을 줄인다.',
      },
      {
        kind: 'misconception',
        stem: 'Pub/Sub 방식은 알림만 기다리면 되는가?',
        choices: [
          { text: '알림이 유실될 수 있어 시간 제한을 두고 다시 확인한다', correct: true },
          { text: '알림은 반드시 도착한다', leadsTo: 2 },
          { text: '알림을 못 받으면 영원히 기다린다', leadsTo: 2 },
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
          { text: '같은 충돌이 연달아 나므로 백오프와 지터를 둔다', correct: true },
          { text: '바로 거는 편이 빠르다', leadsTo: 2 },
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
          { text: '무한 재시도가 몰리면 커넥션을 다 써 버린다', correct: true },
          { text: '코드가 길어져서', leadsTo: 3 },
          { text: '예외가 쌓여서', leadsTo: 0 },
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
          { text: '구현과 부딪히는 빈도에 달렸다', correct: true },
          { text: '수준마다 정해진 비율이 있다', leadsTo: 1 },
          { text: '항상 절반으로 준다', leadsTo: 1 },
          { text: '전혀 깎이지 않는다', leadsTo: 2 },
        ],
        rationale:
          '충돌이 드물면 높은 수준을 써도 체감이 작을 수 있다.',
      },
      {
        kind: 'boundary',
        stem: '충돌이 잦아지면 무엇이 늘어나는가?',
        choices: [
          { text: '롤백과 대기 시간', correct: true },
          { text: '캐시 적중률', leadsTo: 3 },
          { text: '인덱스 크기', leadsTo: 0 },
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
          { text: '옵티마이저가 살펴볼 경로가 넓어진다', correct: true },
          { text: '읽는 행 수가 줄어든다', leadsTo: 3 },
          { text: '인덱스가 자동으로 생긴다', leadsTo: 0 },
          { text: '결과가 더 정확해진다', leadsTo: 1 },
        ],
        rationale:
          '서브쿼리로 두면 언네스팅되지 않는 한 블록 안으로 최적화가 제한된다.',
      },
      {
        kind: 'misconception',
        stem: '있는지만 보는 서브쿼리를 단순 조인으로 바꾸면?',
        choices: [
          { text: '안쪽 중복 탓에 바깥 행이 늘어 중복 제거가 필요해진다', correct: true },
          { text: '결과가 똑같다', leadsTo: 1 },
          { text: '항상 빨라진다', leadsTo: 3 },
          { text: '문법 오류가 난다', leadsTo: 1 },
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
]
