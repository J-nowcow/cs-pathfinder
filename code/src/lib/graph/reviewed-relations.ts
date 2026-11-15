import type { MapEdge, MapNode } from '@/lib/db/graph'
import type { RelationKind } from '@/lib/db/relations'

export type RelationDirection = 'forward' | 'reverse' | 'unreviewed'

type ReviewedDirection = {
  fromQuestion: string
  toQuestion: string
  kind: 'prerequisite' | 'instance_of'
  reason: string
  direction: 'forward' | 'reverse'
}

/**
 * Display-only review, 2026-11-11. Stored labels are model judgments, not a
 * trustworthy direction contract: some older rows contradict their own reason.
 * Each entry was read as an exact question pair AND original reason. Unmatched
 * rows stay available as neutral links; no sentence heuristic or global flip.
 * This manifest neither edits seed source nor writes to a database.
 */
export const REVIEWED_RELATION_DIRECTIONS: readonly ReviewedDirection[] = [
  {
    "fromQuestion": "DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?",
    "toQuestion": "커넥션 풀을 사용하는 이유는 무엇인가?",
    "kind": "prerequisite",
    "reason": "매번 커넥션을 맺는 비용이 크다는 점을 알아야 커넥션 풀을 사용하는 이유가 이해된다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "스레드를 늘려도 CPU 병렬성이 없는 이유는?",
    "toQuestion": "프로세스와 스레드의 핵심 차이는 무엇인가?",
    "kind": "prerequisite",
    "reason": "프로세스와 스레드의 차이를 이해해야 스레드가 CPU 자원을 어떻게 공유하고 경쟁하는지 알 수 있습니다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "화면이 닫혔는데 객체가 남는 이유는?",
    "toQuestion": "뷰 바인딩은 왜 onDestroyView에서 비우는가?",
    "kind": "instance_of",
    "reason": "뷰 바인딩 객체를 onDestroyView에서 해제하지 않아 객체가 남는 것은 화면 닫힘 후 객체 잔존의 구체적인 사례다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "폰트 표시 지연과 깜빡임을 어떻게 줄이는가?",
    "toQuestion": "브라우저가 화면을 그리기까지 무슨 일이 일어나는가?",
    "kind": "prerequisite",
    "reason": "브라우저의 렌더링 파이프라인(CRP)을 이해해야 폰트 로딩 시점과 렌더링 차단을 이해할 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "렌더링 방식은 어떤 요구로 결정하는가?",
    "toQuestion": "브라우저가 화면을 그리기까지 무슨 일이 일어나는가?",
    "kind": "prerequisite",
    "reason": "브라우저의 렌더링 파이프라인을 이해해야 서버 사이드 렌더링과 클라이언트 사이드 렌더링의 차이와 결정 기준을 파악할 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "JVM GC의 효율을 높이는 튜닝 포인트는 무엇인가?",
    "toQuestion": "JVM의 핵심 역할은 무엇인가?",
    "kind": "prerequisite",
    "reason": "JVM의 핵심 역할과 구조를 알아야 GC 튜닝 포인트를 이해할 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "데이터베이스 스키마를 설계할 때 고려할 점은 무엇인가?",
    "toQuestion": "테이블 설계 시 기본키를 설정하는 기준은 무엇인가?",
    "kind": "instance_of",
    "reason": "기본키 설정은 테이블 설계라는 스키마 설계의 구체적인 결정 사항 중 하나이다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "JVM 메모리 영역은 어떻게 구분하는가?",
    "toQuestion": "JVM의 핵심 역할은 무엇인가?",
    "kind": "prerequisite",
    "reason": "JVM의 핵심 역할을 알아야 JVM이 메모리를 어떻게 관리하고 영역을 구분하는지 이해할 수 있습니다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "멀티스레드 환경에서 스레드 세이프한 코드를 작성하는 방법은 무엇인가?",
    "toQuestion": "프로세스와 스레드의 핵심 차이는 무엇인가?",
    "kind": "prerequisite",
    "reason": "멀티스레드 환경에서의 스레드 세이프티를 이해하려면, 먼저 스레드가 공유하는 자원과 프로세스와의 차이를 이해해야 한다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "이름이 다른 두 타입이 호환되는 기준은?",
    "toQuestion": "타입스크립트의 구조적 타이핑은 무엇을 기준으로 판별하는가?",
    "kind": "instance_of",
    "reason": "타입스크립트의 구조적 타이핑은 이름이 다르더라도 내부 구조가 같으면 호환되는 구체적인 사례에 해당한다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "스레드 풀을 사용하는 주된 이유는 무엇인가?",
    "toQuestion": "프로세스와 스레드의 핵심 차이는 무엇인가?",
    "kind": "prerequisite",
    "reason": "스레드 풀의 효율성을 이해하려면 먼저 프로세스와 스레드의 구조적 차이와 스레드 생성 비용에 대한 이해가 필요하다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "데드락을 해결하기 위한 회피 전략은 무엇인가?",
    "toQuestion": "데드락은 어떤 조건이 모두 모여야 생기는가?",
    "kind": "prerequisite",
    "reason": "데드락의 발생 조건(교착 상태 조건)을 이해해야 이를 방지하거나 회피하는 전략을 세울 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "JVM의 핵심 역할은 무엇인가?",
    "toQuestion": "JVM GC의 효율을 높이는 튜닝 포인트는 무엇인가?",
    "kind": "instance_of",
    "reason": "JVM의 핵심 역할 중 하나인 메모리 관리를 수행하는 GC의 구체적인 튜닝 방법을 다룬다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "커넥션 풀을 사용하는 이유는 무엇인가?",
    "toQuestion": "DB 커넥션을 매번 새로 맺는 비용이 큰 이유는?",
    "kind": "prerequisite",
    "reason": "DB 커넥션 생성 비용이 크다는 점을 이해해야 커넥션 풀의 필요성을 이해할 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "웹 서버와 WAS의 역할 분담은 왜 하는가?",
    "toQuestion": "톰캣은 서블릿 컨테이너로서 어떤 일을 하는가?",
    "kind": "instance_of",
    "reason": "톰캣은 대표적인 WAS로서 웹 서버와의 역할 분담을 통해 동적 콘텐츠를 처리하는 구체적인 사례이다.",
    "direction": "forward"
  },
  {
    "fromQuestion": "비동기로 옮겼는데도 왜 응답 없음이 생기는가?",
    "toQuestion": "동기/비동기 및 블로킹/논블로킹의 차이는 무엇인가?",
    "kind": "prerequisite",
    "reason": "비동기 처리의 근본적인 개념인 동기/비동기 및 블로킹/논블로킹의 차이를 알아야 비동기 전환 후의 응답 없음 현상을 분석할 수 있다.",
    "direction": "reverse"
  },
  {
    "fromQuestion": "TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?",
    "toQuestion": "TIME_WAIT 포트 고갈은 어떻게 진단하는가?",
    "kind": "prerequisite",
    "reason": "TIME_WAIT의 의미와 목적을 알아야 포트 고갈 진단이 읽힌다",
    "direction": "forward"
  },
  {
    "fromQuestion": "TCP 연결은 어떤 상태를 지나 닫히는가?",
    "toQuestion": "TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?",
    "kind": "prerequisite",
    "reason": "종료 시 지나는 상태 흐름을 알아야 그중 TIME_WAIT의 필요성 논의가 읽힌다",
    "direction": "forward"
  },
  {
    "fromQuestion": "커넥션 풀을 사용하는 이유는 무엇인가?",
    "toQuestion": "커넥션 풀 크기를 CPU 코어 수로 잡는 이유는?",
    "kind": "prerequisite",
    "reason": "커넥션 풀의 존재 이유를 알아야 적정 크기 산정 논의가 읽힌다",
    "direction": "forward"
  },
  {
    "fromQuestion": "TCP 연결 종료는 왜 대개 네 번 주고받는가?",
    "toQuestion": "TCP 연결을 끊을 때 TIME_WAIT 상태가 필요한 이유는?",
    "kind": "prerequisite",
    "reason": "4-way 종료 흐름을 알아야 마지막 ACK 유실 대비인 TIME_WAIT 이유가 읽힌다",
    "direction": "forward"
  }
]

const reviewKey = (fromQuestion: string, toQuestion: string, kind: RelationKind, reason: string) =>
  JSON.stringify([fromQuestion, toQuestion, kind, reason])

const reviewed = new Map(REVIEWED_RELATION_DIRECTIONS.map((entry) => [
  reviewKey(entry.fromQuestion, entry.toQuestion, entry.kind, entry.reason), entry.direction,
]))

/** Project metadata only; raw endpoint IDs, kind and reason remain unchanged. */
export function projectReviewedRelation(
  edge: MapEdge,
  nodes: ReadonlyMap<string, MapNode>,
): MapEdge {
  if (edge.kind !== 'related' || (edge.relationKind !== 'prerequisite' && edge.relationKind !== 'instance_of')) return edge
  const from = nodes.get(edge.parentId)
  const to = nodes.get(edge.childId)
  const direction = from && to && edge.reason
    ? reviewed.get(reviewKey(from.question, to.question, edge.relationKind, edge.reason))
    : undefined
  return { ...edge, relationDirection: direction ?? 'unreviewed' }
}
