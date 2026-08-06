/**
 * 질문 사이의 의미 관계.
 *
 * "같은 질문인가"가 아니라 "관련 있는가"다. 꼬리질문이 기존 질문과 같은 경우는
 * 5%뿐이라 같음만으로는 선이 안 생긴다.
 *
 * 노드 id 대신 (범위, 질문)으로 적는다. id는 그 둘에서 파생되므로 같은 것을
 * 가리키고, 이쪽이 사람이 읽고 고칠 수 있다.
 *
 * scripts/build-relations.ts가 만든다. 손으로 고치지 않는다.
 */
export type SeedRelation = {
  fromScope: string
  fromQuestion: string
  toScope: string
  toQuestion: string
  kind: 'shares_concept' | 'prerequisite' | 'alternative' | 'instance_of'
  reason: string
  votes: number
}

export const SEED_RELATIONS: SeedRelation[] = [
  { fromScope: "postgres", fromQuestion: "DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?", toScope: "sql", toQuestion: "커넥션 풀을 사용하는 이유는 무엇인가?", kind: "prerequisite", reason: "매번 커넥션을 맺는 비용이 크다는 점을 알아야 커넥션 풀을 사용하는 이유가 이해된다.", votes: 2 },
  { fromScope: "os", fromQuestion: "컨텍스트 스위칭 비용은 구체적으로 어디서 발생하는가?", toScope: "os", toQuestion: "컨텍스트 스위칭은 왜 비용이 발생하는가?", kind: "shares_concept", reason: "둘 다 컨텍스트 스위칭으로 인해 발생하는 오버헤드와 그 원인을 다룬다.", votes: 3 },
  { fromScope: "os", fromQuestion: "컨텍스트 스위칭 비용은 구체적으로 어디서 발생하는가?", toScope: "os", toQuestion: "컨텍스트 스위칭 시 CPU는 무엇을 저장하고 복원하는가?", kind: "shares_concept", reason: "컨텍스트 스위칭 비용이 발생하는 구체적인 원인인 레지스터 및 상태 저장과 복원 과정을 다룬다.", votes: 2 },
  { fromScope: "postgres", fromQuestion: "인덱스를 만들었는데 실행 계획에서 타지 않는 이유는?", toScope: "sql", toQuestion: "인덱스 범위 스캔과 전체 스캔 중 무엇을 선택하는가?", kind: "shares_concept", reason: "인덱스를 타지 않아 전체 스캔을 수행하는 원인과 인덱스 스캔 방식을 선택하는 기준은 데이터베이스 옵티마이저의 실행 계획 수립 과정이라는 동일한 개념을 공유한다.", votes: 3 },
  { fromScope: "java", fromQuestion: "equals를 재정의할 때 hashCode도 함께 재정의해야 하는 이유는?", toScope: "java", toQuestion: "동등한 객체의 해시값도 같아야 하는 이유는?", kind: "shares_concept", reason: "equals를 재정의할 때 hashCode도 함께 재정의해야 하는 이유와 동등한 객체의 해시값이 같아야 하는 이유는 해시 기반 자료구조에서 객체의 동등성과 해시값 일관성을 다루는 동일한 개념의 연장선에 있기 때문이다.", votes: 2 },
  { fromScope: "generic", fromQuestion: "해시 테이블의 평균 O(1)이 무너지는 경우는?", toScope: "generic", toQuestion: "해시 충돌 발생 시 해결 방법은 무엇인가?", kind: "shares_concept", reason: "해시 테이블의 평균 O(1)이 무너지는 핵심 원인이 해시 충돌이므로 두 개념은 직결된다.", votes: 3 },
  { fromScope: "generic", fromQuestion: "해시 테이블의 평균 O(1)이 무너지는 경우는?", toScope: "generic", toQuestion: "해시 충돌을 해결하는 두 방식의 차이는 무엇인가?", kind: "shares_concept", reason: "해시 충돌과 그 해결 방식은 해시 테이블의 성능 유지와 시간 복잡도에 직접적인 영향을 준다.", votes: 3 },
  { fromScope: "generic", fromQuestion: "해시 테이블의 평균 O(1)이 무너지는 경우는?", toScope: "generic", toQuestion: "해시 충돌 발생 시 해결적으로 어떤 방법을 사용하는가?", kind: "shares_concept", reason: "해시 충돌 발생 시의 해결 방법은 해시 테이블의 연산 효율성이 저하되는 상황을 다루기 위한 필수 개념이다.", votes: 3 },
  { fromScope: "generic", fromQuestion: "해시 테이블의 평균 O(1)이 무너지는 경우는?", toScope: "generic", toQuestion: "해시 충돌이 발생했을 때의 해결책은 무엇인가?", kind: "shares_concept", reason: "해시 충돌로 인한 성능 저하를 방지하기 위한 해결책은 해시 테이블의 시간 복잡도 분석과 밀접하다.", votes: 3 },
  { fromScope: "spring", fromQuestion: "@Transactional이 걸리지 않는 경우는?", toScope: "spring", toQuestion: "내부 메서드 호출에 부가기능이 빠지는 이유는?", kind: "shares_concept", reason: "내부 메서드 호출 시 트랜잭션과 부가기능이 적용되지 않는 원인은 스프링 AOP 프록시 동작 원리라는 동일한 개념을 공유하기 때문이다.", votes: 2 },
  { fromScope: "spring", fromQuestion: "JPA에서 N+1 쿼리는 왜 생기고 무엇으로 막는가?", toScope: "jpa", toQuestion: "즉시 로딩을 기본값처럼 쓰면 왜 위험한가?", kind: "shares_concept", reason: "즉시 로딩을 기본값처럼 쓰면 위험한 이유가 곧 N+1 문제가 발생하는 핵심 원인과 맞닿아 있다.", votes: 3 },
  { fromScope: "android", fromQuestion: "화면을 돌리면 데이터가 사라지는 이유는?", toScope: "android", toQuestion: "회전 뒤에도 남겨야 할 상태는 어디에 두는가?", kind: "alternative", reason: "화면 회전 시 사라지는 데이터를 보존하기 위해 상태를 어디에 두어야 하는지 다룬다는 점에서 직접적으로 연결됩니다.", votes: 2 },
  { fromScope: "generic", fromQuestion: "메시지 큐를 두면 무엇을 얻고 무엇을 잃는가?", toScope: "distributed", toQuestion: "메시지 순서는 어디까지 보장되는가?", kind: "shares_concept", reason: "메시지 큐의 핵심 동작 원리인 메시지 전달 순서 보장 문제를 함께 다룬다.", votes: 2 },
  { fromScope: "postgres", fromQuestion: "격리 수준을 올리면 무엇을 잃는가?", toScope: "sql", toQuestion: "트랜잭션 격리 수준을 결정하는 기준은 무엇인가?", kind: "shares_concept", reason: "둘 다 데이터베이스 트랜잭션의 격리 수준(Isolation Level)이라는 동일한 개념을 다루고 있습니다.", votes: 2 },
  { fromScope: "generic", fromQuestion: "이진 탐색 트리가 한쪽으로 치우치면 무엇이 문제인가?", toScope: "generic", toQuestion: "일반 이진트리 대신 이진탐색트리를 사용하는 이유는 무엇인가?", kind: "shares_concept", reason: "둘 다 이진 탐색 트리의 구조적 특징과 탐색 효율성의 관계를 다룬다.", votes: 3 },
  { fromScope: "generic", fromQuestion: "이진 탐색 트리가 한쪽으로 치우치면 무엇이 문제인가?", toScope: "generic", toQuestion: "이진 탐색 트리를 사용하는 이유는 무엇인가?", kind: "shares_concept", reason: "이진 탐색 트리의 성능과 한계라는 동일한 핵심 주제를 공유한다.", votes: 2 },
  { fromScope: "distributed", fromQuestion: "서킷 브레이커는 무엇을 막아주는가?", toScope: "distributed", toQuestion: "호출 시간 제한은 무엇을 기준으로 정하는가?", kind: "shares_concept", reason: "서킷 브레이커는 호출 시간 제한(Timeout)이 발생했을 때 장애를 감지하고 차단하는 메커니즘으로, 두 개념 모두 서비스 간 호출의 안정성을 다룬다.", votes: 3 },
  { fromScope: "distributed", fromQuestion: "여러 서비스를 거친 요청은 어떻게 따라가는가?", toScope: "springmvc", toQuestion: "요청 공통 처리는 어느 지점에 두는가?", kind: "shares_concept", reason: "요청의 흐름을 추적하고 공통 처리하는 지점(인터셉터, 필터 등)은 요청 추적 ID 부여와 밀접한 관련이 있다.", votes: 2 },
  { fromScope: "distributed", fromQuestion: "여러 서비스를 거친 요청은 어떻게 따라가는가?", toScope: "distributed", toQuestion: "게이트웨이를 두면 무엇을 얻고 무엇을 걱정해야 하는가?", kind: "shares_concept", reason: "분산 시스템에서 여러 서비스를 거치는 요청의 진입점으로서 게이트웨이가 요청 추적의 시작점이 되는 경우가 많다.", votes: 2 },
  { fromScope: "jvm", fromQuestion: "이름이 같은 클래스가 다른 타입이 되는 조건은?", toScope: "typescript", toQuestion: "타입스크립트의 구조적 타이핑은 무엇을 기준으로 판별하는가?", kind: "shares_concept", reason: "둘 다 이름이나 식별자 중심이 아닌 타입의 내부 구조를 바탕으로 동일성을 판별하는 기준을 다룬다.", votes: 3 },
  { fromScope: "java", fromQuestion: "체크 예외는 언제 API 계약에 넣는가?", toScope: "java", toQuestion: "체크 예외와 언체크 예외의 선택 기준은 무엇인가?", kind: "shares_concept", reason: "체크 예외와 언체크 예외의 개념 및 선택 기준을 공유하여 API 설계 시 예외 처리 전략을 결정하는 맥락을 함께 한다.", votes: 3 },
  { fromScope: "python", fromQuestion: "스레드를 늘려도 CPU 병렬성이 없는 이유는?", toScope: "os", toQuestion: "스레드 풀을 사용하는 주된 이유는 무엇인가?", kind: "shares_concept", reason: "스레드 생성 및 관리 비용과 CPU 자원 활용의 효율성이라는 공통된 개념을 다룹니다.", votes: 3 },
  { fromScope: "python", fromQuestion: "스레드를 늘려도 CPU 병렬성이 없는 이유는?", toScope: "os", toQuestion: "컨텍스트 스위칭 시 CPU는 무엇을 저장하고 복원하는가?", kind: "shares_concept", reason: "CPU 병렬성 부족의 원인인 컨텍스트 스위칭 오버헤드와 직접적으로 연관됩니다.", votes: 3 },
  { fromScope: "python", fromQuestion: "스레드를 늘려도 CPU 병렬성이 없는 이유는?", toScope: "os", toQuestion: "프로세스와 스레드의 핵심 차이는 무엇인가?", kind: "prerequisite", reason: "프로세스와 스레드의 차이를 이해해야 스레드가 CPU 자원을 어떻게 공유하고 경쟁하는지 알 수 있습니다.", votes: 2 },
  { fromScope: "android", fromQuestion: "회전 뒤에도 남겨야 할 상태는 어디에 두는가?", toScope: "android", toQuestion: "화면을 돌리면 데이터가 사라지는 이유는?", kind: "prerequisite", reason: "화면 회전 시 데이터가 사라지는 이유를 알아야 회전 뒤에도 남겨야 할 상태를 어디에 두어야 하는지 결정할 수 있다.", votes: 2 },
  { fromScope: "android", fromQuestion: "회전 뒤에도 남겨야 할 상태는 어디에 두는가?", toScope: "android", toQuestion: "화면 상태를 둘 때 두 수단을 어떻게 나누는가?", kind: "shares_concept", reason: "화면 상태를 두는 수단을 나누는 기준과 회전 시 유지할 상태를 두는 위치는 모바일 상태 관리라는 같은 밑바탕 개념을 공유한다.", votes: 2 },
  { fromScope: "react", fromQuestion: "브라우저가 화면을 그리기까지 무슨 일이 일어나는가?", toScope: "browser", toQuestion: "첫 화면을 막는 리소스는 어떻게 줄이는가?", kind: "instance_of", reason: "첫 화면을 그리기까지의 렌더링 과정을 이해해야 렌더링을 막는 리소스를 줄이는 방법을 파악할 수 있다.", votes: 2 },
  { fromScope: "dns", fromQuestion: "DNS 조회는 어떤 순서로 도는가?", toScope: "network", toQuestion: "브라우저에 URL을 입력하면 어떤 과정을 거치는가?", kind: "prerequisite", reason: "DNS 조회 과정은 브라우저에 URL을 입력했을 때 일어나는 전체 과정의 하위 단계에 해당하므로 URL 입력 과정을 먼저 알아야 한다.", votes: 3 },
  { fromScope: "android", fromQuestion: "앱이 백그라운드에서 죽는 이유는?", toScope: "android", toQuestion: "메모리 부족 시 어떤 프로세스부터 종료되는가?", kind: "shares_concept", reason: "앱이 백그라운드에서 종료되는 주요 원인인 시스템의 메모리 부족 시 프로세스 종료 우선순위 개념을 공유한다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "순환 참조 객체도 회수할 수 있는 이유는?", toScope: "python", toQuestion: "참조 횟수가 0이 아닌 객체도 왜 수거되는가?", kind: "shares_concept", reason: "순환 참조 해결과 참조 횟수가 0이 아님에도 수거되는 원리는 모두 가비지 컬렉션의 도달 가능성(Reachability) 개념을 다룬다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "순환 참조 객체도 회수할 수 있는 이유는?", toScope: "python", toQuestion: "파이썬의 가비지 컬렉션은 무엇으로 동작하는가?", kind: "shares_concept", reason: "파이썬의 가비지 컬렉션 메커니즘은 참조 횟수 방식과 순환 참조를 해결하기 위한 세대별 수집 방식을 모두 사용한다.", votes: 2 },
  { fromScope: "security", fromQuestion: "JWT를 세션 대신 쓸 때 무엇을 잃는가?", toScope: "http", toQuestion: "쿠키와 세션은 데이터 저장 위치로 구분하는가?", kind: "shares_concept", reason: "JWT와 세션의 비교는 결국 클라이언트와 서버 중 어디에 데이터를 저장하고 관리하느냐의 문제와 연결된다.", votes: 3 },
  { fromScope: "security", fromQuestion: "JWT를 세션 대신 쓸 때 무엇을 잃는가?", toScope: "http", toQuestion: "쿠키와 세션의 상태 유지 방식은 무엇으로 구분하는가?", kind: "shares_concept", reason: "JWT와 세션 모두 HTTP의 상태 유지(stateful/stateless) 방식에 관한 개념이다.", votes: 3 },
  { fromScope: "spring", fromQuestion: "@Transactional이 걸리지 않는 경우는?", toScope: "spring", toQuestion: "내부 메서드 호출에 부가기능이 빠지는 이유는?", kind: "shares_concept", reason: "@Transactional은 AOP 프록시 방식으로 동작하며, 내부 메서드 호출 시 프록시를 거치지 않아 트랜잭션이 적용되지 않는 현상이 q108의 부가기능 누락과 동일한 원리다.", votes: 3 },
  { fromScope: "security", fromQuestion: "HTTPS는 무엇을 보장하고 무엇을 못 하는가?", toScope: "security", toQuestion: "공개키와 비밀키는 무엇으로 구분하는가?", kind: "shares_concept", reason: "HTTPS는 공개키와 비밀키를 기반으로 암호화 통신을 수행하므로 공개키 기반 암호화 개념을 공유한다.", votes: 3 },
  { fromScope: "security", fromQuestion: "HTTPS는 무엇을 보장하고 무엇을 못 하는가?", toScope: "security", toQuestion: "대칭키와 공개키 중 무엇을 선택하는가?", kind: "shares_concept", reason: "HTTPS는 대칭키와 공개키 암호화를 모두 사용하여 데이터를 보호하므로 암호키 선택 및 활용 개념이 이어진다.", votes: 3 },
  { fromScope: "security", fromQuestion: "HTTPS는 무엇을 보장하고 무엇을 못 하는가?", toScope: "http", toQuestion: "HTTPS는 HTTP와 무엇이 다른가?", kind: "shares_concept", reason: "HTTPS는 HTTP에 보안 계층을 얹은 것이므로 HTTP와의 차이점과 직접적으로 연결된다.", votes: 3 },
  { fromScope: "security", fromQuestion: "HTTPS는 무엇을 보장하고 무엇을 못 하는가?", toScope: "security", toQuestion: "TLS 핸드셰이크의 핵심 목적은 무엇인가?", kind: "prerequisite", reason: "TLS 핸드셰이크는 HTTPS 연결 성립을 위한 선행 과정이므로 이를 알아야 HTTPS의 동작을 이해할 수 있다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "가비지 컬렉션이 멈춤을 만드는 이유는?", toScope: "jvm", toQuestion: "GC 알고리즘 선택 기준은 무엇인가?", kind: "shares_concept", reason: "가비지 컬렉션의 멈춤 현상(STW)은 GC 알고리즘의 성능 지표와 선택 기준에 직접적인 영향을 미치는 핵심 요소이다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "가비지 컬렉션이 멈춤을 만드는 이유는?", toScope: "jvm", toQuestion: "순환 참조 객체도 회수할 수 있는 이유는?", kind: "shares_concept", reason: "순환 참조 해결을 위한 마킹 단계 등 GC의 작동 방식은 멈춤 현상이 발생하는 근본적인 원인과 연결된다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "가비지 컬렉션이 멈춤을 만드는 이유는?", toScope: "jvm", toQuestion: "수집기는 처리량과 지연 중 무엇으로 고르는가?", kind: "shares_concept", reason: "GC의 멈춤 현상은 지연 시간(latency)과 직결되며, 수집기 선택 시 처리량과 지연 사이의 트레이드오프를 결정하는 기준이 된다.", votes: 3 },
  { fromScope: "jvm", fromQuestion: "가비지 컬렉션이 멈춤을 만드는 이유는?", toScope: "python", toQuestion: "참조 횟수가 0이 아닌 객체도 왜 수거되는가?", kind: "shares_concept", reason: "참조 횟수 기반 GC와 추적 기반 GC의 차이는 멈춤 현상의 발생 빈도와 범위에 영향을 준다.", votes: 3 },
  { fromScope: "distributed", fromQuestion: "메시지 순서는 어디까지 보장되는가?", toScope: "generic", toQuestion: "메시지 큐를 두면 무엇을 얻고 무엇을 잃는가?", kind: "shares_concept", reason: "메시지 큐를 통한 비동기 통신 시 메시지 전달 순서 보장 문제는 핵심적인 고려 사항이다.", votes: 3 },
  { fromScope: "distributed", fromQuestion: "메시지 순서는 어디까지 보장되는가?", toScope: "distributed", toQuestion: "재시도가 있는 시스템에서 멱등성이 필요한 이유는?", kind: "shares_concept", reason: "메시지 순서가 보장되지 않는 시스템에서 중복 처리나 순서 바뀜을 해결하기 위해 멱등성이 필요하다.", votes: 3 },
  { fromScope: "distributed", fromQuestion: "호출 시간 제한은 무엇을 기준으로 정하는가?", toScope: "distributed", toQuestion: "서킷 브레이커는 무엇을 막아주는가?", kind: "shares_concept", reason: "호출 시간 제한(Timeout)과 서킷 브레이커는 모두 분산 시스템에서 장애 전파를 막기 위한 타임아웃 기반의 제어 메커니즘이다.", votes: 3 },
  { fromScope: "distributed", fromQuestion: "호출 시간 제한은 무엇을 기준으로 정하는가?", toScope: "distributed", toQuestion: "재시도가 있는 시스템에서 멱등성이 필요한 이유는?", kind: "shares_concept", reason: "호출 시간 제한으로 인한 재시도 요청이 발생할 때, 시스템 안정성을 위해 멱등성 보장이 필수적이다.", votes: 2 },
  { fromScope: "java", fromQuestion: "상태 변경을 막으면 동시성에서 무엇을 얻는가?", toScope: "generic", toQuestion: "경쟁 상태를 막으려면 무엇을 고려해야 하는가?", kind: "shares_concept", reason: "상태 변경을 막아 동시성 문제를 해결하는 것과 경쟁 상태를 막기 위해 고려해야 할 요소는 동시성 제어라는 같은 밑바탕 개념을 공유한다.", votes: 3 },
  { fromScope: "os", fromQuestion: "컨텍스트 스위칭 비용은 구체적으로 어디서 발생하는가?", toScope: "os", toQuestion: "컨텍스트 스위칭 시 CPU는 무엇을 저장하고 복원하는가?", kind: "shares_concept", reason: "컨텍스트 스위칭 비용이 발생하는 구체적인 원인 중 하나인 레지스터 및 PCB 저장·복원 과정을 다룬다.", votes: 3 },
  { fromScope: "os", fromQuestion: "컨텍스트 스위칭 비용은 구체적으로 어디서 발생하는가?", toScope: "os", toQuestion: "컨텍스트 스위칭은 왜 비용이 발생하는가?", kind: "shares_concept", reason: "두 질문 모두 컨텍스트 스위칭에서 발생하는 오버헤드와 그 원인을 다룬다.", votes: 3 },
  { fromScope: "java", fromQuestion: "equals를 재정의할 때 hashCode도 함께 재정의해야 하는 이유는?", toScope: "java", toQuestion: "동등한 객체의 해시값도 같아야 하는 이유는?", kind: "shares_concept", reason: "두 질문 모두 객체의 동등성 비교와 해시 기반 컬렉션에서의 일관성 보장을 위한 hashCode의 역할을 다룬다.", votes: 3 },
  { fromScope: "spring", fromQuestion: "JPA에서 N+1 쿼리는 왜 생기고 무엇으로 막는가?", toScope: "jpa", toQuestion: "즉시 로딩을 기본값처럼 쓰면 왜 위험한가?", kind: "shares_concept", reason: "N+1 문제는 지연 로딩과 즉시 로딩의 설정 및 동작 방식과 밀접하게 연관되어 발생한다.", votes: 3 },
  { fromScope: "android", fromQuestion: "푸시 알림이 안 오는 이유는 대개 무엇인가?", toScope: "android", toQuestion: "백그라운드 제약을 피하는 방법은 무엇인가?", kind: "prerequisite", reason: "백그라운드 제약은 모바일에서 푸시 알림이 안 오거나 지연되는 주요 원인 중 하나이므로 이를 이해해야 한다.", votes: 2 },
  { fromScope: "android", fromQuestion: "푸시 알림이 안 오는 이유는 대개 무엇인가?", toScope: "generic", toQuestion: "푸시 알림의 전달 보장을 위해 무엇을 설계하는가?", kind: "shares_concept", reason: "푸시 알림의 전달 보장 설계는 푸시 알림이 도달하지 않는 문제를 해결하기 위한 기술적 대응 방안이다.", votes: 2 },
  { fromScope: "os", fromQuestion: "가상 메모리는 무엇을 해결하는가?", toScope: "os", toQuestion: "가상 메모리를 사용하는 이유는 무엇인가?", kind: "shares_concept", reason: "가상 메모리를 사용하는 이유와 해결하려는 문제는 실질적으로 동일한 개념을 다룬다.", votes: 3 },
  { fromScope: "os", fromQuestion: "가상 메모리는 무엇을 해결하는가?", toScope: "os", toQuestion: "프로세스 주소공간을 나누어 사용하는 이유는 무엇인가?", kind: "shares_concept", reason: "프로세스 주소 공간을 나누어 사용하는 것은 가상 메모리 구현의 핵심 원리이자 목적이다.", votes: 2 },
  { fromScope: "os", fromQuestion: "가상 메모리는 무엇을 해결하는가?", toScope: "os", toQuestion: "프로세스 주소 공간을 나누는 이유는 무엇인가?", kind: "shares_concept", reason: "가상 메모리를 통한 프로세스 주소 공간 분할의 목적과 해결하려는 문제를 다룬다.", votes: 2 },
  { fromScope: "os", fromQuestion: "가상 메모리는 무엇을 해결하는가?", toScope: "os", toQuestion: "쓰레싱이 발생하는 원인과 해결책은 무엇인가?", kind: "instance_of", reason: "쓰레싱은 가상 메모리 관리 실패로 인해 발생하는 구체적인 성능 저하 사례이다.", votes: 2 },
  { fromScope: "distributed", fromQuestion: "게이트웨이를 두면 무엇을 얻고 무엇을 걱정해야 하는가?", toScope: "generic", toQuestion: "웹 서버와 WAS의 역할 분담은 왜 하는가?", kind: "shares_concept", reason: "게이트웨이와 웹 서버/WAS의 역할 분담은 모두 시스템의 진입점(Entry Point)에서 요청을 분배하고 제어하는 구조적 설계에 관한 내용이다.", votes: 2 },
  { fromScope: "distributed", fromQuestion: "게이트웨이를 두면 무엇을 얻고 무엇을 걱정해야 하는가?", toScope: "distributed", toQuestion: "서킷 브레이커는 무엇을 막아주는가?", kind: "shares_concept", reason: "게이트웨이에서 서킷 브레이커를 구현하여 하위 서비스의 장애가 전체 시스템으로 전파되는 것을 방지하는 패턴을 흔히 사용한다.", votes: 2 },
  { fromScope: "distributed", fromQuestion: "게이트웨이를 두면 무엇을 얻고 무엇을 걱정해야 하는가?", toScope: "distributed", toQuestion: "여러 서비스를 거친 요청은 어떻게 따라가는가?", kind: "shares_concept", reason: "게이트웨이에서 요청에 추적 ID를 부여하여 여러 서비스를 거치는 요청의 흐름을 추적하는 분산 추적(Distributed Tracing) 기능을 수행한다.", votes: 2 },
  { fromScope: "jvm", fromQuestion: "왜 모든 바이트코드를 바로 최적화하지 않는가?", toScope: "java", toQuestion: "중간 연산을 바로 실행하지 않는 이유는?", kind: "shares_concept", reason: "두 질문 모두 실행 시점의 효율성과 지연 실행 전략의 Trade-off를 다룬다.", votes: 3 },
  { fromScope: "java", fromQuestion: "동등한 객체의 해시값도 같아야 하는 이유는?", toScope: "java", toQuestion: "equals를 재정의할 때 hashCode도 함께 재정의해야 하는 이유는?", kind: "shares_concept", reason: "동등한 객체의 해시값이 같아야 하는 이유와 equals 재정의 시 hashCode를 함께 재정의해야 하는 이유는 해시 기반 컬렉션에서 객체의 일관된 동등성 비교를 보장하기 위한 동일한 개념을 다룬다.", votes: 1 },
  { fromScope: "java", fromQuestion: "volatile은 무엇을 보장하고 놓치는가?", toScope: "java", toQuestion: "volatile 키워드는 가시성 문제를 어떻게 해결하는가?", kind: "shares_concept", reason: "기준 질문의 volatile이 보장하는 핵심 기능이 바로 가시성 문제 해결이기 때문이다.", votes: 2 },
  { fromScope: "javascript", fromQuestion: "함수가 끝난 뒤 지역 변수가 남는 이유는?", toScope: "javascript", toQuestion: "클로저를 사용해 상태를 은닉하는 이유는 무엇인가?", kind: "shares_concept", reason: "클로저는 함수가 끝난 뒤에도 지역 변수가 메모리에 남아 참조할 수 있는 원리를 다룬다.", votes: 1 },
]
