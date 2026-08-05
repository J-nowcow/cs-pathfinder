# CS 질문 트리 — 설계 문서

작성일: 2026-08-05
개정: 2026-08-05 (debate 반영, 3인 교차검증)
작업명: `cs-question-tree` (최종 서비스명 미정)

---

## 1. 문제

CS 면접 질문을 매일 하나씩 공유하는 카톡방이 있다. 질문 하나와 좋은 답변의 흐름, 그리고 꼬리질문 5~6개가 함께 올라온다.

문제는 형식이다. 카톡은 선형 텍스트라 꼬리질문이 나열만 되고 관계가 보이지 않는다. 어느 질문에서 어느 질문으로 뻗는지, 내가 어디까지 파고들었는지가 드러나지 않는다. 꼬리질문의 꼬리를 파고들면 맥락이 끊긴다.

통증은 둘이다.

- **관계가 안 보인다** — 질문들이 어떻게 이어지는지
- **내 위치가 안 보인다** — 어디까지 팠고 무엇이 남았는지

두 번째 통증은 1차 범위에서 완전히 해결되지 않는다. 다만 홈의 "이어서 파기"와 미니맵으로 부분 해결한다(§7).

## 2. 해결 방향

질문을 **그래프**로 저장하고 사용자에게는 자기가 파고든 **경로를 트리로** 보여준다. 꼬리질문은 미리 다 만들어두지 않는다. 사용자가 누를 때 그 자리에서 생성하고, 만들어진 노드는 전역 자산으로 남겨 다음 사람이 재사용한다.

핵심 성질 세 가지가 설계 전체를 지탱한다.

- **CS 질문은 수렴한다.** 수백 명이 똑같이 "TCP 3-way handshake란?"을 판다. 이걸 캐시로 바꾸면 비용이 내려가고 콘텐츠가 쌓인다.
- **같은 질문은 여러 맥락에서 나온다.** DB 커넥션에서도, 네트워크에서도 나온다. 노드를 부모와 무관하게 하나만 두면 중복이 사라지고 교차 연결 자체가 학습 콘텐츠가 된다.
- **파고든 경로에는 서사가 있다.** 그래서 경로 묶음이 곧 공유 가능한 콘텐츠 단위가 된다.

세 번째 성질이 데이터 모델의 형태를 결정한다. **경로가 콘텐츠라면 경로를 저장해야 한다.** 방문한 노드 집합만 저장하면 경로는 복원되지 않는다(§5).

## 3. 범위

### 1차 범위

- 매일 자동 발행되는 오늘의 질문
- 추천 꼬리질문 클릭 + 자유 질문 입력으로 무한 확장
- 비로그인 체험 / 로그인 시 학습 기록 저장
- 트리 공유 (읽기 전용)
- 트리 게시판 (인기·최신·카테고리)
- 모바일 포커스 읽기 + 상시 미니맵 + 지도 모드
- 홈의 "이어서 파기"

### 2차로 미룬 것

| 항목 | 사유 |
|---|---|
| 답변 기록 + AI 피드백 | "탐험이 먼저"라는 차별화 축과 반대 방향. 테이블·API·별도 할당량·등급 로직·공유 옵션이 줄줄이 딸려오는데 원래 통증과 무관하다 |
| 포크 | 사용자 0명 시점에 포크할 트리가 없다. 첫 릴리스에서 검증될 기회 자체가 없다 |
| GitHub 콘텐츠 레포 자동 커밋 | 사용자 가치 0. 발행 데이터는 DB에 남으므로 언제든 백필 가능 |
| 대분류 지도와 진척도 시각화 | |
| 교차 경로 배지 | |

### 3차

- 노드 단위 집단지성 기여 (좋은 꼬리질문을 공식 트리에 병합)
- `curated` 트리 종류와 자동 승격

---

## 4. 콘텐츠 소스

### 주제어 시드

GitHub의 CS 면접 질문 레포에서 **목차의 주제어만** 추출한다. 질문문·해설·꼬리질문은 전부 자체 생성한다.

라이선스 확인 결과다. GitHub API의 `license` 필드는 LICENSE 파일만 인식하므로 README에 선언된 라이선스를 놓친다. 아래는 README까지 확인한 결과다.

| 레포 | 라이선스 | 스타 | 시드 사용 |
|---|---|---|---|
| gyoogle/tech-interview-for-developer | MIT | 17.5k | 가능 |
| ksundong/backend-interview-question | **CC BY-NC 2.0 KR** (README 104~105행) | 5.9k | 조건부 |
| WeareSoft/tech-interview | 없음 | 4.9k | 주제어만 |
| DopplerHQ/awesome-interview-questions | 미확인 (CC0 가능성) | 83.9k | 주제어만 |
| VSFe/Tech-Interview | 없음 | 2.5k | 주제어만 |

ksundong은 **비영리 한정**이다. 같은 README 55행에는 CC BY-NC-SA로 적혀 있어 레포 내부에서도 표기가 엇갈린다. 현재 설계에 수익화가 없으므로 비영리 조건은 충족하지만, 광고·후원을 붙이는 순간 위반이다. 저작자 표시도 필요하다.

라이선스가 없는 레포는 권리 전부 보유다. 본문 복제는 불가하다. 주제어 나열은 사실에 가까워 보호 강도가 낮고 해설을 전부 새로 쓰므로 원문을 복제할 일이 없다.

**다만 "안전하다"고 단정하지 않는다.** 특정 레포 하나의 목차 구조와 배열을 대량으로 가져오면 개별 단어의 보호 여부와 별개로 편집저작물 침해 소지가 있다. 그래서 **주제어는 여러 레포에서 교차 수집하고 자체 재분류한다.** 한 레포의 목차 구조를 그대로 옮기지 않는다.

목표는 주제어 400개다.

### 대분류

네 레포의 최상위 목차를 교차해 만장일치 축을 먼저 확정했다.

| 축 | gyoogle | WeareSoft | ksundong | VSFe |
|---|---|---|---|---|
| 네트워크 | ● | ● | ● | ● |
| 운영체제 | ● | ● | ● | ● |
| 데이터베이스 | ● | ● | ● | ● |
| 자료구조·알고리즘 | ● | ● | ● | ● |
| 언어 | ● | ● | ● | ● |
| 디자인 패턴 | ● | ● | ● | ○ |
| 웹·HTTP | ● | ○ | ● | ● |
| 보안 | ○ | ● | ● | ○ |
| 인프라·DevOps | ○ | ○ | ● | ● |
| Spring (프레임워크) | ○ | ● | ○ | ○ |

이 10축을 아래처럼 접고 프론트엔드·모바일을 더해 **최종 10개**를 만든다.

- 디자인 패턴 → 아키텍처·분산시스템에 흡수
- 웹·HTTP → HTTP·REST는 네트워크로, 웹 보안은 인프라·보안으로, 브라우저·렌더링은 프론트엔드로 분산
- 보안 + 인프라·DevOps → 인프라·보안으로 통합
- Spring → 프레임워크로 일반화 (표에서 1/4이지만 백엔드 면접 실물 빈도가 높아 유지)

최종 대분류다.

1. 네트워크
2. 운영체제
3. 데이터베이스
4. 자료구조 · 알고리즘
5. 언어 · 런타임
6. 프레임워크
7. 아키텍처 · 분산시스템
8. 인프라 · 보안
9. 프론트엔드
10. 모바일

중분류 이하는 **설계하지 않는다.** 시드가 매일 소비되며 가지가 자라고 사용자가 파는 꼬리질문이 잔가지를 채운다. 미리 짜두면 생성 결과와 충돌한다.

### 시드 배분

면접 출제 빈도를 반영해 가중한다. 균등 배분하지 않는다. 아래 수치는 위 4개 레포의 카테고리별 문서 개수 비율을 참고한 **추정치**이며, 실측 근거는 없다. 시드 추출 시 실제 수집량에 맞춰 조정한다.

| 카테고리 | 시드 |
|---|---|
| 데이터베이스 | 55 |
| 네트워크 | 50 |
| 언어 · 런타임 | 50 |
| 운영체제 | 40 |
| 자료구조 · 알고리즘 | 40 |
| 프레임워크 | 40 |
| 아키텍처 · 분산시스템 | 40 |
| 프론트엔드 | 35 |
| 인프라 · 보안 | 30 |
| 모바일 | 20 |
| **합계** | **400** |

하루 하나씩 소비하면 약 13개월치다. 소진 후 정책은 §13 열린 항목.

### 초기 부트스트랩

카테고리가 10개라 하루 1개 발행으로는 모든 탭이 차기까지 오래 걸린다. 첫날부터 빈 탭이 보이면 서비스가 비어 보인다.

오픈 시점에 **카테고리당 3개, 총 30개 루트를 미리 발행한다.**

여기서 생성되는 노드 수를 명확히 한다. **루트 발행 시 만들어지는 것은 루트 `qnode` 1개와 추천 꼬리질문 텍스트 5개다.** 꼬리질문은 아직 노드가 아니다. 사용자가 누를 때 비로소 `qnode`가 생성된다(§6). 따라서 부트스트랩의 생성 비용은 **30 노드**이지 150~250이 아니다.

---

## 5. 데이터 모델

### 원칙 — 개념과 경로의 분리

바닥에 지식 그래프가 하나 깔린다. 노드는 **개념**이고 전역에서 재사용된다.

그 위에 경로가 얹힌다. 경로는 **개인의 것**이고, 같은 개념을 여러 번 다른 맥락에서 지날 수 있다.

이 둘을 섞으면 안 된다. 방문을 노드 참조로만 기록하면 경로가 복원되지 않는다. 전역 간선이 `A→C`와 `B→C`일 때 사용자가 `A→C`를 파고 따로 `B`만 방문하면 방문 집합은 `{A,B,C}`가 된다. 여기서 부분그래프를 유도하면 **가본 적 없는 `B→C`가 화면에 그려진다.**

그래서 방문을 노드가 아니라 **occurrence(경로 상의 발생)** 로 저장한다.

```
qnode ──< qedge >── qnode          전역 지식 그래프 (개념)
  ↑
  │ 참조
  │
journey_occurrence ── journey       개인 경로
tree_occurrence ───── tree          공유 스냅샷
```

### qnode — 개념 노드

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `identity_scope` | text | 의미 범위. 예: `java`, `os`, `postgres`, `generic`. 정규화 오병합 방지용 |
| `normalized_question` | text | 정규화 게이트가 만든 표준 질문 문장 |
| `body` | text | 해설 본문 |
| `primary_category` | text | 최초 생성된 맥락의 대분류 |
| `status` | enum | `pending` \| `ready` \| `failed` |
| `origin` | enum | `batch` \| `on_demand` |
| `created_at` | timestamptz | |

`status`가 `ready`인 노드만 캐시 조회 대상이다. 생성 중 실패한 노드가 조용히 노출되는 것을 막는다.

**`identity_scope`가 정규화 오병합의 유일한 방어선이다.** "락은 언제 해제되는가?"는 Java monitor, OS mutex, DB row lock에서 서로 다른 질문이다. 표면 문장이 같아도 스코프가 다르면 다른 노드다. 정규화 게이트가 스코프를 함께 판정한다(§6).

오병합이 위험한 이유는 되돌릴 수 없기 때문이다. 한 노드를 나중에 둘로 나누려 해도 어느 경로의 발자국을 어느 쪽으로 옮길지 알 방법이 없다. 반대로 잘못 나눈 노드는 나중에 합칠 수 있다. **확신이 없으면 합치지 말고 따로 만든다.**

사용자가 입력한 원문은 여기에 저장하지 않는다. 이름·내부 URL·토큰이 섞여 들어올 수 있고 `qnode`는 전역 공개 데이터다. 원문은 `expansion_event`(비공개)에 남긴다.

### qnode_alias — 정규화 결과 바인딩

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `normalizer_version` | text | 모델명 + 프롬프트 버전 |
| `normalized_hash` | text | SHA-256 of (identity_scope + normalized_question) |
| `qnode_id` | uuid FK | |

유니크: `(normalizer_version, normalized_hash)`

캐시 키를 `qnode` 본체가 아니라 별도 테이블로 뺀다. 정규화 모델이나 프롬프트를 바꾸면 canonical 문장이 흔들리는데, alias를 버전별로 두면 **기존 노드를 잃지 않고 새 정규화기를 얹을 수 있다.** 신규 정규화기는 shadow로 돌려 구·신 alias를 함께 조회하다가 전환한다.

### qnode_suggestion — 추천 꼬리질문

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `qnode_id` | uuid FK | 부모 노드 |
| `text` | text | 추천 질문 문장 |
| `target_node_id` | uuid FK nullable | 이미 생성됐다면 그 노드 |
| `position` | int | 표시 순서 |

추천을 텍스트 배열이 아니라 테이블로 둔다. **이유가 둘이다.**

첫째, `target_node_id`가 채워진 추천은 **정규화 게이트를 거치지 않고 바로 이동한다.** LLM 호출이 0회다. 추천 클릭은 확장의 대부분을 차지하므로 비용이 크게 준다.

둘째, 정규화 게이트가 장애일 때 폴백이 가능하다. 텍스트 배열이면 인접 노드의 ID를 알 수 없어 "캐시된 인접 노드 먼저 보여주기"가 아예 구현되지 않는다.

### qedge — 개념 간 연결

| 필드 | 타입 | 설명 |
|---|---|---|
| `parent_id` | uuid FK | |
| `child_id` | uuid FK | |
| `created_at` | timestamptz | |

유니크 `(parent_id, child_id)`, `CHECK (parent_id <> child_id)`. 양방향 탐색 인덱스.

**전역 그래프는 DAG가 아니라 일반 방향 그래프다.** 순환을 금지하지 않는다.

전역 DAG를 강제하면 간선을 넣을 때마다 도달성 검사가 붙고(최악 `O(V+E)`), 동시 삽입 시 서로의 미커밋 간선을 못 봐서 순환이 완성되는 경합도 생긴다. 얻는 것에 비해 비싸다.

그리고 지식 관계에서는 순환이 자연스럽다. `TCP → 3-way handshake`도 맞고 `3-way handshake → TCP 연결 수립`도 맞다.

**대신 경로에서 막는다.** `journey_occurrence`와 `tree_occurrence`를 만들 때 조상에 이미 있는 `qnode_id`는 자식으로 붙이지 않는다. 사용자에게는 "이미 지나온 질문입니다"로 표시하고 그 지점으로 점프시킨다. 조상 검사는 현재 경로만 훑으므로 깊이에 비례하고, 깊이는 실질적으로 수십을 넘지 않는다.

### journey / journey_occurrence — 개인 경로

```
journey
  id            uuid PK
  user_id       uuid FK
  root_node_id  uuid FK
  title         text            자동 생성 또는 사용자 지정
  created_at    timestamptz
  updated_at    timestamptz
```

```
journey_occurrence
  id                    uuid PK
  journey_id            uuid FK
  qnode_id              uuid FK
  parent_occurrence_id  uuid FK nullable    루트면 null
  position              int
  visited_at            timestamptz
```

인덱스: `(journey_id, parent_occurrence_id)`, `(journey_id, qnode_id)`

이게 "내 트리"의 권위 데이터다. 같은 `qnode`를 다른 맥락에서 두 번 지나면 occurrence가 두 개 생긴다. 부모를 명시적으로 들고 있으므로 **경로가 유일하게 복원된다.**

읽기 뷰의 breadcrumb는 `parent_occurrence_id`를 거슬러 올라가면 나온다. URL도 노드 ID가 아니라 occurrence ID를 쓴다(§7).

### tree / tree_occurrence — 콘텐츠 단위

```
tree
  id            uuid PK
  slug          text UNIQUE
  title         text
  kind          enum          daily | shared
  category      text          게시판 필터용
  seed_id       uuid FK nullable    daily만
  root_node_id  uuid FK
  author_id     uuid FK nullable    daily는 null
  summary       text          AI 생성 요약
  upvotes       int
  views         int
  published_at  timestamptz
```

```
tree_occurrence
  id                    uuid PK
  tree_id               uuid FK
  qnode_id              uuid FK
  parent_occurrence_id  uuid FK nullable
  position              int
```

인덱스: `tree(upvotes DESC)`, `tree(published_at DESC)`, `tree(category, published_at DESC)`

**`node_ids` 배열을 쓰지 않는다.** 배열은 스냅샷이 아니다. 공유한 뒤 그 안의 두 노드 사이에 새 `qedge`가 생기면 과거 공유 트리의 모양이 저절로 바뀐다. 살아있는 유도 부분그래프이지 스냅샷이 아니다. 배열 원소에는 외래키도 걸리지 않아 삭제된 노드 ID가 남는다.

`tree_occurrence`가 공유 시점의 구조를 그대로 박제한다.

`category`는 `daily`면 시드의 카테고리, `shared`면 루트 노드의 `primary_category`를 상속한다.

### expansion_event — 비공개 원문 기록

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid nullable | 비로그인은 null |
| `parent_qnode_id` | uuid FK | |
| `raw_input` | text | 사용자가 친 원문 |
| `verdict` | enum | `accepted` \| `rejected` \| `error` |
| `resulting_qnode_id` | uuid nullable | |
| `created_at` | timestamptz | |

사용자 원문을 전역 공개 테이블에서 격리한다. 어뷰즈 추적과 정규화 품질 분석에도 쓴다.

### generation_job — single-flight

| 필드 | 타입 | 설명 |
|---|---|---|
| `normalized_hash` | text PK | |
| `status` | enum | `running` \| `done` \| `failed` |
| `lease_until` | timestamptz | 타임아웃 회수용 |
| `qnode_id` | uuid nullable | 완료 시 |

같은 질문을 두 사람이 동시에 파면 **LLM 호출이 두 번 나가고 한쪽은 삽입에 실패한다.** 유일키는 중복 행만 막지 중복 비용은 못 막는다.

먼저 도착한 요청만 `running`으로 잡고 생성한다. 나머지는 같은 작업의 완료를 기다린다. 리스가 만료되면 회수한다.

### topic_seed

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | |
| `term` | text | 주제어 |
| `category` | text | |
| `consumed_at` | timestamptz nullable | |

### usage_quota

| 필드 | 타입 | 설명 |
|---|---|---|
| `key` | text | 비로그인 `ip:cookie`, 로그인 `user:{uuid}` |
| `date` | date | KST 자정 리셋 |
| `used` | int | 확정 사용 |
| `reserved` | int | 생성 중 예약 |

PK `(key, date)`

`used`와 `reserved`를 나눈다. LLM 호출 전에 `reserved`를 올리고, 성공하면 `used`로 옮기고, 실패하면 되돌린다. 호출 전에 차감하면 실패 시 환불 경쟁이 생기고, 호출 후에 차감하면 한도 초과 비용이 먼저 발생한다.

증감은 반드시 **단일 DB 함수에서 원자적으로** 한다. 애플리케이션에서 읽고 쓰면 동시 요청 시 카운터가 샌다.

---

## 6. 확장 흐름

### 추천 클릭 — LLM 0회

`qnode_suggestion.target_node_id`가 채워져 있으면 **정규화도 생성도 없다.** occurrence만 만들고 이동한다. 할당량도 차감하지 않는다.

이 경로가 전체 확장의 대부분을 차지한다.

### 미해소 추천 또는 자유 입력

```
① 입력           미해소 추천 클릭 또는 자유 질문 입력
       ↓
② 입력 검증      길이·토큰·제어문자·zero-width 제한. LLM 호출 전에 건다
       ↓
③ 정규화 게이트  Flash-Lite — 연관성 판정 + identity_scope 판정 + 표준 문장화
       ↓         구조화 출력 강제. 무관·위험 입력은 여기서 거절
④ 캐시 조회      qnode_alias(normalizer_version, hash) → qnode(status=ready)
       ↓
   ┌───┴──────────────────────────────┐
 히트                                미스
 생성 LLM 0회                        generation_job 선점
 quota 미차감                        → 선점 실패면 완료 대기
 qedge 없으면 추가                   → 성공이면 Flash가 해설 + 추천 5개 생성
   └───┬──────────────────────────────┘
       ↓
⑤ 원자적 확정   qnode(ready) · qedge · qnode_suggestion · occurrence · quota
                를 하나의 DB 함수에서 커밋. LLM 호출은 트랜잭션 밖
       ↓
⑥ 경로 기록     로그인이면 journey_occurrence 생성. 비로그인은 클라이언트 상태만
```

**캐시 히트에도 `qedge`는 추가한다.** 새 부모에서 기존 노드로 처음 닿았다면 그 관계가 저장되어야 한다. 전역 그래프가 DAG가 아니므로 순환 검사가 필요 없고, 조상 중복은 occurrence를 만들 때 막는다.

**히트라도 정규화 게이트는 호출된다.** 자유 입력은 정규화를 거쳐야 해시가 나오기 때문이다. "히트는 LLM 0회"가 아니라 **"히트는 생성 LLM 0회"**가 정확하다. 그래서 비용 계산과 어뷰즈 방어를 할당량이 아니라 요청 빈도로 따로 건다(§8).

### 멱등성

요청마다 `idempotency_key`를 받는다. 재시도가 중복 생성이나 중복 차감을 만들지 않게 한다.

### 실패 경로

| 실패 지점 | 처리 |
|---|---|
| 입력 검증 | 400. LLM 호출 없음 |
| 정규화 게이트 거절 | 422 + 사유. `expansion_event.verdict = rejected` |
| 정규화 게이트 장애 | 503. `target_node_id`가 있는 추천만 노출하는 축소 모드 |
| 생성 LLM 타임아웃 | `qnode.status = failed`, quota 반환, 재시도 안내 |
| RPM 한도 | 429 + 재시도 시각. 큐에 넣되 대기 시간을 정직하게 표시 |
| 조상 중복 | 정상 응답. 해당 조상 occurrence로 점프 |

정규화 게이트 장애 시 "캐시된 인접 노드를 먼저 보여준다"는 완화책은 `qnode_suggestion.target_node_id`가 있어야 성립한다. 텍스트만 있으면 인접 노드가 무엇인지 알 방법이 없다.

---

## 7. 화면

### 홈

오늘의 질문이 주인공이다. 히어로 카드로 크게 놓고 아래에 트리 게시판을 둔다.

**로그인 사용자는 히어로 위에 "이어서 파기"가 붙는다.** 마지막으로 방문한 occurrence와 그 지점의 미니맵 요약이다. 이 서비스에서 가장 강한 재방문 자산은 개인 축적인데, 그걸 홈에서 안 보여주면 매일 올 이유가 카톡방과 다르지 않다.

게시판 탭은 인기 / 최신 / 카테고리 10개다. 탭이 많아 모바일에서는 가로 스크롤로 처리한다.

### 읽기 뷰

모바일이 기준이다. 카톡 링크를 타고 들어오니 첫 방문은 대부분 폰이다.

들여쓰기 트리는 쓰지 않는다. 무한 확장과 정면으로 충돌한다. 깊이 5단이면 질문 한 줄이 세로로 접힌다.

대신 **한 번에 질문 하나**를 전체 폭으로 보여준다. 깊이는 상단 경로 칩이 표현하고 칩을 누르면 그 지점으로 점프한다. 뒤로 스와이프로 부모에 돌아간다.

**하단에 미니맵 스트립을 상시 고정한다.** 이게 통증 해결의 핵심이다. 포커스 뷰만 있으면 결국 선형이라 카톡과 구조적으로 같은 계열이 된다. 관계가 보인다는 것이 매 화면에서 체감되어야 한다. 확장 직후 미니맵에 새 노드가 붙는 것을 잠깐 보여주고 읽기로 돌아온다.

구성은 위에서부터 경로 칩, 질문, 해설, 추천 꼬리 5개, 자유 입력란, 미니맵 스트립이다.

### 지도 모드

미니맵을 누르면 전체화면 캔버스가 열린다. 조망하고 원하는 노드로 점프한 뒤 읽기로 돌아온다.

별도 페이지가 아니라 모달이다. 읽던 자리를 잃지 않아야 한다.

노드 수가 많아지면 React Flow 렌더가 무너진다. **표시 상한을 200 노드로 두고** 현재 위치 기준 반경으로 컬링한다. 상한 초과 시 "전체 보기" 대신 카테고리별 접기를 제공한다.

데스크톱은 읽기와 지도를 나란히 놓는다. 렌더러는 한 벌이다.

### 상태 정의

| 상태 | 읽기 뷰 | 게시판 | 지도 |
|---|---|---|---|
| 로딩 | 해설은 스트리밍, 추천 꼬리는 완료 후 일괄 표시 | 스켈레톤 카드 3장 | 스피너 |
| 생성 중 | 질문은 즉시, 해설 자리에 진행 표시. 예상 대기 시각 노출 | — | 새 노드 자리에 placeholder |
| 빈 상태 | — | "아직 공유된 트리가 없습니다" + 오늘의 질문 유도 | 루트만 표시 |
| 할당량 초과 | 자유 입력란 비활성 + 로그인 유도. 해소된 추천은 계속 가능 | 정상 | 정상 |
| 정규화 거절 | 입력란 아래 사유 표시. 입력은 보존 | — | — |
| RPM 한도 | 재시도 가능 시각 표시 | 정상 | 정상 |
| 오류 | 재시도 버튼. 경로는 유지 | 재시도 | 읽기로 복귀 |

**생성 대기가 이 서비스의 체감 품질을 좌우한다.** LLM 생성은 수 초 걸린다. 해설을 스트리밍으로 흘리면 대기가 읽기 시간으로 바뀐다.

### 라우팅

| 경로 | 설명 |
|---|---|
| `/` | 오늘의 질문 + 이어서 파기 + 게시판 |
| `/j/[occurrenceId]` | 읽기 뷰. 경로 문맥 포함 |
| `/q/[nodeId]` | 문맥 없는 단일 노드 보기. 공개 캐시 대상 |
| `/t/[slug]` | 트리 상세 |
| `/me` | 내 여정 목록. journey별 제목·노드 수·마지막 방문 |

**읽기 뷰 URL이 occurrence ID인 것이 중요하다.** 노드 ID만으로는 어느 부모에서 왔는지 알 수 없어 새로고침이나 직접 진입 시 breadcrumb가 사라진다.

`/q/[nodeId]`는 문맥 없는 공개 보기로 한정한다. 개인 경로가 섞이지 않으므로 URL 기준 공유 캐시를 걸 수 있다.

### 비로그인에서 로그인으로

비로그인 사용자의 경로는 클라이언트 상태로만 존재한다. **로그인 직후 그 경로를 `journey`와 `journey_occurrence`로 flush한다.**

체험 5회를 다 쓰고 로그인하는 순간이 전환 지점이다. 여기서 파던 게 날아가면 전환 지점이 곧 이탈 지점이 된다.

---

## 8. 인증과 비용 방어

### 할당량

| | 확장 (생성 발생) | 자유 입력 요청 | 저장 |
|---|---|---|---|
| 비로그인 | 하루 5회 | 분당 3회 / 하루 20회 | 안 됨 |
| 로그인 | 하루 50회 | 분당 10회 / 하루 100회 | journey에 기록 |

**두 축으로 나눈 것이 핵심이다.**

해소된 추천 클릭은 LLM을 전혀 태우지 않으므로 아무것도 차감하지 않는다. 캐시 히트는 생성을 안 하므로 확장 횟수를 차감하지 않는다.

하지만 **캐시 히트에도 정규화 게이트는 호출된다.** 그래서 확장 횟수와 별개로 **요청 빈도 자체에 제한을 건다.** 이게 없으면 히트만 반복 조회하는 스크래퍼가 사용자 할당량을 하나도 안 쓰면서 전역 LLM 예산을 고갈시킬 수 있다.

전역 서킷 브레이커도 둔다. 모델별 일일 사용량이 한도의 80%에 닿으면 자유 입력을 차단하고 해소된 추천만 허용한다.

로그인은 Supabase Auth Google OAuth를 쓴다.

### 모델 티어링

Gemini 무료 티어를 쓴다.

| 용도 | 모델 ID |
|---|---|
| 정규화 게이트 | `gemini-3.1-flash-lite` |
| 해설 + 추천 생성 | `gemini-3.6-flash` |
| 매일 루트 질문 | `gemini-3.5-flash` |
| 트리 요약 | `gemini-3.1-flash-lite` |

**Gemini 2.5 계열은 쓰지 않는다.** 2026년 10월 종료 예정이다.

매일 루트 질문에 Pro를 쓰려 했으나 `gemini-3.1-pro-preview`가 preview뿐이다. **cron이 preview 모델에 의존하면 안 되므로** GA인 `gemini-3.5-flash`로 간다. Pro가 GA가 되면 그때 올린다.

### 약관 리스크

무료 티어는 **입출력이 모델 학습에 사용된다.** 약관이 명시한다.

> "Do not submit sensitive, confidential, or personal information to the Unpaid Services."

이 서비스는 익명 사용자가 자유 텍스트를 입력한다. 무엇을 넣을지 통제할 수 없다.

**대응은 고지다.** 자유 입력란에 입력이 AI 학습에 사용될 수 있음을 명시하고 개인정보 입력을 자제하도록 안내한다. 입력 검증(§6 ②)에서 이메일·전화번호 패턴을 걸러 경고한다.

같은 약관에 아래 문장도 있다.

> "Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use."

이 문장은 통상 AI Studio를 개인 챗봇처럼 쓰지 말라는 뜻으로 읽히고 Google은 API로 앱을 만들도록 홍보한다. 다만 해석 여지가 있으므로 **사용자 규모가 커지면 유료 티어로 전환한다.** 유료는 학습 미사용이라 위 고지 문제도 함께 해소된다.

### 한도 계산

**모델별로 버킷이 다르다.** 합산해서 비교하면 안 된다.

공식 문서가 한도 표를 내리고 AI Studio 콘솔로 안내하므로 **정확한 수치는 콘솔에서 직접 확인해야 한다.** 아래는 구조만 보여주는 계산이다.

일 사용자 100명, 1인당 확장 5회 기준이다.

| 시나리오 | 정규화 (Flash-Lite) | 생성 (Flash) | Daily (Pro) |
|---|---:|---:|---:|
| 자유 입력 비중 50%, miss 30% | 250 | 75 | 1 |
| 자유 입력 비중 50%, miss 100% (콜드) | 250 | 250 | 1 |
| 로그인 100명이 할당량 전부 소진, miss 100% | 5,000 | 5,000 | 1 |

세 번째 행이 진짜 상한이다. **캐시 히트가 할당량을 안 깎으므로 시스템 총 호출량은 사용자 할당량으로 제한되지 않는다.** 요청 빈도 제한과 서킷 브레이커가 실질적 상한을 만든다.

RPM도 따로 본다. 15 RPM 버킷에 500건이 몰리면 **큐를 써도 33분이 걸린다.** 큐는 대기를 정직하게 만들 뿐 처리량을 늘리지 않는다. 저녁 시간대 동시 접속이 예상되면 유료 전환이 답이다.

"몇 명부터 유료 전환"은 DAU가 아니라 **실측 miss율과 자유 입력 비중**으로 판단한다. 오픈 후 2주 실측 전까지는 추정치를 신뢰하지 않는다.

---

## 9. API 계약

### POST /api/expand

```jsonc
// 요청
{
  "idempotency_key": "uuid",
  "parent_occurrence_id": "uuid | null",   // 로그인 시. null이면 새 journey 시작
  "parent_node_id": "uuid",
  "ancestor_node_ids": ["uuid"],           // 비로그인 시 조상 중복 검사용
  "mode": "suggestion" | "free",
  "suggestion_id": "uuid",                 // mode=suggestion
  "raw_input": "string"                    // mode=free, 최대 300자
}
```

`ancestor_node_ids`가 필요한 이유가 있다. 비로그인 사용자의 경로는 서버에 없고 클라이언트 상태로만 존재한다. 조상 중복을 서버가 판정하려면 경로를 함께 받아야 한다. 로그인 상태면 `parent_occurrence_id`로 서버가 직접 거슬러 올라가고 이 필드는 무시한다.

```jsonc
// 200
{
  "occurrence_id": "uuid",
  "node": {
    "id": "uuid",
    "question": "string",
    "body": "string",
    "identity_scope": "string",
    "suggestions": [
      { "id": "uuid", "text": "string", "resolved": true }
    ]
  },
  "cache": "hit" | "miss" | "suggestion_resolved",
  "quota": { "used": 12, "limit": 50 },
  "ancestor_jump": null   // 조상 중복이면 해당 occurrence_id
}
```

| 코드 | 상황 | 응답 |
|---|---|---|
| 400 | 입력 검증 실패 | `{ error: "invalid_input", detail }` |
| 401 | 저장 요구 작업에 비로그인 | `{ error: "auth_required" }` |
| 422 | 정규화 게이트 거절 | `{ error: "irrelevant", reason }` |
| 429 | 할당량 또는 RPM 초과 | `{ error: "quota_exceeded" \| "rate_limited", retry_after }` |
| 503 | 정규화 게이트 장애 | `{ error: "gate_unavailable", fallback_suggestions: [...] }` |
| 504 | 생성 타임아웃 | `{ error: "generation_timeout" }` |

`202`는 쓰지 않는다. 생성은 스트리밍 응답으로 처리해 대기가 읽기 시간이 되게 한다.

### 나머지

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/node/[id]` | 공개 노드. 개인 필드 없음. 공개 캐시 |
| `GET /api/journey/[id]` | 내 경로. `private, no-store` |
| `GET /api/daily` | 오늘의 질문 |
| `GET /api/trees?sort=&category=&cursor=` | 게시판. 커서 페이지네이션 |
| `POST /api/share` | journey → tree 스냅샷 |
| `POST /api/publish-daily` | GitHub Actions 호출. `CRON_SECRET` 헤더 |

---

## 10. 보안

### Prompt injection

자유 입력이 전역 자산이 되므로 오염이 증폭된다. 공격자가 유도한 canonical 질문 하나가 모든 사용자에게 영구히 남는다.

- LLM 호출 전 길이·토큰·제어문자·zero-width 제한
- 정규화 게이트는 **구조화 출력 강제**. 자유 서술 금지
- 연관성·안전성·품질을 별도 판정으로 분리. 연관성 통과가 안전성 통과가 아니다
- 신규 노드는 `pending`으로 시작. 검증 후 `ready`
- 생성된 Markdown·URL 정화. HTML 미허용
- 사용자 원문은 `expansion_event`(비공개)에만

구조화 출력만으로 injection이 해결되지 않는다는 점을 전제한다.

### RLS 경계

| 테이블 | 정책 |
|---|---|
| `qnode`, `qedge`, `qnode_suggestion` | `status=ready`만 공개 읽기. 쓰기는 서버 전용 |
| `journey`, `journey_occurrence` | `auth.uid() = user_id` |
| `expansion_event` | 서버 전용. 클라이언트 접근 없음 |
| `usage_quota` | 클라이언트 직접 변경 금지. 원자적 서버 함수만 |
| `tree`, `tree_occurrence` | published만 공개 읽기. `kind=shared`만 사용자 생성 |
| `tree.kind`, `author_id`, 카운터 | 사용자 수정 금지 |

서버가 service role을 쓰면 RLS를 우회한다. 따라서 `/api/*`는 **요청 body의 `user_id`를 절대 신뢰하지 않는다.** 검증된 세션에서 UID를 도출한다.

### 캐시 경계

| 대상 | 캐시 |
|---|---|
| `qnode`, `qedge`, published tree | 공개 캐시 가능 |
| journey, quota, 개인 상태 | `private, no-store` |

공개 노드와 개인 경로를 같은 응답에 결합하지 않는다. 개인 오버레이는 별도 API나 동적 Server Component로 분리한다.

테스트에 **교차 계정 캐시 검사**를 넣는다. A로 캐시를 데운 뒤 B와 익명으로 같은 URL을 열어 개인 데이터가 새지 않는지 확인한다.

---

## 11. 기술 스택과 배포

Next.js 16 App Router + React 19 + Tailwind v4 + Supabase(Postgres/Auth) + **Vercel Hobby**. 기존 프로젝트 관례를 그대로 따른다.

### 데이터 접근 계층

서버 코드는 Supabase 클라이언트가 아니라 **raw SQL**을 쓴다. service role로 도는 서버에서는 RLS 우회가 기본이라 클라이언트 SDK의 이점이 없고, plpgsql 함수 호출과 다중 문장 실행이 직접적이다.

개발과 테스트는 **PGlite**(Postgres를 WASM으로 컴파일한 것)로 돈다. Docker 없이 실제 Postgres 의미론이 그대로 재현되므로 plpgsql 함수까지 테스트된다. 배포 환경에서는 같은 `Db` 인터페이스 뒤에 실제 Postgres 어댑터를 끼운다.

한계를 분명히 해둔다. **PGlite는 단일 연결이라 진짜 동시성이 재현되지 않는다.** `for update` 행 잠금과 `on conflict` 경합은 실제 Postgres에서 별도로 검증해야 한다. 현재 통과한 동시성 테스트는 순차 호출 기준의 정합성만 증명한다.

Hobby는 비상업 개인 이용 한정이다. 광고·후원·결제를 붙이는 순간 저촉되고, ksundong 레포의 CC BY-NC 조건도 함께 깨진다(§4). 수익화는 두 제약을 동시에 건드린다.

지도 모드 캔버스는 React Flow를 쓴다.

### 매일 발행

GitHub Actions가 `POST /api/publish-daily`를 호출한다.

발행은 **`publish_date`에 유니크를 건다.** HTTP 응답만 유실돼도 재시도가 daily 트리를 중복 생성할 수 있다. 시드 선택과 `consumed_at` 갱신은 하나의 트랜잭션에서 처리한다.

Supabase 무료 티어는 7일 무활동 시 프로젝트가 일시정지된다. 매일 배치가 이를 자연히 막는다.

---

## 12. 테스트

### 정규화 게이트 — 최우선

캐시 효율 전체가 여기 달렸다. 골든 케이스로 고정하고 **합격 기준을 수치로 둔다.**

| 항목 | 기준 |
|---|---|
| 동의 표현 수렴률 | 같은 의미 질문 20쌍 중 18쌍 이상이 같은 해시 |
| 이의 표현 분리율 | `identity_scope`가 다른 질문 10쌍 전부 다른 노드 |
| 무관 입력 거절률 | 거절 케이스 20건 중 19건 이상 |
| 반복 실행 안정성 | 같은 입력 5회 반복 시 canonical 문장 동일 |

마지막 항목이 특히 중요하다. 흔들리면 캐시가 조용히 갈라진다.

### 그 외

- 추천 클릭 경로에서 LLM 호출 0회 확인
- 동시 확장 2건에서 생성 LLM 호출이 1회인지 (single-flight)
- 할당량 동시 요청 시 카운터 정확성
- 조상 중복 시 점프 응답
- 비로그인 → 로그인 시 경로 flush
- 교차 계정 캐시 누출 검사
- 정규화 게이트 장애 시 축소 모드 동작
- E2E — 오늘의 질문 → 파기 → 공유 → 익명으로 공유 링크 열기

---

## 13. 열린 항목

| # | 항목 | 우선순위 |
|---|---|---|
| 1 | **Gemini 실제 RPM/RPD를 AI Studio 콘솔에서 확인.** 공식 문서에 표가 없다. §8 계산의 전제 | 높음 |
| 2 | 서비스명과 도메인 | 높음 |
| 3 | ~~`identity_scope` 값 집합 정의~~ → 확정. 22개 열거형 (`src/lib/expand/scopes.ts`) | 완료 |
| 4 | 시드 400개 소진(약 13개월) 후 발행 정책. 시드 재사용 / LLM 자동 생성 / 인기 노드 승격 | 중간 |
| 5 | DopplerHQ 레포 라이선스 확인 (CC0 추정, 미확인) | 중간 |
| 6 | 꼬꼬면 인터뷰 플로우 직접 확인. 차별점 서술의 근거 | 중간 |
| 7 | OG 이미지 생성 방식 (`@vercel/og` 동적 vs 정적) | 중간 |
| 8 | `tree.slug` 생성 규칙 | 낮음 |
| 9 | 매일 발행 시각 | 낮음 |
| 10 | 게시판 카드 표시 항목 | 낮음 |

---

## 부록 A. 기존 서비스와의 차이

가장 가까운 것은 **꼬꼬면**(kokomen.kr)이다. 이름부터 꼬리질문이고 CS·인프라 등 분야도 겹친다.

다만 성격이 반대에 가깝다. 꼬꼬면은 AI가 `Q1 → Q2 → Q3` 순서를 정하고 사용자는 답을 하며, 끝나면 총점과 종합 평가가 나온다. 트리나 그래프 시각화는 없다.

| | 꼬꼬면 | 이 서비스 |
|---|---|---|
| 구조 | 선형 (AI가 순서 결정) | 분기 그래프 (사용자가 방향 선택) |
| 목적 | 답변 연습과 채점 | 지식 지도 탐험 |
| 축적 | 개인 면접 기록 | 전역 지식 그래프 |

꼬꼬면 결과 페이지에서 가져올 것도 있다. 공유 페이지 상단의 AI 요약(`tree.summary`)이 그것이다. 노드별 답변·피드백·등급은 2차로 미뤘다.

이 비교는 웹페이지 기준 간접 확인이다. 실제 인터뷰 플로우는 미확인이다(§13 #6).

## 부록 B. Streamlit 배제 검토

지도 모드 자체는 `streamlit-flow`(React Flow 래퍼)로 가능하다. 두 가지가 막힌다.

첫째, **OG 메타태그를 넣을 수 없다.** 카톡에 링크를 붙여도 제목·설명·썸네일이 뜨지 않는다. 카톡방에서 출발한 서비스이고 공유가 핵심 기능이라 치명적이다. (streamlit/streamlit#853, 2019년부터 미해결)

둘째, **아이템별 동적 페이지가 불가능하다.** `/t/[slug]` 공유 링크와 `/j/[occurrenceId]` 읽기 뷰가 설계의 축인데 성립하지 않는다.

여기에 rerun 모델이 얹힌다. 인터랙션마다 스크립트 전체가 다시 돌아 무한 확장 UX에서 지연이 체감된다.

## 부록 C. debate 이력 (2026-08-05)

3인 교차검증(Critic/Sonnet · doc-reviewer/Opus · Codex/GPT-5). 전원 CONDITIONAL PASS.

중심 판단 셋은 전원이 견고하다고 판정했다 — 그래프 저장/트리 렌더 분리, 부모 무관 노드 재사용, `tree` 단일 테이블 통합.

초판에서 뒤집힌 것이다.

| 초판 | 개정 | 지적자 |
|---|---|---|
| `user_path(user_id, qnode_id)` | journey + occurrence 모델 | 전원 |
| `tree.node_ids` 배열 | `tree_occurrence` | doc-reviewer, Codex |
| 전역 DAG + 순환 검사 | 일반 방향 그래프. 경로에서만 조상 중복 금지 | Codex |
| `normalized_hash` 단독 유일키 | `identity_scope` 추가 + `qnode_alias` 버전 관리 | Codex |
| `suggestions` 텍스트 배열 | `qnode_suggestion` 테이블 + `target_node_id` | Codex |
| 캐시 히트 = LLM 0회 | 히트 = 생성 LLM 0회. 정규화는 호출됨 | Critic, Codex |
| 700회 단일 합산 | 모델별 버킷 분리 + 상한 시나리오 | Critic, Codex |
| ksundong 라이선스 "없음" | CC BY-NC 2.0 KR | Critic |
| `tree`에 category 없음 | 추가 | doc-reviewer |
| 답변 기록 1차 | 2차 | Critic, doc-reviewer |
| 지도 모드 = 모달 버튼 | 미니맵 상시 노출로 승격 | doc-reviewer |
| 홈에 개인 축적 없음 | "이어서 파기" 추가 | doc-reviewer |
| single-flight 없음 | `generation_job` | Codex |
| RLS·캐시 경계 미정 | §10 신설 | Codex |
