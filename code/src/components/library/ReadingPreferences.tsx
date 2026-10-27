'use client'
import { useEffect, useState } from 'react'
const KEY = 'pathfinder.reading.v1'
const sizes = [18, 20, 22] as const
export function ReadingPreferences() {
  const [size, setSize] = useState<number>(18)
  const [message, setMessage] = useState('')
  useEffect(() => {
    document.documentElement.dataset.studySize = '18'
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (stored?.version === 1 && sizes.includes(stored.size)) {
        setSize(stored.size)
        document.documentElement.dataset.studySize = String(stored.size)
      }
    } catch {
      /* Reading remains available when storage is blocked. */
    }
  }, [])
  function choose(next: number) {
    setSize(next)
    document.documentElement.dataset.studySize = String(next)
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, size: next }))
      setMessage('')
    } catch {
      setMessage(
        '지금 화면에는 적용했지만 다음 방문을 위한 설정은 저장하지 못했어요.',
      )
    }
  }
  return (
    <div className="study-reading-controls">
      <fieldset
        className="flex flex-wrap items-center gap-2"
        aria-label="읽기 글자 크기"
      >
        <legend className="sr-only">읽기 글자 크기</legend>
        <span className="mr-2 text-[15px] text-muted" aria-hidden="true">
          읽기 크기
        </span>
        {sizes.map((n, i) => (
          <button
            key={n}
            type="button"
            aria-pressed={size === n}
            onClick={() => choose(n)}
            className="min-h-11 rounded-lg border border-line px-4 py-2 text-[15px] text-ink aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            {['기본', '크게', '더 크게'][i]}
          </button>
        ))}
      </fieldset>
      {message && (
        <p role="status" className="study-meta mt-2">
          {message}
        </p>
      )}
    </div>
  )
}
