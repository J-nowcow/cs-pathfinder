'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

/**
 * 'confirming'은 확인을 묻는 중, 'working'은 보내는 중이다. 실패하면
 * 'confirming'으로 돌아온다 — 확인 블록이 열린 채로 실패 문구를 안고
 * 다시 눌릴 수 있어야 해서다.
 */
type Phase = 'idle' | 'confirming' | 'working' | 'done'

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
 *
 * 탈퇴도 여기에 있다 — 계정을 만든 자리에서 지울 수 있어야 한다.
 */
export function AuthCard() {
  const { data: session, isPending } = authClient.useSession()
  const [phase, setPhase] = useState<Phase>('idle')
  const [failed, setFailed] = useState(false)

  async function remove() {
    // 연타하면 두 번째부터는 계정이 이미 없어 실패로 보인다
    if (phase === 'working') return
    setPhase('working')
    setFailed(false)
    try {
      /*
       * authClient에는 deleteUser 타입이 안 잡혀 있어 fetch로 직접 부른다.
       * /api/auth/[...all] catch-all이 better-auth 핸들러로 넘긴다.
       */
      const res = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(String(res.status))
      setPhase('done')
      /*
       * 쿠키는 서버가 이미 지웠다(라우트가 deleteSessionCookie를 부른다).
       * 이건 브라우저에 남은 세션 캐시를 비우는 것이다 — 안 비우면
       * useSession이 없어진 계정을 잠시 더 로그인 상태로 들고 있는다.
       * 실패해도 할 일이 없어서 삼킨다. 계정은 이미 지워졌다.
       */
      authClient.signOut().catch(() => {})
    } catch {
      setPhase('confirming')
      setFailed(true)
    }
  }

  /*
   * 지웠다는 안내를 세션 분기보다 **먼저** 그린다.
   *
   * 위 signOut이 세션을 비우면 카드가 로그인 화면으로 되돌아간다. 그 자리에
   * 두면 안내가 한 순간 보였다가 사라져서, 사람은 지워졌는지 모른 채 남는다.
   */
  if (phase === 'done') {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-sm font-medium">계정을 지웠습니다.</p>
        <p className="mt-1 text-sm text-muted">
          서버에 저장돼 있던 이메일과 학습 기록을 지웠습니다. 이 브라우저에 남은 기록은 그대로
          있습니다.
        </p>
      </div>
    )
  }

  if (isPending) {
    return (
      <div
        className="flex min-h-[72px] items-center gap-2 rounded-xl border border-line bg-surface p-4 text-sm text-muted"
        aria-busy="true"
      >
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-faint/30 border-t-faint"
        />
        <span role="status">로그인 상태를 확인하는 중</span>
      </div>
    )
  }

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

        {phase === 'idle' ? (
          /*
           * 지우는 길은 있되 눈에 먼저 들어오면 안 된다. 로그아웃과 같은
           * 무게로 두면 잘못 누른다 — text-faint로 한 단 낮춘다.
           */
          <div className="mt-4 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setPhase('confirming')}
              className="min-h-11 text-sm text-faint transition-colors hover:text-warn"
            >
              계정 삭제
            </button>
          </div>
        ) : (
          /*
           * 확인은 화면 안에서 받는다. native confirm은 문구를 우리가 못 고르고,
           * 브라우저가 "다시 표시 안 함"으로 통째로 꺼버릴 수 있다 — 그러면
           * 첫 클릭이 곧 삭제가 된다.
           */
          <div className="mt-4 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5">
            <p className="text-[13px] leading-[1.6] text-ink">
              서버에 저장된 이메일과 학습 기록이 지워집니다. 이 브라우저에 남은 기록은 지워지지
              않습니다.
            </p>
            {failed && (
              <p role="alert" className="mt-2 text-[13px] leading-[1.6] text-warn">
                지우지 못했습니다. 다시 로그인한 뒤 시도해 주세요.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={phase === 'working'}
                className="min-h-11 rounded-md border border-warn/40 px-4 py-1.5 text-sm font-medium text-warn transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                지우기
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase('idle')
                  setFailed(false)
                }}
                disabled={phase === 'working'}
                className="min-h-11 rounded-md px-4 py-1.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-sm">
        로그인하면 학습 기록이 계정에 저장되어 다른 기기에서도 이어집니다.
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
