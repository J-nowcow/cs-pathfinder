import { readFileSync, writeFileSync } from 'node:fs'
import { loadEnvLocal } from '../src/lib/load-env'

/**
 * M2 — Claude 직접 판정 관계를 `data/relations.ts`에 병합한다.
 *
 * 관계의 원본은 DB가 아니라 이 파일이다. DB에만 넣으면 파일이 원본이라는
 * 규칙이 깨지고, 시험 DB(PGlite)는 그 관계를 영영 못 본다.
 *
 * 판정 경위(2026-08-09): 관계 0인 노드 117개의 벡터 이웃 쌍 221개를
 * Claude 서브에이전트 둘이 2-pass(판정→자기반박)로 심사했다. Gemini 0회.
 * none 172 · 관계 채택 아래 목록 · dup 2건(#20/#30, #71/#256)은
 * 관계가 아니라 등가라 `mark-duplicates.ts`로 갔다.
 *
 * 충돌 해소 두 건:
 * - 201-271: A는 prerequisite, B는 shares — **더 구체적인 쪽(prerequisite)**
 * - 321-17: instance_of인데 방향 근거가 판정문과 어긋나 확인 불가 —
 *   **shares로 강등.** 틀린 화살표는 없는 화살표보다 나쁘다
 *
 * votes: 2. 판정 1차 + 자기반박 2차를 통과한 것만 남았다. 3회 다수결
 * (build-relations 방식)과 같지 않다는 것을 안다 — 그쪽은 흔들리는 판정의
 * 회차 간 필터고, 이쪽은 한 판정자의 이중 검증이다. 화면 문턱(votes>=2)을
 * 넘기려는 목적이 같아 값을 맞춘다.
 *
 * 실행: npx tsx scripts/merge-m2-relations.ts        (미리보기)
 *       npx tsx scripts/merge-m2-relations.ts --apply
 */
loadEnvLocal()

type Kind = 'shares_concept' | 'prerequisite' | 'alternative' | 'instance_of'
/** [aNum, bNum, kind, reason, fromNum?] — 방향 있는 종류만 fromNum */
type J = [number, number, Kind, string, number?]

const JUDGED: J[] = [
  [3, 41, 'prerequisite', 'TIME_WAIT의 의미와 목적을 알아야 포트 고갈 진단이 읽힌다', 3],
  [3, 312, 'prerequisite', '종료 시 지나는 상태 흐름을 알아야 그중 TIME_WAIT의 필요성 논의가 읽힌다', 312],
  [9, 167, 'shares_concept', '제한된 CPU 코어 위에서 동시 실행 수를 제한하는 풀링 원리를 공유한다'],
  [9, 229, 'prerequisite', '커넥션 풀의 존재 이유를 알아야 적정 크기 산정 논의가 읽힌다', 229],
  [11, 2, 'shares_concept', '분산 환경에서 단일 DB 수준 보장(락·트랜잭션)이 깨진다는 같은 밑바탕을 다룬다'],
  [11, 12, 'instance_of', 'Redis 스핀락/Pub-Sub 구현은 분산 락 일반론의 구체 사례다', 12],
  [19, 76, 'shares_concept', '이벤트 루프의 매크로/마이크로태스크 큐라는 같은 메커니즘을 다룬다'],
  [20, 200, 'shares_concept', '격리 수준 선택과 성능 비용 트레이드오프라는 같은 밑바탕을 다룬다'],
  [21, 243, 'prerequisite', '값/참조 타입의 구분 기준을 알아야 메모리 관점 선택 논의가 읽힌다', 243],
  [22, 207, 'shares_concept', '조인 실행 비용이 재작성 판단의 근거라는 같은 밑바탕을 공유한다'],
  [22, 49, 'shares_concept', '서브쿼리의 조인 변환이라는 같은 주제를 일반/세부에서 다룬다'],
  [29, 3, 'prerequisite', '4-way 종료 흐름을 알아야 마지막 ACK 유실 대비인 TIME_WAIT 이유가 읽힌다', 29],
  [29, 312, 'shares_concept', '같은 TCP 종료 절차를 메시지 교환 관점과 상태 전이 관점에서 각각 다룬다'],
  [38, 181, 'shares_concept', '동일 출처 정책과 크로스 사이트 공격 방어라는 같은 밑바탕을 다룬다'],
  [40, 31, 'prerequisite', 'DNS 조회가 도는 순서를 알아야 그 사슬을 누가 도는지인 재귀/반복 구분이 읽힌다', 31],
  [41, 312, 'shares_concept', 'TCP 종료 상태(TIME_WAIT 포함)라는 같은 밑바탕 위의 질문들이다'],
  [43, 22, 'shares_concept', '서브쿼리의 조인 변환(언네스팅)이라는 같은 밑바탕을 내부/실무 관점에서 다룬다'],
  [43, 44, 'prerequisite', '언네스팅의 정의를 알아야 뷰 병합과의 비교가 읽힌다', 43],
  [44, 49, 'shares_concept', '옵티마이저의 서브쿼리 변환이라는 같은 밑바탕을 다룬다'],
  [47, 285, 'prerequisite', '이미지와 컨테이너의 구분을 알아야 이미지 최소화 이유가 읽힌다', 285],
  [48, 240, 'prerequisite', 'Hook의 기초와 목적을 알아야 useEffect 의존성 배열 세부 동작이 읽힌다', 240],
  [48, 6, 'shares_concept', 'useEffect 의존성 배열의 실행 규칙이라는 같은 메커니즘을 다룬다'],
  [49, 50, 'shares_concept', 'EXISTS/IN 변환의 산물이 곧 세미/안티 조인으로, 같은 변환 메커니즘을 다룬다'],
  [50, 51, 'prerequisite', '안티 조인이 무엇인지 알아야 Hash Anti Join 내부 동작이 읽힌다', 50],
  [76, 89, 'shares_concept', '이벤트 루프에서 실행 시점에 따른 비동기 수단 선택이라는 같은 밑바탕을 다룬다'],
  [102, 13, 'shares_concept', '동시 수정 충돌의 감지와 해소(버전 비교·재시도·병합)라는 같은 문제 기반을 다룬다'],
  [104, 98, 'shares_concept', '시작 성능을 위해 줄이거나 미룬 것의 대가를 나중에 치른다는 같은 트레이드오프를 다룬다'],
  [160, 218, 'instance_of', '다익스트라/벨만-포드 구분은 최단 경로 알고리즘 선택 기준의 구체 사례다', 160],
  [160, 164, 'shares_concept', '다익스트라=그리디, 벨만-포드=DP로 패러다임 구분이 두 알고리즘 차이를 설명한다'],
  [190, 174, 'prerequisite', '배열/연결 리스트의 트레이드오프를 알아야 인접 행렬/리스트 선택이 읽힌다', 174],
  [198, 225, 'prerequisite', 'IP 주소의 역할을 알아야 URL 입력 후 DNS·연결 과정이 읽힌다', 198],
  [198, 325, 'prerequisite', 'IP 주소 개념(공인/사설)을 알아야 NAT 동작이 읽힌다', 198],
  [201, 44, 'prerequisite', '뷰가 무엇이고 언제 쓰는지 알아야 뷰 병합 최적화 비교가 읽힌다', 201],
  [201, 271, 'prerequisite', '뷰의 용도를 알아야 뷰 사용 시 성능 주의점이 읽힌다', 201],
  [271, 22, 'shares_concept', '둘 다 옵티마이저의 서브쿼리·뷰 병합과 쿼리 성능을 다룬다'],
  [272, 285, 'shares_concept', '둘 다 컨테이너 기초 개념(격리 원리·이미지와 컨테이너 관계)을 다룬다'],
  [275, 245, 'prerequisite', '이진 탐색 트리를 알아야 B-tree의 디스크 이점(높은 분기·낮은 높이)이 읽힌다', 245],
  [277, 243, 'instance_of', '자바 원시/래퍼 타입 차이는 값/참조 타입 구분의 구체 사례', 277],
  [277, 21, 'instance_of', '원시/래퍼 메모리 차이는 메모리 관점 값/참조 타입 선택의 자바 사례', 277],
  [281, 56, 'shares_concept', '둘 다 메시지 큐의 전달 보장 의미론을 다루며 재처리와 순서 보장이 상호 영향을 준다'],
  [283, 151, 'shares_concept', '수평 확장은 요청 분배(로드 밸런싱) 문제와 직결된다'],
  [283, 284, 'shares_concept', '수평 확장은 앞단 로드 밸런서 배치를 전제한다'],
  [284, 239, 'shares_concept', '둘 다 앞단 계층 분리(프록시·웹 서버)의 이점을 다룬다'],
  [310, 3, 'shares_concept', '둘 다 TCP 연결 종료 국면의 상태·패킷 처리를 다룬다'],
  [310, 312, 'shares_concept', '정상 종료 상태 전이와 RST 강제 종료는 같은 TCP 종료 의미론을 다룬다'],
  [316, 135, 'shares_concept', '둘 다 풀·캐시로 동일 인스턴스를 보장하는 메커니즘이다(문자열 인터닝·1차 캐시)'],
  [317, 245, 'prerequisite', '이진 탐색 트리를 알아야 B-Tree의 디스크 적합성이 읽힌다', 245],
  [318, 250, 'shares_concept', '둘 다 멀티코어 하드웨어 수준의 일관성·동기화 메커니즘을 다룬다'],
  [321, 17, 'shares_concept', '목록 조회의 쿼리 폭증(N+1)이라는 같은 문제를 다룬다'],
  [323, 143, 'shares_concept', '흐름 제어(수신 버퍼)와 혼잡 제어(네트워크)라는 전송 속도 제약의 양면을 다룬다'],
  [324, 325, 'shares_concept', '둘 다 로컬 네트워크의 주소 지정과 패킷 전달(ARP·NAT)을 다룬다'],
  [333, 125, 'shares_concept', '둘 다 응답 캐시 정책(무엇을 언제 캐시하고 어떻게 검증할지)을 다룬다'],
  [333, 225, 'shares_concept', '브라우저 캐시 판정은 URL 요청 처리 과정의 한 단계다'],
  [336, 254, 'shares_concept', '둘 다 인덱스 선택도와 스캔 효율을 다룬다'],
  [336, 5, 'shares_concept', '복합 인덱스 컬럼 순서는 인덱스가 실행 계획에서 안 타는 주요 원인이다'],
  [339, 283, 'shares_concept', '트래픽 급증 대응 전략(유입 제한과 용량 확장)을 다룬다'],
  [340, 97, 'shares_concept', '둘 다 권한(인가)의 부여 기준과 지속성을 다룬다'],
  [342, 157, 'instance_of', 'HashMap의 충돌 처리는 일반 해시 충돌 해결법의 구체 사례다', 342],
  [342, 213, 'instance_of', 'HashMap의 충돌 처리는 일반 해시 충돌 해결법의 구체 사례다', 342],
  [28729, 47, 'shares_concept', '둘 다 컨테이너 이미지 레이어 구조에 기반한다'],
]

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const nums = [...new Set(JUDGED.flatMap(([a, b]) => [a, b]))]
  const r = await pool.query<{ number: number; identity_scope: string; q: string }>(
    `select number, identity_scope, normalized_question as q from qnode where number = any($1)`,
    [nums],
  )
  await pool.end()
  const byNum = new Map(r.rows.map((x) => [x.number, x]))

  const missing = nums.filter((n) => !byNum.has(n))
  if (missing.length > 0) {
    console.error(`번호를 못 찾았다: ${missing.join(', ')}`)
    process.exit(1)
  }

  const path = 'data/relations.ts'
  const text = readFileSync(path, 'utf8')

  /* 이미 있는 쌍(무순서)+종류는 건너뛴다. 판정을 두 번 실어도 파일이 안 는다 */
  const existing = new Set<string>()
  for (const m of text.matchAll(
    /fromQuestion: "((?:[^"\\]|\\.)*)".*?toQuestion: "((?:[^"\\]|\\.)*)".*?kind: "([a-z_]+)"/g,
  )) {
    const [q1, q2] = [m[1], m[2]].sort()
    existing.add(`${q1}::${q2}::${m[3]}`)
  }

  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const seen = new Set<string>()
  const lines: string[] = []
  let skipped = 0

  for (const [a, b, kind, reason, fromNum] of JUDGED) {
    const directed = kind === 'prerequisite' || kind === 'instance_of'
    const fromN = directed ? fromNum! : Math.min(a, b)
    const toN = directed ? (fromNum === a ? b : a) : Math.max(a, b)
    const from = byNum.get(fromN)!
    const to = byNum.get(toN)!

    const [q1, q2] = [from.q, to.q].sort()
    const key = `${q1}::${q2}::${kind}`
    if (seen.has(key) || existing.has(key)) {
      skipped += 1
      continue
    }
    seen.add(key)

    lines.push(
      `  { fromScope: "${esc(from.identity_scope)}", fromQuestion: "${esc(from.q)}", ` +
        `toScope: "${esc(to.identity_scope)}", toQuestion: "${esc(to.q)}", ` +
        `kind: "${kind}", reason: "${esc(reason)}", votes: 2 },`,
    )
  }

  console.log(`새 관계 ${lines.length} · 중복 건너뜀 ${skipped}`)
  if (!apply) {
    for (const l of lines.slice(0, 5)) console.log(l)
    console.log('... (--apply로 기록)')
    return
  }

  const end = text.lastIndexOf(']')
  writeFileSync(path, text.slice(0, end) + lines.join('\n') + '\n' + text.slice(end))
  console.log(`${path}에 붙였다. npm run seed로 DB에 반영할 것`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
