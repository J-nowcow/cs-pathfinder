-- 로그인 (better-auth 1.6.26)
--
-- 이 SQL은 손으로 쓰지 않았다. better-auth의 getMigrations(deep import:
-- dist/db/get-migration.mjs)가 실제 DB를 introspect해 뽑은 것을 그대로
-- 옮기고 if not exists만 붙였다. 손으로 옮겨 적으면 라이브러리가 기대하는
-- 컬럼과 어긋난 채 조용히 돌아가는 사고가 난다.
--
-- 컬럼은 스키마대로 두되 이 중 일부는 **항상 비운다** — name(빈 문자열)·
-- image·account 토큰 5종·session의 ipAddress·userAgent. 수집을 끄는
-- 설정이 없어 src/lib/auth의 strip 훅이 막는다. 근거는
-- docs/design/2026-08-10-auth-data-decision.md.
--
-- 테이블 이름이 단수인 것은 이 저장소 관례와 같다(qnode·tree). "user"는
-- 예약어라 어디서든 따옴표가 필요하다 — better-auth 기본값을 그대로 둔다.

create table if not exists "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create table if not exists "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table if not exists "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null
);

create table if not exists "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index if not exists "session_userId_idx" on "session" ("userId");
create index if not exists "account_userId_idx" on "account" ("userId");
create index if not exists "verification_identifier_idx" on "verification" ("identifier");
