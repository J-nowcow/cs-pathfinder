# 계획 2 — 읽기 UI와 지도 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 계획 1의 헤드리스 확장 엔진 위에 사람이 쓰는 화면을 얹는다. 질문 하나를 전체 폭으로 읽고 추천을 눌러 파고들며, 파고든 관계가 매 화면 하단 미니맵에 보인다.

**Architecture:** 서버 컴포넌트가 공개 노드만 렌더하고 개인 경로는 클라이언트 상태로 얹는다. 경로는 설계 §5의 occurrence 모델을 클라이언트에서 그대로 재현한다. 미니맵과 지도 모드는 같은 레이아웃 함수를 공유하고 렌더러만 다르다.

**Tech Stack:** Next.js 16 App Router · React 19 · Tailwind v4 · React Flow(`@xyflow/react`) · Vitest

**Spec:** `docs/superpowers/specs/2026-08-05-cs-question-tree-design.md` §7 (화면), §5 (데이터 모델), §9 (API 계약)

---

---

## 실행 결과 (2026-08-05 완료)

Task 1~11을 실행했다. Task 12(브라우저 E2E)는 자동 스크립트 대신 claude-in-chrome으로 수동 검증했다.

| 항목 | 결과 |
|---|---|
| 테스트 | 191개 통과 (기존 90 + 신규 101) |
| 타입체크 | 통과 |
| 프로덕션 빌드 | 통과 |
| 브라우저 검증 | 홈 → 진입 → 추천 확장 → 자유 입력 → 분기 → 지도 모드 → 새로고침 유지 |

### 계획과 다르게 간 것

**1. PGlite 인스턴스를 `globalThis`에 고정했다.**

계획은 `src/lib/db/client.ts`를 수정하지 않기로 했으나 dev HMR에서 모듈이 갈아끼워질 때마다
인메모리 DB가 통째로 새로 생겨 파던 노드가 사라지고 열어둔 URL이 404가 됐다. 코드 한 줄
고칠 때마다 이러면 화면 작업 자체가 불가능하다. 테스트 191개는 그대로 통과하고 오히려
파일 간 인스턴스가 공유돼 실행 시간이 3.2초에서 1.4초로 줄었다.

**2. `serverExternalPackages`에 PGlite를 넣었다.**

번들되면 WASM 경로가 깨져 서버 컴포넌트에서만 `path argument ... Received an instance of URL`이
난다. API route(node 조건)에서는 통과해 원인이 잘 보이지 않는다.

**3. 스크롤 복원을 핸들러가 아니라 effect에서 한다.**

핸들러 안에서 `scrollTo`를 부르면 리렌더로 문서 높이가 바뀌며 브라우저가 스크롤을 되돌린다.

**4. 429 배너에서 사용량 숫자를 뺐다.**

서버가 429 응답에 수치를 싣지 않아 `0/0`이 찍혔다. 없는 숫자를 지어내지 않는다.

### 미구현

- **데스크톱 읽기·지도 2단 배치** (설계 §7). 현재는 폭 무관 단일 컬럼 + 하단 미니맵이다
- **해설 스트리밍**. 위 "설계 문서와 다르게 가는 것" 2번 참조
- **컴포넌트 렌더 테스트**. 로직은 테스트가 있으나 화면은 수동 검증만 했다

### 알려진 문제

- Next.js dev가 콘솔에 `Failed to execute 'measure' on 'Performance'` 예외를 한 번 뱉는다.
  `react-server-dom-turbopack`의 성능 계측 코드이고 앱 코드가 아니다. 프로덕션 빌드에는 없다
- `docs/brand.md`(다른 작업에서 확정)의 서비스명 `cs-pathfinder`와 히어로 카피, 종결어미 원칙이
  현재 화면 문구에 반영되지 않았다. 범위 밖이라 손대지 않았다

---

## 설계 문서와 다르게 가는 것

셋이다. 이유가 각각 있다.

**1. 읽기 뷰 URL이 `/j/[occurrenceId]`가 아니라 `/q/[nodeId]`다.**

설계 §7은 읽기 뷰 URL을 occurrence ID로 잡았다. 그 근거는 "노드 ID만으로는 어느 부모에서 왔는지 알 수 없다"는 것이고 옳다. 다만 occurrence는 로그인 사용자의 서버 데이터다. 계획 2는 익명 전용이라 서버에 occurrence가 없다.

그래서 주소는 `/q/[nodeId]`로 두고 경로 문맥은 `sessionStorage`에 유지한다. 서버는 공개 노드만 렌더하고 클라이언트가 경로 칩과 미니맵을 얹는다. 개인 데이터가 서버 응답에 섞이지 않으므로 §10 캐시 경계는 지켜진다.

계획 3에서 인증이 붙으면 `/j/[occurrenceId]`를 추가하고 `/q/[nodeId]`는 설계대로 문맥 없는 공개 보기로 남는다.

**2. 해설 스트리밍을 하지 않는다.**

설계 §7은 "해설은 스트리밍"이다. 근거는 "생성 대기가 체감 품질을 좌우한다"이고 옳다. 다만 계획 1의 `POST /api/expand`는 JSON 통짜 응답이다. 스트리밍으로 바꾸려면 `expand()` 오케스트레이션을 뜯어야 하고, 그 함수는 통과 중인 테스트 90개의 중심이다.

계획 2는 "생성 중" 진행 표시로 대체한다. 스트리밍은 별도 작업으로 남긴다.

**3. 홈의 히어로가 "오늘의 질문"이 아니라 예시 루트 목록이다.**

매일 발행은 계획 3이다. 지금 발행할 오늘의 질문이 없다. `data/example-nodes.ts`의 루트 8개를 카테고리별로 보여주고, 히어로 자리에는 그중 첫 노드를 놓는다.

---

## Global Constraints

- **계획 1의 테스트 90개와 타입체크를 깨지 않는다.** `src/lib/expand/*`, `src/lib/llm/gate.ts`, `src/lib/llm/generate.ts`, `supabase/migrations/*`는 수정하지 않는다
- `src/app/api/expand/route.ts`는 caller 주입 한 줄만 바꾼다
- 들여쓰기 트리를 쓰지 않는다. 깊이는 상단 경로 칩이 표현한다
- 미니맵은 읽기 뷰 하단에 **상시 고정**한다. 접거나 숨기는 옵션을 두지 않는다
- 지도 모드는 모달이다. 별도 페이지가 아니다
- 지도 표시 상한 200 노드
- 개인 경로는 서버 응답에 절대 섞지 않는다
- 주석과 문서는 한국어. 짧은 문장. "왜"를 쓴다
- `git push` 금지. 로컬 커밋만

---

## File Structure

| 파일 | 책임 |
|---|---|
| `postcss.config.mjs` | Tailwind v4 PostCSS 플러그인 |
| `src/app/globals.css` | Tailwind 진입 + 디자인 토큰 |
| `src/app/layout.tsx` | 루트 레이아웃 |
| `src/app/page.tsx` | 홈. 루트 목록 |
| `src/app/q/[nodeId]/page.tsx` | 읽기 뷰 서버 셸 |
| `src/app/api/node/[id]/route.ts` | 공개 노드 조회 |
| `src/app/api/roots/route.ts` | 루트 목록 조회 |
| `src/lib/db/uuid.ts` | 결정론적 UUID 파생 |
| `src/lib/db/bootstrap.ts` | 부팅 시 1회 시드 |
| `src/lib/db/roots.ts` | 루트 노드 목록 질의 |
| `src/lib/llm/dev-stub.ts` | API 키 없을 때 쓰는 결정론적 가짜 caller |
| `src/lib/llm/resolve.ts` | 키 유무로 caller 선택 |
| `src/lib/journey/types.ts` | Occurrence · JourneyState |
| `src/lib/journey/path.ts` | 경로 상태 연산 |
| `src/lib/journey/graph.ts` | 트리 레이아웃 · 컬링 |
| `src/lib/journey/storage.ts` | sessionStorage 직렬화 |
| `src/lib/api/expand-client.ts` | 확장 호출 + 에러 코드 매핑 |
| `src/components/ReadingView.tsx` | 읽기 뷰 클라이언트 셸 |
| `src/components/PathChips.tsx` | 상단 경로 칩 |
| `src/components/Suggestions.tsx` | 추천 꼬리 5개 |
| `src/components/FreeInput.tsx` | 자유 입력란 |
| `src/components/MinimapStrip.tsx` | 하단 미니맵 (SVG) |
| `src/components/MapModal.tsx` | 지도 모드 (React Flow) |
| `src/components/Banners.tsx` | 상태 배너 |

---

## Task 1: Tailwind 설정과 레이아웃 뼈대

Tailwind가 설치만 되고 설정이 없다. 이걸 먼저 세우지 않으면 이후 모든 화면이 스타일 없이 나온다.

**Files:**

- Create: `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`
- Modify: `vitest.config.ts` (테스트 include에 `.tsx` 추가하지 않음 — 렌더 테스트를 강제하지 않으므로)

- [ ] **Step 1: `postcss.config.mjs` 생성**

Tailwind v4는 `tailwind.config.js`가 필요 없다. PostCSS 플러그인만 등록한다.

- [ ] **Step 2: `src/app/globals.css` 생성**

`@import "tailwindcss";` + 디자인 토큰(색·간격). 읽기 화면이 본체이므로 본문 가독성 기준으로 잡는다.

- [ ] **Step 3: `src/app/layout.tsx` 생성**

`lang="ko"`, 메타데이터, `globals.css` 임포트.

- [ ] **Step 4: 빌드 확인**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```
chore: Tailwind v4 설정과 루트 레이아웃

Tailwind가 설치만 되고 설정 파일이 없어 화면 작업의 전제가 빠져 있었다.
v4는 config 파일 없이 PostCSS 플러그인과 CSS 진입점만으로 돈다.
```

---

## Task 2: 결정론적 UUID와 부팅 시드

PGlite가 인메모리라 dev 서버를 켤 때마다 DB가 빈다. 부팅 시 자동 시드가 필요하다.

여기서 ID가 매번 바뀌면 열어둔 URL이 전부 죽는다. 그래서 질문 텍스트에서 UUID를 파생한다. 재시작해도 같은 주소가 살아 있다.

**Files:**

- Create: `src/lib/db/uuid.ts`, `src/lib/db/bootstrap.ts`, `src/lib/db/roots.ts`
- Test: `tests/db/bootstrap.test.ts`

**Interfaces:**

- Produces:
  - `derivedUuid(seed: string): string` — SHA-256 파생. UUID 형식
  - `ensureSeeded(): Promise<void>` — 멱등. 동시 호출 시 1회만 실행
  - `listRoots(): Promise<RootSummary[]>`

- [ ] **Step 1: 실패 테스트 작성**

`tests/db/bootstrap.test.ts`:

- `derivedUuid`가 같은 입력에 같은 값을 낸다
- `derivedUuid`가 UUID 형식이다
- 다른 입력은 다른 값이다
- `ensureSeeded` 두 번 호출해도 노드 수가 늘지 않는다
- 시드된 노드 ID가 `derivedUuid(question)`과 일치한다
- 시드된 노드에 추천 5개가 붙는다
- `listRoots`가 카테고리와 질문을 반환한다

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/db/bootstrap.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `uuid.ts` 구현**

`node:crypto` SHA-256 해시를 UUID 8-4-4-4-12로 자른다. 버전·변형 비트를 v4 형식에 맞춘다. Postgres `uuid` 컬럼이 형식을 검사하기 때문이다.

- [ ] **Step 4: `bootstrap.ts` 구현**

`data/example-nodes.ts`를 읽어 노드·추천·alias를 삽입한다. `scripts/seed.ts`와 같은 삽입 경로를 쓰되 ID를 명시한다.

동시 호출 방어는 promise 캐싱으로 한다. 불리언 플래그는 첫 호출이 끝나기 전 두 번째 호출이 통과한다.

- [ ] **Step 5: `roots.ts` 구현**

`origin='batch'`이고 `status='ready'`인 노드를 카테고리·생성순으로 반환한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/db/bootstrap.test.ts`
Expected: PASS

- [ ] **Step 7: 전체 회귀 확인**

Run: `npx vitest run`
Expected: 기존 90개 + 신규 전부 PASS

- [ ] **Step 8: 커밋**

```
feat: 부팅 시 자동 시드와 결정론적 노드 ID

PGlite가 인메모리라 dev 서버 재시작마다 DB가 빈다. 매번 새 UUID가 나오면
열어둔 URL이 전부 죽으므로 질문 텍스트에서 ID를 파생한다.
동시 호출 방어는 promise 캐싱으로 한다. 불리언 플래그는 첫 호출이 끝나기 전에 샌다.
```

---

## Task 3: 개발용 스텁 caller

`GOOGLE_GENERATIVE_AI_API_KEY`가 없다. 키 없이 확장을 누르면 실패해 UI를 만들 수 없다.

**프로덕션 경로를 건드리지 않는 것이 조건이다.** `realCaller`는 그대로 두고 주입으로만 붙인다.

**Files:**

- Create: `src/lib/llm/dev-stub.ts`, `src/lib/llm/resolve.ts`
- Modify: `src/app/api/expand/route.ts` (한 줄)
- Test: `tests/llm/dev-stub.test.ts`

**Interfaces:**

- Produces:
  - `stubCaller: StructuredCaller` — 결정론적 가짜 응답
  - `resolveCaller(): StructuredCaller | undefined` — 키 있으면 `undefined`(→ `realCaller`)

- [ ] **Step 1: 실패 테스트 작성**

`tests/llm/dev-stub.test.ts`:

- 게이트 모델로 부르면 `relevant`·`identity_scope`·`normalized_question`이 온다
- 같은 입력에 같은 정규화 문장이 나온다 (캐시 히트가 재현되어야 UI 검증이 된다)
- "번역"이 들어간 입력은 `relevant=false`다 (정규화 거절 UI를 볼 수 있어야 한다)
- 생성 모델로 부르면 `body`와 추천 5개가 온다
- `resolveCaller`가 키 있을 때 `undefined`를 낸다
- `resolveCaller`가 키 없을 때 `stubCaller`를 낸다

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: `dev-stub.ts` 구현**

`args.model`로 게이트와 생성을 구분한다. 스키마를 파싱하지 않아도 되고 분기가 명시적이다.

정규화는 결정론적 규칙으로 한다 — 공백 정리, 종결 어미 통일, 물음표 부착. 같은 질문이 같은 문장으로 수렴해야 캐시 히트 경로가 화면에서 재현된다.

- [ ] **Step 4: `resolve.ts` 구현**

- [ ] **Step 5: route handler에 주입**

`expand({ ..., call: resolveCaller() })`. 키가 있으면 `undefined`가 넘어가 기존 동작 그대로다.

- [ ] **Step 6: 테스트 통과 + 전체 회귀**

Run: `npx vitest run`

- [ ] **Step 7: 커밋**

```
feat: API 키 없을 때 쓰는 개발용 스텁 caller

키가 없으면 캐시 미스에서 확장이 실패해 UI를 만들 수 없다.
realCaller는 그대로 두고 주입으로만 붙여 프로덕션 경로에 영향이 없게 한다.
정규화를 결정론적으로 해 캐시 히트 경로가 화면에서 재현되게 했다.
```

---

## Task 4: 조회 API

**Files:**

- Create: `src/app/api/node/[id]/route.ts`, `src/app/api/roots/route.ts`

**Interfaces:**

- `GET /api/node/[id]` → 공개 노드. 개인 필드 없음. `cache-control: public`
- `GET /api/roots` → 루트 목록

- [ ] **Step 1: `GET /api/node/[id]` 구현**

`loadNode()`를 재사용한다. `status='ready'`만 나오므로 생성 중 노드가 새지 않는다. 없으면 404.

Next.js 16은 `params`가 Promise다. `await params`로 받는다.

- [ ] **Step 2: `GET /api/roots` 구현**

- [ ] **Step 3: 수동 확인**

Run: `npm run dev` 후 `curl`
Expected: 200 + JSON

- [ ] **Step 4: 커밋**

---

## Task 5: 경로 상태 모델

익명 경로를 클라이언트에서 관리한다. 설계 §5의 occurrence 모델을 그대로 재현한다.

**노드 참조만 저장하면 안 되는 이유가 설계에 있다.** 방문 집합에서 부분그래프를 유도하면 가본 적 없는 간선이 그려진다. 그래서 부모를 명시적으로 들고 있는 occurrence를 쓴다.

**Files:**

- Create: `src/lib/journey/types.ts`, `src/lib/journey/path.ts`, `src/lib/journey/storage.ts`
- Test: `tests/journey/path.test.ts`, `tests/journey/storage.test.ts`

**Interfaces:**

```ts
type Occurrence = {
  id: string
  nodeId: string
  parentId: string | null
  question: string
  category: string
}
type JourneyState = { occurrences: Occurrence[]; currentId: string | null }
```

- `startJourney(node): JourneyState`
- `visit(state, parentOccurrenceId, node): { state, occurrenceId }` — 같은 부모에서 같은 노드로 두 번 가면 기존 occurrence를 재사용
- `pathTo(state, occurrenceId): Occurrence[]` — 루트부터 순서대로
- `ancestorNodeIds(state, occurrenceId): string[]` — API에 보낼 조상 목록
- `findOccurrenceByNode(state, nodeId): string | null` — 조상 점프 응답 처리용
- `moveTo(state, occurrenceId): JourneyState`

- [ ] **Step 1: 실패 테스트 작성**

`tests/journey/path.test.ts`:

- `startJourney`가 부모 없는 occurrence 하나를 만든다
- `visit`이 부모를 가진 occurrence를 붙인다
- 같은 노드를 **다른 부모**에서 방문하면 occurrence가 두 개 생긴다 (설계의 핵심 성질)
- 같은 노드를 **같은 부모**에서 다시 방문하면 재사용한다
- `pathTo`가 루트부터 현재까지 순서대로 낸다
- `ancestorNodeIds`가 현재 자신을 포함한 조상 노드 ID를 낸다
- 순환 데이터에서 `pathTo`가 무한 루프에 빠지지 않는다
- `moveTo`가 없는 occurrence면 상태를 바꾸지 않는다

`tests/journey/storage.test.ts`:

- 직렬화 후 역직렬화하면 같은 상태다
- 깨진 JSON은 `null`을 낸다 (예외를 던지면 화면이 죽는다)
- 스키마가 다른 옛 데이터는 `null`을 낸다

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```
feat: 익명 경로 상태 모델 (occurrence 기반)

방문을 노드 참조로만 기록하면 경로가 복원되지 않는다. 전역 간선이 A→C와 B→C일 때
방문 집합 {A,B,C}에서 부분그래프를 유도하면 가본 적 없는 B→C가 그려진다.
부모를 명시적으로 들고 있는 occurrence로 저장해 경로를 유일하게 복원한다.
```

---

## Task 6: 트리 레이아웃과 컬링

미니맵과 지도 모드가 **같은 좌표 계산을 공유한다.** 렌더러만 SVG와 React Flow로 다르다. 두 벌로 만들면 둘이 어긋난다.

**Files:**

- Create: `src/lib/journey/graph.ts`
- Test: `tests/journey/graph.test.ts`

**Interfaces:**

- `layoutJourney(state): LayoutResult`
  - `nodes: Array<{ occurrenceId, nodeId, label, depth, x, y, onPath }>`
  - `edges: Array<{ from, to, onPath }>`
  - `bounds: { width, height }`
- `cullAround(layout, focusOccurrenceId, limit): LayoutResult` — 상한 초과 시 현재 위치 기준 BFS 거리 순으로 자른다

레이아웃 규칙이다. `x`는 깊이에 비례한다. `y`는 리프 순번으로 정한다. 내부 노드는 자식 `y`의 평균에 놓는다. 결정론적이라 테스트가 된다.

- [ ] **Step 1: 실패 테스트 작성**

`tests/journey/graph.test.ts`:

- 단일 노드는 원점에 놓인다
- 깊이가 늘면 `x`가 단조 증가한다
- 형제 둘은 `y`가 다르다
- 부모의 `y`는 자식들 사이에 있다
- `onPath`가 현재 경로 위 노드에만 참이다
- 간선 수가 occurrence 수 − 1이다 (루트 제외)
- `cullAround`가 상한을 넘지 않는다
- `cullAround`가 포커스 노드를 반드시 포함한다
- `cullAround`가 남은 노드끼리만 간선을 유지한다 (끊긴 간선이 남으면 React Flow가 경고를 낸다)
- 200개 초과 트리에서 결과가 200개다

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

```
feat: 여정 트리 레이아웃과 200 노드 컬링

미니맵과 지도 모드가 같은 좌표 계산을 공유한다. 두 벌로 만들면 둘이 어긋난다.
컬링은 노드만 자르지 않고 끊긴 간선도 함께 버린다. 남으면 React Flow가 경고를 낸다.
```

---

## Task 7: 확장 클라이언트와 에러 매핑

§7의 상태 표를 화면이 아니라 여기서 결정한다. 컴포넌트가 HTTP 코드를 직접 읽으면 상태 분기가 화면마다 흩어진다.

**Files:**

- Create: `src/lib/api/expand-client.ts`
- Test: `tests/api/expand-client.test.ts`

**Interfaces:**

```ts
type ExpandResult =
  | { kind: 'ok'; node: PublicNode; cache: string; quota: {...} }
  | { kind: 'ancestor_jump'; nodeId: string }
  | { kind: 'rejected'; reason: string }       // 422 · 400
  | { kind: 'quota_exceeded' }                 // 429 quota_exceeded
  | { kind: 'rate_limited'; retryAfter: number } // 429 rate_limited
  | { kind: 'gate_unavailable'; fallback: Suggestion[] } // 503
  | { kind: 'error'; message: string }         // 504 · 5xx · 네트워크
```

- [ ] **Step 1: 실패 테스트 작성**

`fetch`를 주입 가능하게 만들어 테스트한다. 각 HTTP 코드가 올바른 `kind`로 매핑되는지 전부 확인한다. 네트워크 예외도 `error`로 삼킨다 — 던지면 화면이 죽는다.

- [ ] **Step 2: 테스트 실패 확인**

- [ ] **Step 3: 구현**

`idempotency_key`는 호출마다 `crypto.randomUUID()`로 만든다.

- [ ] **Step 4: 테스트 통과 확인**

- [ ] **Step 5: 커밋**

---

## Task 8: 홈 화면

**Files:**

- Create: `src/app/page.tsx`, `src/components/RootCard.tsx`

- [ ] **Step 1: 서버 컴포넌트 구현**

`ensureSeeded()` 후 `listRoots()`. 첫 노드를 히어로로, 나머지를 카테고리 목록으로.

빈 상태 문구를 넣는다 (§7 표). 시드가 실패하면 여기가 보인다.

- [ ] **Step 2: `RootCard` 구현**

- [ ] **Step 3: 브라우저 확인**

- [ ] **Step 4: 커밋**

---

## Task 9: 읽기 뷰

§7 순서를 그대로 따른다. 위에서부터 경로 칩 → 질문 → 해설 → 추천 5개 → 자유 입력란 → 미니맵.

**Files:**

- Create: `src/app/q/[nodeId]/page.tsx`, `src/components/ReadingView.tsx`, `src/components/PathChips.tsx`, `src/components/Suggestions.tsx`, `src/components/FreeInput.tsx`, `src/components/Banners.tsx`

- [ ] **Step 1: 서버 셸 구현**

`ensureSeeded()` → `loadNode()`. 없으면 `notFound()`.

- [ ] **Step 2: `ReadingView` 클라이언트 셸**

경로 상태를 `sessionStorage`에서 복원한다. 현재 노드가 경로에 없으면 새 여정을 시작한다. 직접 URL로 들어온 경우다.

- [ ] **Step 3: `PathChips`**

가로 스크롤. 현재 칩 강조. 누르면 그 지점으로 점프.

깊이가 깊어지면 앞쪽을 `…`로 접는다. 무한 확장이 전제이므로 칩이 무한히 늘어나면 안 된다.

- [ ] **Step 4: 해설 렌더**

Markdown 문단만 온다. HTML은 미허용이므로 문단 분리만 하고 그대로 텍스트로 넣는다. `dangerouslySetInnerHTML`을 쓰지 않는다 — 자유 입력이 전역 자산이 되므로 오염이 증폭된다.

- [ ] **Step 5: `Suggestions`**

5개. 해소된 추천(`resolved`)에 표시를 둔다. LLM을 안 태우므로 즉시 이동한다는 것이 사용자에게도 보이는 편이 낫다.

- [ ] **Step 6: `FreeInput`**

300자 제한. 남은 글자 수 표시. **입력이 AI 학습에 사용될 수 있다는 고지를 붙인다** (설계 §8 약관 대응).

- [ ] **Step 7: `Banners` — §7 상태 전부**

| 상태 | 표시 |
|---|---|
| 로딩 | 스켈레톤 |
| 생성 중 | 질문은 즉시, 해설 자리에 진행 표시 |
| 할당량 초과 | 자유 입력 비활성 + 안내. 해소된 추천은 계속 가능 |
| 정규화 거절 | 입력란 아래 사유. **입력은 보존** |
| RPM 한도 | 재시도 가능 시각 |
| 오류 | 재시도 버튼. 경로 유지 |

- [ ] **Step 8: 커밋**

---

## Task 10: 미니맵 스트립

**이게 이번 계획의 핵심이다.** 포커스 뷰만 있으면 결국 선형이라 카톡과 구조적으로 같아진다.

**Files:**

- Create: `src/components/MinimapStrip.tsx`

- [ ] **Step 1: SVG 렌더 구현**

`layoutJourney()` 좌표를 쓴다. 높이 약 80px. 현재 경로는 진한 선, 나머지 가지는 옅게.

가로 스크롤로 현재 노드를 중앙에 유지한다.

- [ ] **Step 2: 확장 직후 새 노드 강조**

설계 §7이 명시한다 — "확장 직후 미니맵에 새 노드가 붙는 것을 잠깐 보여주고 읽기로 돌아온다."

- [ ] **Step 3: 노드 클릭 시 점프**

- [ ] **Step 4: 브라우저 확인**

- [ ] **Step 5: 커밋**

---

## Task 11: 지도 모드

**Files:**

- Create: `src/components/MapModal.tsx`

- [ ] **Step 1: React Flow 모달 구현**

미니맵을 누르면 열린다. 모달이라 읽던 자리를 잃지 않는다.

`@xyflow/react/dist/style.css`를 임포트한다.

- [ ] **Step 2: `cullAround(layout, current, 200)` 적용**

상한 초과 시 안내를 띄운다.

- [ ] **Step 3: 노드 클릭 시 이동 + 모달 닫기**

- [ ] **Step 4: Esc·배경 클릭으로 닫기**

- [ ] **Step 5: 브라우저 확인**

- [ ] **Step 6: 커밋**

---

## Task 12: 브라우저 E2E 검증

claude-in-chrome MCP로 직접 확인한다. Playwright는 쓰지 않는다.

- [ ] **Step 1: `npm run dev` 기동**

- [ ] **Step 2: 홈 → 루트 목록 확인 + 스크린샷**

- [ ] **Step 3: 질문 진입 → 읽기 뷰 확인 + 스크린샷**

- [ ] **Step 4: 추천 클릭 → 확장 → 미니맵에 노드 추가 확인 + 스크린샷**

- [ ] **Step 5: 자유 입력 확장 확인**

- [ ] **Step 6: 지도 모드 열기 확인 + 스크린샷**

- [ ] **Step 7: 콘솔 에러 확인**

- [ ] **Step 8: 할당량 소진까지 확장해 429 화면 확인**

- [ ] **Step 9: "번역해줘" 입력으로 정규화 거절 화면 확인**

- [ ] **Step 10: 전체 회귀**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 11: README 갱신 + 커밋**
