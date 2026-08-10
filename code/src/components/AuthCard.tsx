'use client'

import { authClient } from '@/lib/auth/client'

/**
 * 로그인 카드 — /me에만 있다.
 *
 * 헤더에 안 넣는 이유: 390px에서 링크 넷+아이콘 둘로 이미 빠듯하다
 * (SiteHeader 주석 참조). 로그인이 의미 있는 자리가 "내 기록"이기도 하다.
 *
 * 로그인의 효용은 C4가 만들었다 — SyncAgent가 이 기기의 여정·잔디를
 * 계정과 합치고, 다른 기기에서 로그인하면 거기로 내려간다. 문구는 그
 * 사실 그대로만 적는다. 부풀리면 로그인한 사람이 "그래서 뭐가
 * 달라졌지"를 겪는다.
 */
export function AuthCard() {
  const { data: session, isPending } = authClient.useSession()

  // 세션 확인 중에는 아무것도 안 그린다 — 로그인/로그아웃이 깜빡이며 바뀌는 것보다 낫다
  if (isPending) return <div className="h-[72px]" aria-hidden />

  if (session) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm">
          <span className="font-medium">{session.user.email}</span>로 로그인돼 있습니다.
        </p>
        <p className="mt-1 text-sm text-muted">
          이 기기의 기록과 계정의 기록을 합쳐 저장합니다. 다른 기기에서 로그인하면 이어집니다.
        </p>
        <button
          type="button"
          onClick={() => authClient.signOut()}
          className="mt-3 min-h-11 rounded-lg border border-line px-4 py-1.5 text-sm text-muted transition-colors hover:text-ink"
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm">
        로그인하면 판 기록이 계정에 저장되어 다른 기기에서도 이어집니다.
      </p>
      <p className="mt-1 text-sm text-muted">
        저장하는 것은 이메일뿐입니다. 이름·프로필 사진은 받지 않습니다.
      </p>
      <button
        type="button"
        onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/me' })}
        className="mt-3 min-h-11 rounded-lg border border-line px-4 py-1.5 text-sm font-medium transition-colors hover:bg-line/40"
      >
        Google로 로그인
      </button>
    </div>
  )
}
