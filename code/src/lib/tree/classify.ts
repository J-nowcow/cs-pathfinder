import { CATEGORIES } from '@/lib/tree/categories'

/**
 * 질문 제목에서 카테고리를 고른다.
 *
 * 공개 저장소에서 주제를 모을 때 썼던 분류기를 옮겨 온 것이다. 그때는
 * 스크립트 안에 있었고 시험이 없었는데, 실제로 틀렸다.
 *
 * `'CI'`를 인프라 키워드로 두고 부분 문자열로 봤더니 `"Computer Science"`의
 * `sci`에 걸렸다. 그 섹션에서 다른 카테고리에 안 걸린 23건이 전부 인프라·보안으로
 * 흘러갔다. `LinkedList`와 `B-Tree`가 보안 카테고리에 들어가 있었다.
 *
 * 그래서 두 가지를 바꿨다.
 * - 영문 약어는 낱말 경계로 본다. 부분 문자열로 보면 짧은 약어가 아무 데나 걸린다
 * - 섹션 이름은 안 본다. 저장소마다 부르는 이름이 달라 신호가 아니라 잡음이다
 *
 * 시험을 붙이자 같은 부류가 둘 더 나왔다.
 * - `'인가'`가 **"무엇인가"**에 걸렸다. 우리 질문은 거의 다 그렇게 끝나므로
 *   아무 질문이나 인프라·보안이 됐다. `'권한'`으로 바꿨다
 * - `'메모리'`가 `"JVM 메모리 구조"`를 운영체제로 끌어갔다. 운영체제 규칙이
 *   앞이라 언어·런타임의 `JVM`이 이길 기회가 없었다. `'가상 메모리'`와
 *   `'메모리 관리'`로 좁혔다
 *
 * `'세션'`도 뺐다. HTTP 세션과 인증 세션이 같은 낱말이라 `JWT를 세션 대신 쓸 때`가
 * 네트워크로 갔다. 쿠키·소켓 같은 덜 겹치는 낱말로도 그쪽은 잡힌다.
 *
 * 한글 낱말은 조사가 붙어 경계를 못 잡으므로 **짧고 흔한 낱말을 쓰지 않는 것**이
 * 유일한 방어다. 두 글자짜리를 넣을 때는 그것이 다른 낱말 안에 들어가는지,
 * 그리고 다른 분야에서 같은 뜻으로 쓰이는지 먼저 생각해야 한다.
 */
type Rule = { category: string; words: string[] }

/**
 * 앞에 있는 것이 이긴다.
 *
 * 겹치는 낱말이 있을 때 순서가 곧 우선순위다. 예를 들어 "캐시"는 운영체제에도
 * 데이터베이스에도 나오는데, 앞의 규칙이 먼저 잡는다.
 */
const RULES: Rule[] = [
  {
    category: '모바일',
    words: ['안드로이드', 'Android', 'iOS', '액티비티', '프래그먼트', 'SwiftUI', 'Compose', 'RecyclerView', '앱 생명주기', '푸시 알림'],
  },
  {
    category: '프레임워크',
    words: ['스프링', 'Spring', 'JPA', 'Hibernate', 'Servlet', 'MVC', 'ORM', 'Django', '영속성 컨텍스트', 'QueryDSL', '트랜잭션 전파'],
  },
  {
    category: '프론트엔드',
    words: ['브라우저', 'React', '리액트', 'JavaScript', 'CSS', 'DOM', 'SPA', 'SSR', 'CSR', '렌더링', 'useEffect', '하이드레이션', '번들', '가상 DOM', 'Flexbox', 'Grid'],
  },
  {
    category: '데이터베이스',
    words: ['DB', '데이터베이스', 'SQL', 'NoSQL', '인덱스', '트랜잭션', '정규화', '이상', '조인', '격리 수준', '샤딩', '옵티마이저', 'B-Tree', 'B+Tree', '레디스', 'Redis', '키(Key)'],
  },
  {
    category: '네트워크',
    words: ['네트워크', 'TCP', 'UDP', 'HTTP', 'HTTPS', 'DNS', 'OSI', 'REST', 'CORS', '쿠키', '소켓', '패킷', 'TLS', 'SSL', '핸드셰이크', '로드 밸런', 'gRPC', '프록시'],
  },
  {
    category: '운영체제',
    words: ['운영체제', '프로세스', '스레드', '스케줄', '데드락', '동기화', '뮤텍스', '세마포어', '가상 메모리', '메모리 관리', '페이징', '세그먼테이션', '커널', '시스템 콜', '인터럽트', 'Linux', '리눅스', '파일 디스크립터', '컨텍스트 스위칭'],
  },
  {
    category: '자료구조 · 알고리즘',
    words: ['자료구조', '알고리즘', '정렬', '트리', '그래프', '해시', '탐색', '복잡도', 'LinkedList', '연결 리스트', '트라이', 'Trie', 'Array', 'Stack', 'Queue', 'Heap', '스택', '큐', '힙', '재귀', '동적 계획'],
  },
  {
    category: '언어 · 런타임',
    words: ['JVM', 'GC', '가비지', '객체지향', 'OOP', '컴파일', '클로저', '프로토타입', '호이스팅', '이벤트 루프', 'JIT', '제네릭', '불변', '함수형', '소수점', '패리티', '해밍', 'ARM', '컴퓨터의 구성'],
  },
  {
    category: '아키텍처 · 분산시스템',
    words: ['MSA', '마이크로', '분산', '메시지 큐', 'Kafka', '아키텍처', '디자인 패턴', 'Design Pattern', '패턴', 'Saga', 'CAP', '멱등', '서킷', '이벤트 소싱', 'Blockchain', '블록체인'],
  },
  {
    category: '인프라 · 보안',
    words: ['보안', '암호', '인증', '권한', 'JWT', 'OAuth', 'XSS', 'CSRF', 'Docker', '도커', 'Kubernetes', '쿠버네티스', '배포', 'Cloud', 'AWS', 'CI', 'CD', '방화벽', '대칭키', '공개키'],
  },
]

/**
 * 영문 약어는 낱말 경계로 본다.
 *
 * `CI`를 부분 문자열로 보면 `science`에 걸린다. 한글은 조사가 붙어서 경계가
 * 애매하므로 그대로 부분 문자열로 본다.
 */
function mentions(text: string, word: string): boolean {
  if (/^[A-Za-z+#.]+$/.test(word)) {
    return new RegExp(`(^|[^A-Za-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i').test(text)
  }
  return text.includes(word)
}

/**
 * 제목만 본다.
 *
 * 저장소의 섹션 이름은 안 쓴다. 저장소마다 부르는 이름이 달라서 신호가 아니라
 * 잡음이고, `Computer Science` 같은 이름은 실제로 오분류를 만들었다.
 */
export function classifyTitle(title: string): string | null {
  for (const rule of RULES) {
    if (rule.words.some((w) => mentions(title, w))) return rule.category
  }
  return null
}

/** 목록에 없는 카테고리가 새어 들어오지 않는지 확인한다 */
export function isKnownCategory(value: string): boolean {
  return (CATEGORIES as readonly string[]).includes(value)
}
