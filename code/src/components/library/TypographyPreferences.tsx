'use client'
import { useEffect, useId, useRef, useState } from 'react'

const KEY = 'pathfinder.typography.v1'
const options = [
  {
    id: 'presentation',
    title: '또렷한 PT',
    fonts: '페이퍼로지 · SUIT',
    note: '추천',
  },
  { id: 'friendly', title: '부드러운 앱', fonts: 'LINE Seed · SUIT' },
  { id: 'book', title: '차분한 책', fonts: '고운바탕 · SUIT' },
  { id: 'original', title: '기존 글꼴', fonts: 'SUITE · Wanted Sans' },
] as const
type Choice = (typeof options)[number]['id']
function valid(value: unknown): value is Choice {
  return options.some((o) => o.id === value)
}
export function TypographyPreferences() {
  const ref = useRef<HTMLFieldSetElement>(null)
  const name = useId()
  const [choice, setChoice] = useState<Choice>('presentation')
  const [message, setMessage] = useState('')
  function apply(next: Choice) {
    setChoice(next)
    ref.current
      ?.closest<HTMLElement>('.study-desk')
      ?.setAttribute('data-typography', next)
  }
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      apply(
        stored?.version === 1 && valid(stored.choice)
          ? stored.choice
          : 'presentation',
      )
    } catch {
      apply('presentation')
    }
  }, [])
  function choose(next: Choice) {
    apply(next)
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: 1, choice: next }))
      setMessage('')
    } catch {
      setMessage('글꼴은 바뀌었지만 다음 방문을 위한 설정은 저장하지 못했어요.')
    }
  }
  return (
    <fieldset ref={ref} className="desk-font-choices">
      <legend>글꼴 조합</legend>
      {options.map((o) => (
        <label key={o.id} className="desk-font-choice">
          <input
            type="radio"
            name={name}
            value={o.id}
            checked={choice === o.id}
            onChange={() => choose(o.id)}
          />
          <span>
            <strong className={'desk-font-sample font-sample-' + o.id}>
              {o.title}
            </strong>
            <small>{o.fonts}</small>
          </span>
          {'note' in o && <em>{o.note}</em>}
        </label>
      ))}
      <p className="desk-font-hint">
        제목 · 본문 순서예요. 선택하면 지금 읽는 화면에 적용돼요.
      </p>
      <a
        className="desk-font-credits"
        href="/library/fonts/NOTICE.txt"
        target="_blank"
        rel="noopener noreferrer"
      >
        글꼴 출처 ↗
      </a>
      {message && (
        <p className="desk-font-hint" role="status">
          {message}
        </p>
      )}
    </fieldset>
  )
}
