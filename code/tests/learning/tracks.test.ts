import { describe, expect, it } from 'vitest'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { BACKEND_INTERVIEW_30 } from '../../data/learning-tracks'
import { NODE_LEVELS } from '../../data/node-levels'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import {
  estimatedTrackMinutes,
  resolveTrackQuestions,
  validateLearningTrack,
  type LearningTrack,
} from '@/lib/learning/tracks'

const corpus = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]
const questions = corpus.map((node) => node.question)

describe('백엔드 CS 면접 30 트랙', () => {
  it('현재 말뭉치의 서로 다른 질문 30개만 순서대로 참조한다', () => {
    expect(validateLearningTrack(BACKEND_INTERVIEW_30, questions)).toEqual([])
    expect(BACKEND_INTERVIEW_30.questionKeys).toHaveLength(30)
    expect(new Set(BACKEND_INTERVIEW_30.questionKeys)).toHaveLength(30)
    expect(BACKEND_INTERVIEW_30.questionKeys[0]).toBe('프로세스와 스레드의 핵심 차이는 무엇인가?')
    expect(BACKEND_INTERVIEW_30.questionKeys.at(-1)).toBe('요청이 한꺼번에 몰릴 때 어떻게 막는가?')
  })

  it('모든 질문에 난이도와 꼬리질문 5개가 있다', () => {
    const byQuestion = new Map(corpus.map((node) => [node.question, node]))
    const leveled = new Set(NODE_LEVELS.map((entry) => entry.question))

    for (const question of BACKEND_INTERVIEW_30.questionKeys) {
      expect(byQuestion.get(question)?.suggestions).toHaveLength(5)
      expect(leveled.has(question)).toBe(true)
    }
  })

  it('문제당 예상 시간으로 전체 시간을 계산한다', () => {
    expect(estimatedTrackMinutes(BACKEND_INTERVIEW_30)).toBe(150)
  })

  it('데이터베이스 선택을 낡은 제품 이분법으로 설명하지 않는다', () => {
    const byQuestion = new Map(corpus.map((node) => [node.question, node.body]))
    const databaseChoice = byQuestion.get('RDB와 NoSQL 중 무엇을 기준으로 선택하는가?')!
    const sqlChoice = byQuestion.get('SQL과 NoSQL은 어떤 기준으로 선택하는가?')!
    const isolation = byQuestion.get('트랜잭션 격리 수준을 결정하는 기준은 무엇인가?')!

    expect(databaseChoice).toContain('관계형은 수직 확장만 하고 NoSQL은 수평 확장만 한다는 구분은 맞지 않는다')
    expect(databaseChoice).toContain('MongoDB도 스키마 검증')
    expect(sqlChoice).toContain('스키마 유연성이 곧 스키마 부재를 뜻하지는 않는다')
    expect(sqlChoice).not.toContain('수직 확장 (Scale-up)')
    expect(sqlChoice).not.toContain('NoSQL은 정해진 틀 없이')
    expect(isolation).toContain('PostgreSQL의 기본값은 Read Committed')
    expect(isolation).toContain('InnoDB의 기본값은 Repeatable Read')
    expect(isolation).not.toContain('금융권이나 결제 로직')
  })

  it('낙관적 방식도 대기 없이 공짜로 동작한다고 설명하지 않는다', () => {
    const locking = corpus.find((node) => node.question === '낙관적 락과 비관적 락은 무엇으로 고르는가?')?.body ?? ''

    expect(locking).toContain('낙관적 방식도 최종 UPDATE에서 데이터베이스 잠금을 쓰고 기다릴 수 있다')
    expect(locking).toContain('원자적 조건부 갱신, 고유 제약, 멱등 키')
    expect(locking).not.toContain('대기 시간 | 없음')
    expect(locking).not.toContain('데이터 정확성이 절대적인 곳에 비관적 락')
  })

  it('CAP의 가용성을 오래된 값을 주는 성질로 축약하지 않는다', () => {
    const cap = corpus.find((node) => node.question === '분산 시스템에서 CAP 중 무엇을 포기하게 되는가?')?.body ?? ''

    expect(cap).toContain('장애가 나지 않은 노드가 받은 모든 요청에 유한한 시간 안에 응답')
    expect(cap).toContain('선택은 데이터베이스 제품 전체보다 연산과 업무 규칙에 가깝다')
    expect(cap).not.toContain('옛 값이라도 답한다')
    expect(cap).not.toContain('실제 선택은 CP냐 AP냐다')
  })

  it('DNS 조회 계층과 전송 방식을 구분한다', () => {
    const dns = corpus.find((node) => node.question === 'DNS 조회는 어떤 순서로 도는가?')?.body ?? ''

    expect(dns).toContain('전송은 UDP 하나로 고정되지 않는다')
    expect(dns).toContain('DoT, DoH, DoQ')
    expect(dns).not.toContain('DNS는 짧은 질의마다 연결을 맺는 비용을 피하려고 UDP를 쓴다')
  })

  it('HTTP/1.1 파이프라이닝과 HTTP/2 멀티플렉싱을 구분한다', () => {
    const http2 = corpus.find((node) => node.question === 'HTTP/2는 HTTP/1.1의 무엇을 고쳤는가?')?.body ?? ''

    expect(http2).toContain('HTTP/1.1 파이프라이닝은 요청을 기다리지 않고 연달아 보낼 수 있다')
    expect(http2).toContain('각 스트림 안에서는 프레임 순서를 지키지만')
    expect(http2).not.toContain('한 연결에서 요청 하나가 끝나야 다음이 나가던 제약')
    expect(http2).not.toContain('연결 하나로 충분해진다')
  })

  it('URL 입력 과정을 TCP 하나의 고정 경로로 그리지 않는다', () => {
    const navigation = corpus.find((node) => node.question === '브라우저에 URL을 입력하면 어떤 과정을 거치는가?')?.body ?? ''

    expect(navigation).toContain('TCP와 TLS 또는 QUIC으로 보안 연결')
    expect(navigation).toContain('TLS 1.3 핸드셰이크가 QUIC 연결 설정에 통합')
    expect(navigation).toContain('서비스 워커나 HTTP 캐시')
    expect(navigation).not.toContain('브라우저 -> 서버: TCP 3-Way Handshake')
    expect(navigation).not.toContain('OS로 부터')
  })

  it('TIME_WAIT 개수 자체를 서버 포트 고갈로 단정하지 않는다', () => {
    const timeWait = corpus.find((node) => node.question === 'TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?')?.body ?? ''

    expect(timeWait).toContain('TIME_WAIT이 많다는 사실만으로 장애는 아니다')
    expect(timeWait).toContain('로컬 임시 포트나 연결 추적 자원')
    expect(timeWait).toContain('반복되는 목적지 4-tuple')
    expect(timeWait).not.toContain('트래픽이 많은 서버에서 TIME_WAIT 소켓이 쌓여 포트가 고갈')
  })

  it('JWT 형식과 세션 상태 관리 방식을 같은 축으로 단정하지 않는다', () => {
    const jwt = corpus.find((node) => node.question === 'JWT를 세션 대신 쓸 때 무엇을 잃는가?')?.body ?? ''

    expect(jwt).toContain('JWT는 토큰 형식이고 세션은 로그인 상태를 관리하는 방식')
    expect(jwt).toContain('검증 키·issuer·audience 정책 공유 필요')
    expect(jwt).toContain('JWT 서명은 claim을 숨기지 않는다')
    expect(jwt).not.toContain('서버끼리 공유할 것이 없다')
    expect(jwt).not.toContain('판단 기준은 규모다')
  })

  it('HTTPS를 공개 키로 대칭키를 전달하는 옛 설명에 가두지 않는다', () => {
    const https = corpus.find((node) => node.question === 'HTTPS는 무엇을 보장하고 무엇을 못 하는가?')?.body ?? ''

    expect(https).toContain('임시 (EC)DHE 값으로 양쪽이 같은 비밀을 만들고')
    expect(https).toContain('암호화 DNS와 ECH는 이 노출을 줄이지만')
    expect(https).toContain('세션 키와 AEAD')
    expect(https).not.toContain('비대칭키로 대칭키만 주고받고')
    expect(https).not.toContain('도메인의 주인이 맞다')
  })

  it('뮤텍스와 바이너리 세마포어를 수만으로 구분하지 않는다', () => {
    const synchronization = corpus.find((node) => node.question === '뮤텍스와 세마포어는 무엇으로 구분하는가?')?.body ?? ''

    expect(synchronization).toContain('획득한 스레드가 해제')
    expect(synchronization).toContain('카운트를 1로 둔 바이너리 세마포어')
    expect(synchronization).not.toContain('무조건 1개')
    expect(synchronization).not.toContain('뮤텍스가 더 가볍고')
  })
})

describe('학습 트랙 검증과 해석', () => {
  const baseTrack: LearningTrack = {
    ...BACKEND_INTERVIEW_30,
    questionKeys: ['첫 질문', '둘째 질문'],
  }

  it('중복되거나 현재 말뭉치에 없는 질문을 함께 알려 준다', () => {
    const broken = { ...baseTrack, questionKeys: ['첫 질문', '첫 질문', '없는 질문'] }

    expect(validateLearningTrack(broken, ['첫 질문'])).toEqual([
      '질문이 중복되었습니다: 첫 질문',
      '현재 말뭉치에 없는 질문입니다: 없는 질문',
    ])
  })

  it('현재 노드 id로 바꾸되 트랙 순서를 지킨다', () => {
    expect(resolveTrackQuestions(baseTrack, [
      { id: 'q2', question: '둘째 질문' },
      { id: 'q1', question: '첫 질문' },
    ])).toEqual([
      { id: 'q1', question: '첫 질문', position: 1 },
      { id: 'q2', question: '둘째 질문', position: 2 },
    ])
  })

  it('깨진 참조를 조용히 누락하지 않는다', () => {
    expect(() => resolveTrackQuestions(baseTrack, [{ id: 'q1', question: '첫 질문' }]))
      .toThrow('현재 말뭉치에 없는 질문입니다: 둘째 질문')
  })
})
