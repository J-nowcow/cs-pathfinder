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
]
