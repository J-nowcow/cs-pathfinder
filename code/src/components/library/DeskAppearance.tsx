'use client'
import { useEffect, useRef, useState } from 'react'
const KEY = 'pathfinder.library.appearance.v1'
export function DeskAppearance() {
  const ref = useRef<HTMLButtonElement>(null)
  const [dark, setDark] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (
        value?.version === 1 &&
        (value.mode === 'light' || value.mode === 'dark')
      ) {
        setDark(value.mode === 'dark')
        ref.current
          ?.closest<HTMLElement>('.study-desk')
          ?.setAttribute('data-appearance', value.mode)
      }
    } catch {
      /* The shelf defaults to light when preferences are unavailable. */
    }
  }, [])
  function toggle() {
    const mode = dark ? 'light' : 'dark'
    setDark(!dark)
    ref.current
      ?.closest<HTMLElement>('.study-desk')
      ?.setAttribute('data-appearance', mode)
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, mode }))
      setMessage('')
    } catch {
      setMessage('밝기는 바뀌었지만 다음 방문을 위한 설정은 저장하지 못했어요.')
    }
  }
  const label = dark ? '밝은 서재로 보기' : '어두운 서재로 보기'
  return (
    <div className="desk-appearance">
      <button
        ref={ref}
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
            </>
          ) : (
            <path d="M20 14a8.5 8.5 0 1 1-10-10 6.8 6.8 0 0 0 10 10Z" />
          )}
        </svg>
      </button>
      {message && (
        <span role="status" className="desk-appearance-message">
          {message}
        </span>
      )}
    </div>
  )
}
