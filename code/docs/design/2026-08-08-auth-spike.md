# 인증 런타임 — 실제로 설치해 재 본 것

2026-08-08. 후보 셋을 임시 작업공간에 **실제로 설치하고 생성자를 호출해** 봤다. 문서만 읽고 정하지 않았다.

작업공간은 우리 런타임과 같게 맞췄다 — `next 16.2.6` · `react 19.2.4` · `pg ^8.22.0`.

## 결론

**`better-auth@1.6.26`을 쓴다.**

## 왜 앞선 두 판정이 다 틀렸나

**설계안(8/7)은 Auth.js v5 beta를 골랐다.** 이유는 "Next 16·React 19가 peer에 선언돼 있고 `pg ^8`은 이미 있다"였다.

**Codex(8/8)는 그걸 뒤집고 stable v4를 권했다.** 이유는 "v4도 Next 16을 지원하니 beta를 질 이유가 없다"였다. 그 사실은 맞다.

**그런데 v4로 갈 수가 없다.** 재 보니 이렇다.

```
@next-auth/pg-adapter              (없음)
@next-auth/prisma-adapter          1.0.7
@next-auth/typeorm-legacy-adapter  2.0.2
```

**v4에는 raw `pg` 어댑터가 아예 없다.** Prisma나 TypeORM을 들여오거나 어댑터를 직접 짜야 한다. 설계안이 "직접 구현할 이유가 없다"고 한 그 일을 다시 하게 된다. Codex는 "v4 호환 PostgreSQL adapter를 우선한다"고 적었는데 **그 패키지가 있는지 확인하지 않았다.**

그래서 v4는 후보에서 빠진다. 남은 것은 v5 beta와 better-auth이고, 재 보니 better-auth가 이긴다.

## 잰 것

| | Auth.js v5 beta | better-auth 1.6.26 |
|---|---|---|
| 안정성 | `5.0.0-beta.0`이 2023-10-24. **1,019일째 beta** | stable |
| raw `pg.Pool` | `PostgresAdapter(client: Pool)` — 받는다 | **받는다** (아래 실증) |
| 세션 | JWT 또는 DB. 설계안은 JWT를 골랐다 | **`session` 테이블이 기본** |
| 카카오 | 기본 provider 목록에 없다. 커스텀으로 직접 | **1급 provider.** `naver`도 있다 |
| 테이블 이름 | `users`·`accounts`·`sessions` (복수·camelCase 컬럼) | `user`·`session`·`account` (**단수** — 이 저장소 관례와 같다) |
| 새로 드는 패키지 | — | +17 |

**Pool 결합은 타입만 보지 않고 실제로 만들어 봤다.**

```js
const pool = new Pool({ connectionString: '...' })
const auth = betterAuth({
  database: pool,
  socialProviders: {
    google: { clientId: 'g', clientSecret: 's' },
    kakao:  { clientId: 'k', clientSecret: 's' },   // 커스텀 아님
  },
})
// → betterAuth 생성 OK · handler 함수 있음 · api 객체 있음
```

`getPool()`을 만들어 둔 것이 그대로 여기 들어간다.

## Codex의 요구가 저절로 풀린 것

Codex는 **JWT를 버리고 DB 세션으로 가라**고 했다. 근거는 탈퇴 즉시 차단이다 — JWT는 DB를 안 보므로 사용자 행을 지워도 다른 기기 쿠키가 만료까지 산다.

better-auth는 **`session` 테이블이 기본**이다. 쿠키에는 `token`만 들고 매 요청 DB를 본다. 세션 행을 지우면 그 순간 끝난다. 고를 것이 없다.

## 저장하는 것 — 방침을 고쳐야 한다

기본 스키마를 뽑아 보니 이렇다.

```
user     name · email · emailVerified · image · createdAt · updatedAt
session  token · expiresAt · createdAt · updatedAt · ipAddress · userAgent
account  accountId · providerId · userId · accessToken · refreshToken
```

**세 가지가 지금 `/privacy`와 어긋난다.**

1. `user.image` — 설계안 §5는 "프로필 이미지를 저장하지 않는다"고 했다
2. `account.accessToken`·`refreshToken` — provider 토큰을 장기 보관한다
3. `session.ipAddress`·`userAgent` — **IP를 세션마다 남긴다.** 지금 방침은 IP를 "하루 한도"에만 쓴다고 적었다

로그인을 켜는 순간 `/privacy`가 거짓이 된다. **셋 중 무엇을 끄고 무엇을 적을지 C3 전에 정한다.** 안 쓰는 것은 안 받는 것이 지키기 쉽다.

## 안 잰 것 — 정직하게

- **실제 로그인 왕복을 못 해 봤다.** Google OAuth 클라이언트가 없다. 생성자까지만 확인했다
- 마이그레이션 SQL을 못 뽑았다. `better-auth/db`가 `getMigrations`를 안 내보낸다. CLI(`@better-auth/cli`)로 뽑는 경로가 따로 있는 듯한데 확인 못 했다
- 카카오 provider가 **실제로 동작하는지**는 못 봤다. 목록에 있다는 것까지만 확인했다
- 부하·연결 수는 안 쟀다

## 되돌리려면

이 판정은 두 가지가 뒤집히면 다시 봐야 한다.

1. better-auth의 카카오 provider가 실제로는 안 붙는다 → v5 beta + 커스텀 provider로 돌아간다
2. `session` 테이블 조회가 Neon 무료 한도를 태운다 → 그때 재고 정한다. **지금은 재지도 않고 JWT를 고르지 않는다** (설계안이 그랬다)

작업공간은 `scratchpad/authspike`에 남겨 뒀다. 지워도 이 문서의 명령으로 다시 만들 수 있다.
