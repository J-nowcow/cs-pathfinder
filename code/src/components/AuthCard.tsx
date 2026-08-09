'use client'

import { authClient } from '@/lib/auth/client'

/**
 * 로그인 카드 — /me에만 있다.
 *
 * 헤더에 안 넣는 이유: 390px에서 링크 넷+아이콘 둘로 이미 빠듯하다
 * (SiteHeader 주석 참조). 로그인이 의미 있는 자리가 "내 자국"이기도 하다.
 *
 * **지금은 로그인해도 달라지는 것이 없다**고 정직하게 적는다. 기록의
 * 서버 저장(C4)이 붙기 전까지는 계정만 만들어지는 상태다. 부풀리면
 * 로그인한 사람이 "그래서 뭐가 달라졌지"를 겪는다.
 */
export function AuthCard() {
  const { data: session, isPending } = authClient.useSession()

  // 세션 확인 중에는 아무것도 안 그린다 — 로그인/로그아웃이 깜빡이며 바뀌는 것보다 낫다
  if (isPending) return <div className="h-[72px]" aria-hidden />

  if (session) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm">
          <span className="font-medium">{session.user.email}</span>로 로그인돼 있다.
        </p>
        <p className="mt-1 text-sm text-muted">
          기록을 계정에 잇는 기능은 준비 중이다. 지금은 이 브라우저에만 쌓인다.
        </p>
        <button
          type="button"
          onClick={() => authClient.signOut()}
          className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm">
        로그인하면 나중에 기록을 다른 기기에서도 이어볼 수 있게 준비 중이다.
      </p>
      <p className="mt-1 text-sm text-muted">
        저장하는 것은 이메일뿐이다. 이름·프로필 사진은 받지 않는다.
      </p>
      <button
        type="button"
        onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/me' })}
        className="mt-3 rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:bg-line/40"
      >
        Google로 로그인
      </button>
    </div>
  )
}
