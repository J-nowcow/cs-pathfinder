'use client'
import { useEffect, useId, useRef, useState } from 'react'
import {
  PMP_EVENT,
  PMP_KEY,
  pmpField,
  pmpText,
  readPmp,
  savePmp,
  changePmp,
  type PmpData,
  type PmpChange,
} from '@/lib/pmp/storage'
import type { PmpQuestion } from '@/lib/pmp/questions'
export function PmpPractice({
  question: q,
  visit = false,
}: {
  question: PmpQuestion
  visit?: boolean
}) {
  const [data, setData] = useState<PmpData>({ version: 1 })
  const [note, setNote] = useState(''),
    [thought, setThought] = useState('')
  const baseline = useRef({ notes: '', thoughts: '' })
  const [choice, setChoice] = useState<number | null>(null)
  const [message, setMessage] = useState(''),
    [ready, setReady] = useState(false)
  const [notice, setNotice] = useState<'idle' | 'saved' | 'error' | 'input'>('idle')
  const formName = useId(),
    id = q.id
  useEffect(() => {
    try {
      const state = visit
        ? savePmp(localStorage, { kind: 'visit', id })
        : readPmp(localStorage.getItem(PMP_KEY))
      setData(state)
      const notes = pmpText(state, 'notes', id),
        thoughts = pmpText(state, 'thoughts', id)
      baseline.current = { notes, thoughts }
      setNote(notes)
      setThought(thoughts)
      window.dispatchEvent(new Event(PMP_EVENT))
    } catch (e) {
      setNotice('error')
      setMessage(
        e instanceof Error
          ? e.message
          : 'PMP 기록을 읽거나 저장하지 못했어요. 기존 기록은 덮어쓰지 않았어요.',
      )
    }
    setReady(true)
  }, [id, visit])
  function change(action: PmpChange) {
    try {
      const next = savePmp(localStorage, action)
      setData(next)
      if (action.kind === 'text') baseline.current[action.field] = action.text
      setNotice('saved')
      setMessage('이 브라우저에 저장했어요.')
      window.dispatchEvent(new Event(PMP_EVENT))
      return true
    } catch (e) {
      setNotice('error')
      if (action.kind === 'answer' || action.kind === 'retry') {
        try {
          setData(changePmp(data, action))
        } catch {
          /* Keep current screen. */
        }
      }
      setMessage(
        (e instanceof Error ? e.message : '저장소에 접근하지 못했어요.') +
          ' 저장되지 않았어요. 입력한 글과 판단 결과는 현재 화면에만 남아요.',
      )
      return false
    }
  }
  const raw = pmpField(data, 'answers')[id] as
    | { index?: number; at?: string }
    | undefined
  const index =
    raw && Number.isInteger(raw.index) && q.options[raw.index!]
      ? raw.index
      : undefined
  const answered = index !== undefined
  return (
    <div className="pmp-practice">
      <section aria-labelledby={formName + '-title'} className="pmp-judgment">
        <p className="study-meta">직접 만든 상황 문제</p>
        <h2 id={formName + '-title'}>{q.scene}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (choice === null) {
              setNotice('input')
              setMessage('답 하나를 선택해 주세요.')
              return
            }
            change({ kind: 'answer', id, index: choice })
          }}
        >
          <fieldset disabled={!ready || answered}>
            <legend>가장 적절한 답 하나를 고르세요.</legend>
            {q.options.map((option, i) => (
              <label key={i} className="pmp-choice">
                <input
                  type="radio"
                  name={formName}
                  value={i}
                  checked={answered ? index === i : choice === i}
                  onChange={() => setChoice(i)}
                />
                <span>{option.text}</span>
              </label>
            ))}
          </fieldset>
          {answered ? (
            <button
              type="button"
              className="pmp-action"
              onClick={() => {
                if (change({ kind: 'retry', id })) setChoice(null)
              }}
            >
              다시 풀기
            </button>
          ) : (
            <button className="pmp-action" disabled={!ready}>
              이유 확인하기
            </button>
          )}
        </form>
        {answered && (
          <div
            className="pmp-answer-feedback"
            data-revealed={notice === 'saved' || notice === 'error'}
            aria-live="polite"
          >
            <h3>
              {q.options[index!].correct
                ? '판단 근거를 확인해요.'
                : '다른 선택이 더 적절해요.'}
            </h3>
            {q.options.map((o, i) => (
              <div key={i}>
                <strong>
                  {o.correct
                    ? '✓ 적절한 선택 · '
                    : i === index
                      ? '선택한 답 · '
                      : ''}
                  {o.text}
                </strong>
                <p>{o.why}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      {visit && (
        <section className="pmp-writing">
          <h2>내 말로 정리하기</h2>
          <p>{q.recall ?? ''}</p>
          <label htmlFor={formName + '-thought'}>회상 답변</label>
          <textarea
            id={formName + '-thought'}
            maxLength={12000}
            value={thought}
            disabled={!ready}
            onChange={(e) => {
              setThought(e.target.value)
              change({
                kind: 'text',
                id,
                field: 'thoughts',
                text: e.target.value,
                expected: baseline.current.thoughts,
              })
            }}
          />
          <label htmlFor={formName + '-note'}>내 메모</label>
          <textarea
            id={formName + '-note'}
            maxLength={12000}
            value={note}
            disabled={!ready}
            onChange={(e) => {
              setNote(e.target.value)
              change({
                kind: 'text',
                id,
                field: 'notes',
                text: e.target.value,
                expected: baseline.current.notes,
              })
            }}
          />
          <div
            className="pmp-review-buttons"
            role="group"
            aria-label="다시 볼 시점"
          >
            {(['again', 'hard', 'good'] as const).map((rating, i) => (
              <button
                key={rating}
                type="button"
                className="pmp-action"
                disabled={!ready}
                onClick={() => change({ kind: 'rating', id, rating })}
              >
                {['1분 뒤 다시 보기', '내일 다시 보기', '3일 뒤 다시 보기'][i]}
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="study-meta">
        현재 브라우저에 저장됩니다. 기존 PMP 기록과 같은 형식이며 계정 동기화는
        아직 연결 전입니다.
      </p>
      <p role="status" className="pmp-save-status" data-state={notice}>
        {notice === 'saved' && (
          <svg
            className="pmp-save-check"
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="9" />
            <path d="m5.5 10 3 3 6-6" pathLength="1" />
          </svg>
        )}
        {message}
      </p>
      <noscript>
        <p>
          본문은 그대로 읽을 수 있어요. 답 선택·메모·복습 저장은 JavaScript가
          필요합니다.
        </p>
      </noscript>
    </div>
  )
}
