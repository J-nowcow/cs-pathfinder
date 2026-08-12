'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * 문의하는 두 갈래.
 *
 * 처음에는 GitHub 이슈 하나였다. 기록이 남고 주소가 안 새서 좋지만 **계정이
 * 없으면 아예 못 쓴다.** 그래서 `mailto:` 하나로 바꿨더니 이번에는 눌러도
 * 아무 일이 안 일어난다는 말이 나왔다 — 기본 메일 앱이 없으면 브라우저가
 * 조용히 아무것도 안 한다. 링크는 멀쩡한데 사용자에게는 고장으로 보인다.
 *
 * 둘 다 준다. 그리고 **주소를 글자로 보여준다.** 그래야 메일 앱이 없어도
 * 복사해서 쓸 수 있다. 한쪽에만 기대는 구조를 없애는 것이 요점이다.
 *
 * 주소가 HTML에 그대로 실려 수집 봇에 긁힌다. 그 대가를 알고 고른 것이다 —
 * 문의하려는 사람이 문턱에서 돌아서는 쪽이 더 나쁘다.
 */
const REPO = 'https://github.com/J-nowcow/cs-pathfinder'
const ISSUE = `${REPO}/issues/new`
const MAIL = 'wkdgusdn0321@naver.com'
const SUBJECT = encodeURIComponent('[CS 길라잡이] 문의')

export function ContactMenu() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const firstItem = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return

    /*
     * 바깥을 누르거나 Esc면 닫는다.
     *
     * 닫는 길이 없으면 한 번 연 사람이 갇힌다. 폰에서는 특히 그렇다 —
     * 되돌아갈 X 버튼을 찾다가 뒤로 가기를 눌러 화면을 떠난다.
     */
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

  return (
    <div ref={box} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) requestAnimationFrame(() => firstItem.current?.focus())
        }}
        /* 헤더의 다른 항목과 같은 규격. 보이는 크기는 그대로 두고 누르는 자리만 44px로 */
        className={`-my-2 rounded-lg px-1.5 py-[13px] text-[12.5px] transition-colors sm:px-2.5 sm:text-[13px] ${
          open ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        문의
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-[248px] rounded-lg border border-line bg-raised p-3 text-left shadow-lg"
        >
          <a
            ref={firstItem}
            role="menuitem"
            href={ISSUE}
            target="_blank"
            // noopener가 없으면 열린 창이 window.opener로 이 페이지를 조작할 수 있다
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-md px-2 text-[13px] text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            GitHub에 이슈로 남기기
          </a>

          <div className="mt-1 border-t border-line pt-2">
            <p className="px-2 text-[12px] text-faint">메일로 보내도 됩니다</p>
            {/*
              주소를 글자로 둔다.

              `mailto:`만 걸어두면 메일 앱이 없는 사람에게는 아무 일도 안
              일어난다. `select-all`이라 한 번 누르면 통째로 잡혀 복사된다.
            */}
            <p className="select-all break-all px-2 pt-1 font-mono text-[12.5px] text-ink">
              {MAIL}
            </p>
            <a
              role="menuitem"
              href={`mailto:${MAIL}?subject=${SUBJECT}`}
              onClick={() => setOpen(false)}
              /* 메일 주소는 새 탭을 열지 않는다. 열면 빈 탭이 남아 사람이 직접 닫아야 한다 */
              className="mt-1 flex min-h-11 items-center rounded-md px-2 text-[13px] text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              메일 앱으로 열기 →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
