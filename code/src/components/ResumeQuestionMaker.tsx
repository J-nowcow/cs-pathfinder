'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/client'
import {
  deserializeResumeQuestions,
  RESUME_QUESTIONS_STORAGE_KEY,
  serializeResumeQuestions,
  type ResumeQuestion,
} from '@/lib/personalize/resume-storage'
import { MAX_RESUME_LENGTH, MIN_RESUME_LENGTH } from '@/lib/personalize/resume-constants'

type Phase = 'idle' | 'working'

const WAITING_COPY = [
  '경험에서 기술 근거를 찾는 중',
  '선택 이유와 트레이드오프를 나누는 중',
  '질문 5개를 다듬는 중',
] as const

function displayDate(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

export function ResumeQuestionMaker() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [waitingIndex, setWaitingIndex] = useState(0)
  const [error, setError] = useState('')
  const [questions, setQuestions] = useState<ResumeQuestion[]>([])
  const [createdAt, setCreatedAt] = useState('')
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null)

  useEffect(() => {
    const saved = deserializeResumeQuestions(
      window.localStorage.getItem(RESUME_QUESTIONS_STORAGE_KEY),
    )
    if (!saved) return
    setQuestions(saved.questions)
    setCreatedAt(saved.createdAt)
  }, [])

  useEffect(() => {
    if (phase !== 'working') return
    setWaitingIndex(0)
    const timer = window.setInterval(() => {
      setWaitingIndex((value) => Math.min(value + 1, WAITING_COPY.length - 1))
    }, 6_000)
    return () => window.clearInterval(timer)
  }, [phase])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (phase === 'working' || !session) return
    setPhase('working')
    setError('')

    try {
      const response = await fetch('/api/personalize/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = (await response.json()) as {
        error?: string
        detail?: string
        questions?: ResumeQuestion[]
        quota?: { used: number; limit: number }
      }
      if (!response.ok || !data.questions) {
        if (data.error === 'quota_exceeded') {
          throw new Error('오늘 만들 수 있는 맞춤 질문을 다 쓴 상태입니다. 내일 다시 시도해 주세요.')
        }
        throw new Error(data.detail || '질문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }

      const now = new Date().toISOString()
      window.localStorage.setItem(
        RESUME_QUESTIONS_STORAGE_KEY,
        serializeResumeQuestions(data.questions, now),
      )
      setQuestions(data.questions)
      setCreatedAt(now)
      setQuota(data.quota ?? null)
      setText('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '질문을 만들지 못했습니다.')
    } finally {
      setPhase('idle')
    }
  }

  function clearQuestions() {
    window.localStorage.removeItem(RESUME_QUESTIONS_STORAGE_KEY)
    setQuestions([])
    setCreatedAt('')
  }

  return (
    <section aria-labelledby="resume-question-title">
      <h2 id="resume-question-title" className="text-lg font-semibold">
        내 경험에서 질문 만들기
      </h2>
      <p className="mt-1 text-sm leading-[1.7] text-muted">
        레쥬메의 기술 경험을 읽고 면접에서 받을 법한 CS 질문 5개를 만듭니다.
        이력서를 채점하지는 않습니다.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        {sessionPending ? (
          <p role="status" className="flex min-h-11 items-center gap-2 text-sm text-muted">
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border-2 border-faint/30 border-t-faint"
            />
            로그인 상태를 확인하는 중
          </p>
        ) : !session ? (
          <div>
            <p className="text-sm leading-[1.7] text-muted">
              맞춤 질문은 로그인한 뒤 만들 수 있습니다. 원문은 계정에 저장하지 않습니다.
            </p>
            <a
              href="#account"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium no-underline transition-colors hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              로그인하러 가기
            </a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="resume-text" className="text-sm font-medium">
              레쥬메 내용
            </label>
            <textarea
              id="resume-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              minLength={MIN_RESUME_LENGTH}
              maxLength={MAX_RESUME_LENGTH}
              rows={9}
              disabled={phase === 'working'}
              placeholder="담당한 일, 사용한 기술, 문제를 해결한 방법을 중심으로 붙여 넣어 주세요."
              aria-describedby="resume-help resume-count"
              className="mt-2 w-full resize-y rounded-lg border border-line bg-raised px-3 py-3 text-[15px] leading-[1.65] outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
            <div className="mt-2 flex items-start justify-between gap-4 text-[13px] leading-[1.6] text-faint">
              <p id="resume-help">
                이름·연락처·회사 내부정보는 지우고 넣어 주세요. 원문은 저장하지 않지만
                질문을 만들기 위해 Google Gemini로 보냅니다.
              </p>
              <span id="resume-count" className="shrink-0 tabular-nums">
                {text.length.toLocaleString('ko-KR')}/{MAX_RESUME_LENGTH.toLocaleString('ko-KR')}
              </span>
            </div>

            {phase === 'working' && (
              <div
                role="status"
                aria-live="polite"
                className="mt-4 flex min-h-11 items-center gap-3 rounded-lg bg-accent-soft px-3 text-sm text-ink"
              >
                <span
                  aria-hidden
                  className="size-4 shrink-0 animate-spin rounded-full border-2 border-accent/25 border-t-accent"
                />
                {WAITING_COPY[waitingIndex]}
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={phase === 'working' || text.trim().length < MIN_RESUME_LENGTH}
              className="mt-4 min-h-11 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
            >
              {phase === 'working' ? '질문 만드는 중' : '맞춤 질문 5개 만들기'}
            </button>
            {quota && (
              <p className="mt-2 text-[13px] text-faint">
                오늘 {quota.used}/{quota.limit}번 사용했습니다.
              </p>
            )}
          </form>
        )}
      </div>

      {questions.length === 5 && (
        <div className="mt-5" aria-live="polite">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="font-semibold">맞춤 질문 5개</h3>
              {createdAt && (
                <p className="mt-1 text-[13px] text-faint">
                  {displayDate(createdAt)}에 만들었습니다. 이 브라우저에만 남습니다.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearQuestions}
              className="min-h-11 shrink-0 rounded-md px-2 text-sm text-faint transition-colors hover:text-warn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              질문 지우기
            </button>
          </div>
          <ol className="mt-3 flex list-none flex-col gap-3 p-0">
            {questions.map((question, index) => (
              <li key={`${question.text}-${index}`} className="rounded-xl border border-line bg-raised p-4">
                <p className="font-medium leading-[1.65]">{question.text}</p>
                <p className="mt-2 text-sm leading-[1.6] text-muted">
                  <span className="text-faint">질문 근거</span> · {question.basis}
                </p>
                <Link
                  href={`/questions?q=${encodeURIComponent(question.topic)}`}
                  className="mt-3 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-accent no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {question.topic} 관련 질문 찾기
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
