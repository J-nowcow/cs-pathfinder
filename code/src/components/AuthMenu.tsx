'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { authClient } from '@/lib/auth/client'

/**
 * 머리글의 계정 자리.
 *
 * 그동안 로그인은 `/me`의 카드에만 있었다. 거기까지 가야 보인다는 뜻이라,
 * 다른 기기에서 이어 볼 수 있다는 것을 모르는 채로 쓰는 사람이 생긴다.
 *
 * **글자 대신 그림이다.** 390px에서 이 줄은 이미 넘쳐 있었다(SiteHeader
 * 주석 참조). "로그인"을 글자로 넣으면 그만큼 다른 것을 빼야 한다.
 * 대신 `aria-label`로 이름을 남긴다.
 *
 * 로그인 뒤에는 누르면 메뉴가 열린다. 아이콘 하나에 로그아웃을 바로
 * 걸면 **잘못 눌러서 로그아웃된다** — 되돌리려면 구글 화면을 다시 거쳐야
 * 하는 일이라 한 번 물어보는 값을 한다. 여는 방식은 `ContactMenu`와 같게
 * 뒀다. 머리글에 여닫는 것이 둘인데 서로 다르게 굴면 안 된다.
 *
 * 회원가입 항목은 없다. 구글 하나뿐이라 처음 누른 사람은 그 자리에서
 * 계정이 생긴다 — 둘로 나누면 고르는 일만 는다.
 */
function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden>
      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1.5c-2.67 0-5 1.34-5 3v.75c0 .41.34.75.75.75h8.5c.41 0 .75-.34.75-.75V12.5c0-1.66-2.33-3-5-3Z" />
    </svg>
  )
}

/** 머리글의 다른 아이콘과 같은 규격. 폰에서만 한 칸 좁다 */
const BUTTON = '-my-1.5 relative grid h-11 w-8 place-items-center rounded-lg transition-colors sm:w-9'

export function AuthMenu() {
  const { data: session, isPending } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return
    /* 바깥을 누르거나 Esc면 닫는다. 닫는 길이 없으면 한 번 연 사람이 갇힌다 */
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setOpen(false)
        window.setTimeout(() => trigger.current?.focus(), 0)
      }
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        // 메뉴 항목이 DOM에서 빠진 뒤 옮겨야 브라우저가 초점을 body로 되돌리지 않는다.
        window.setTimeout(() => trigger.current?.focus(), 0)
      }
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  /*
   * 세션을 확인하는 동안 자리만 잡아 둔다.
   *
   * 아무것도 안 그리면 확인이 끝나는 순간 아이콘이 튀어나오며 옆 항목이
   * 밀린다. 이 줄은 폰에서 여유가 2px밖에 없어서 그 흔들림이 그대로 보인다.
   */
  if (isPending) return <div className="h-11 w-8 sm:w-9" aria-hidden />

  if (!session) {
    return (
      <button
        type="button"
        aria-label="Google로 로그인"
        title="Google로 로그인"
        /* AuthCard와 같은 자리로 보낸다 — 로그인의 쓸모가 보이는 화면이 거기다 */
        onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/me' })}
        className={`${BUTTON} text-muted hover:text-ink`}
      >
        <PersonIcon />
      </button>
    )
  }

  return (
    <div ref={box} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-label="내 계정"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) requestAnimationFrame(() => firstItem.current?.focus())
        }}
        className={`${BUTTON} ${open ? 'text-ink' : 'text-muted hover:text-ink'}`}
      >
        <PersonIcon />
        {/*
          로그인돼 있다는 표시.

          그림만으로는 로그인 상태가 안 읽힌다 — 눌러서 메뉴를 열어야 안다.
          점은 눈으로만 쓰는 덤이라 낭독기에서는 감춘다. 상태는 위
          `aria-label`과 메뉴 안 이메일이 말한다.
        */}
        <span
          aria-hidden
          className="absolute right-1 top-2 h-1.5 w-1.5 rounded-full bg-ink ring-2 ring-surface sm:right-1.5"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-[248px] rounded-lg border border-line bg-raised p-3 text-left shadow-lg"
        >
          {/*
            누구로 로그인돼 있는지 먼저 밝힌다. 계정이 둘인 사람은 이걸
            안 보면 엉뚱한 계정에 기록을 쌓는다.
          */}
          <p className="break-all px-2 text-[12px] text-faint">{session.user.email}</p>

          <Link
            ref={firstItem}
            role="menuitem"
            href="/me"
            onClick={() => setOpen(false)}
            className="mt-2 flex min-h-11 items-center rounded-md px-2 text-[13px] text-ink hover:bg-surface"
          >
            내 기록으로
          </Link>

          <div className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                authClient.signOut()
              }}
              className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-[13px] text-muted hover:bg-surface hover:text-ink"
            >
              로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
