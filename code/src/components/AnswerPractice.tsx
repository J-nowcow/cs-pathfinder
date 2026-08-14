'use client'

import { useEffect, useRef, useState } from 'react'
import { Prose } from '@/components/Prose'
import {
  MAX_ANSWER_LENGTH,
  emptyAnswerPractice,
  loadAnswerPractice,
  markAnswerReview,
  saveAnswerPractice,
  updateAnswerDraft,
  type AnswerPracticeState,
} from '@/lib/answer-practice/storage'

function reviewDateLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${year}년 ${month}월 ${date}일`
}

/** 면접 질문에 먼저 답하고, 필요할 때만 검증된 해설을 여는 자리. */
export function AnswerPractice({ nodeId, modelAnswer }: { nodeId: string; modelAnswer: string }) {
  const [state, setState] = useState<AnswerPracticeState>(emptyAnswerPractice)
  const [open, setOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved')
  const textarea = useRef<HTMLTextAreaElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingState = useRef<AnswerPracticeState | null>(null)

  useEffect(() => {
    const loaded = loadAnswerPractice()
    setState(loaded)
    setOpen(loaded.alwaysOpen)
  }, [nodeId])

  useEffect(
    () => {
      const flushPendingSave = (showResult: boolean) => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = null
        if (!pendingState.current) return
        const saved = saveAnswerPractice(pendingState.current)
        pendingState.current = null
        if (showResult) setSaveStatus(saved ? 'saved' : 'failed')
      }
      const handlePageHide = () => flushPendingSave(true)
      window.addEventListener('pagehide', handlePageHide)
      return () => {
        window.removeEventListener('pagehide', handlePageHide)
        flushPendingSave(false)
      }
    },
    [],
  )

  const text = state.drafts[nodeId]?.text ?? ''
  const reviewStatus = state.reviews[nodeId]?.status
  const nextReviewOn = state.reviews[nodeId]?.nextReviewOn
  const persist = (next: AnswerPracticeState, deferred = false) => {
    setState(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    pendingState.current = null
    if (!deferred) {
      setSaveStatus(saveAnswerPractice(next) ? 'saved' : 'failed')
      return
    }

    pendingState.current = next
    setSaveStatus('saving')
    saveTimer.current = setTimeout(() => {
      pendingState.current = null
      setSaveStatus(saveAnswerPractice(next) ? 'saved' : 'failed')
    }, 300)
  }

  return (
    <section aria-labelledby="answer-practice-title" className="space-y-3">
      <h2 id="answer-practice-title" className="sr-only">답변 연습</h2>
      <details
        open={open}
        onToggle={(event) => {
          const next = event.currentTarget.open
          setOpen(next)
          if (next) requestAnimationFrame(() => textarea.current?.focus())
        }}
        className="group rounded-xl border border-line bg-raised"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span>내 답변 적어보기</span>
          <span className="flex items-center gap-2 text-[12px] font-normal text-faint">
            {text ? '초안 있음' : '접힘'}
            <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="border-t border-line p-4">
          <label htmlFor={`answer-${nodeId}`} className="text-[13px] text-muted">
            실제 면접처럼 핵심부터 말해 보세요.
          </label>
          <textarea
            ref={textarea}
            id={`answer-${nodeId}`}
            value={text}
            maxLength={MAX_ANSWER_LENGTH}
            rows={7}
            onChange={(event) =>
              persist(
                updateAnswerDraft(state, nodeId, event.target.value, new Date().toISOString()),
                true,
              )
            }
            aria-describedby={`answer-save-${nodeId}`}
            className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-3 py-3 text-[15px] leading-[1.65] outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
            placeholder="결론 → 이유 → 예시 순으로 적어 보세요."
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[12px] text-faint">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={state.alwaysOpen}
                onChange={(event) => persist({ ...state, alwaysOpen: event.target.checked })}
              />
              다음 질문에서도 답변칸 펼치기
            </label>
            <span className="ml-auto flex min-h-11 items-center gap-3">
              <span id={`answer-save-${nodeId}`} aria-live="polite">
                {saveStatus === 'saved'
                  ? `이 브라우저에 자동 저장 · ${text.length.toLocaleString('ko-KR')}자`
                  : saveStatus === 'saving'
                    ? '저장 중…'
                    : '저장하지 못했습니다'}
              </span>
              {text && (
                <button
                  type="button"
                  onClick={() =>
                    persist(updateAnswerDraft(state, nodeId, '', new Date().toISOString()))
                  }
                  className="rounded-sm text-faint hover:text-warn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  초안 지우기
                </button>
              )}
            </span>
          </div>
        </div>
      </details>

      <details className="group rounded-xl border border-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span>모범답안 확인하기</span>
          <span className="flex items-center gap-2 text-[12px] font-normal text-faint">
            내 답변 뒤에 열어보세요
            <span aria-hidden className="transition-transform group-open:rotate-180">⌄</span>
          </span>
        </summary>
        <div className="border-t border-line px-4 py-5 sm:px-5">
          <Prose body={modelAnswer} />
          {text && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[13px] font-medium">내 답과 비교해 보니 어떤가요?</p>
              <p className="mt-1 text-[12px] text-muted">점수 대신 다음 복습에 필요한 표시만 남깁니다.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={reviewStatus === 'needs-review'}
                  onClick={() =>
                    persist(markAnswerReview(state, nodeId, 'needs-review', new Date().toISOString()))
                  }
                  className="min-h-11 rounded-lg border border-line px-3 text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  다시 볼래요
                </button>
                <button
                  type="button"
                  aria-pressed={reviewStatus === 'understood'}
                  onClick={() =>
                    persist(markAnswerReview(state, nodeId, 'understood', new Date().toISOString()))
                  }
                  className="min-h-11 rounded-lg border border-line px-3 text-[13px] aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  설명할 수 있어요
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
      {nextReviewOn && (
        <p role="status" aria-live="polite" className="px-1 text-[12px] text-muted">
          다음 복습일 {reviewDateLabel(nextReviewOn)}
        </p>
      )}
    </section>
  )
}
