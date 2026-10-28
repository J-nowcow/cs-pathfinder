'use client'

import { useEffect, useState } from 'react'

/** All authored steps stay readable; playback only moves the emphasis. */
export function ConceptSteps({ steps }: { steps: string[] }) {
  const [active, setActive] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setReduced(preference.matches)
      if (preference.matches) setPlaying(false)
    }
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false)
    }
    update()
    setReady(true)
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      preference.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
    }
  }, [])

  useEffect(() => {
    if (!playing || reduced || active === null) return
    const timer = window.setTimeout(() => {
      if (active + 1 < steps.length) setActive(active + 1)
      else setPlaying(false)
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [playing, reduced, active, steps.length])

  const select = (index: number | null) => {
    setPlaying(false)
    setActive(index)
  }
  return (
    <div className="step-player" data-playing={playing}>
      <div className="step-controls" role="group" aria-label="설명 순서 보기">
        {!reduced && (
          <button
            type="button"
            className="pmp-action"
            disabled={!ready || !steps.length}
            onClick={() => {
              if (playing) setPlaying(false)
              else {
                setActive(0)
                setPlaying(true)
              }
            }}
          >
            {playing ? '일시정지' : '순서대로 보기'}
          </button>
        )}
        <button
          type="button"
          className="pmp-action"
          disabled={!ready || active === steps.length - 1}
          onClick={() => select(active === null ? 0 : active + 1)}
        >
          다음 단계
        </button>
        <button
          type="button"
          className="pmp-action"
          disabled={!ready || active === null}
          onClick={() => select(null)}
        >
          전체 보기
        </button>
        <span className="step-position" role="status">
          {active === null ? '전체 순서' : `${active + 1}/${steps.length}단계`}
        </span>
      </div>
      <ol className="pmp-steps">
        {steps.map((step, i) => (
          <li key={i} data-complete={active !== null && i < active}>
            <button
              type="button"
              disabled={!ready}
              aria-current={active === i ? 'step' : undefined}
              onClick={() => select(i)}
            >
              <span className="step-number" aria-hidden="true">
                {i + 1}
              </span>
              <span>{step}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
