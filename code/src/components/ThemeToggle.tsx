'use client'

import { useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'csqt.theme'

/** `--surface`와 같아야 한다. 다르면 폰 주소창에 경계선이 생긴다 */
const SURFACE = { light: '#fbf8f3', dark: '#191512' } as const

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  /*
   * meta는 시스템 선호로 갈리게 두 줄 박혀 있다(`layout.tsx`). 사용자가 고른
   * 값이 그것과 다를 수 있으므로 여기서 덮는다. 안 하면 화면은 밝은데 폰
   * 주소창만 어두운 띠로 남는다.
   */
  for (const el of document.querySelectorAll('meta[name="theme-color"]')) {
    el.setAttribute('content', dark ? SURFACE.dark : SURFACE.light)
    el.removeAttribute('media')
  }
}

/**
 * 밝게 볼지 어둡게 볼지 고르는 버튼.
 *
 * 저장하기 전까지는 시스템 선호를 따른다 — 첫 방문에 아무것도 안 고른 사람의
 * 화면은 예전과 같다. 고른 뒤에만 그 선택이 시스템을 이긴다.
 *
 * 첫 그리기는 `layout.tsx`의 부트 스크립트가 이미 끝냈다. 여기서는 그 결과를
 * 읽어 버튼 모양만 맞춘다.
 */
export function ThemeToggle() {
  /** 서버에서는 알 수 없다. 붙기 전에는 아이콘을 그리지 않는다 */
  const [dark, setDark] = useState<boolean | null>(null)

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark')
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light')
    } catch {
      /* 저장 못 해도 이번 방문에는 적용된다 */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      /* 붙기 전에는 눌러도 무엇이 될지 모른다 */
      disabled={dark === null}
      aria-label={dark ? '밝게 보기' : '어둡게 보기'}
      title={dark ? '밝게 보기' : '어둡게 보기'}
      className="grid size-9 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* 크기를 미리 잡아 둬야 붙는 순간 헤더가 밀리지 않는다 */}
      <span aria-hidden className="grid size-[18px] place-items-center">
        {dark === null ? null : dark ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]">
      <circle cx="12" cy="12" r="4.2" />
      <path
        strokeLinecap="round"
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-[18px]">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z"
      />
    </svg>
  )
}
