'use client'
import { useEffect, useRef, useState } from 'react'
import { LIBRARY_EVENT, type StudyEntry } from '@/lib/library/storage'
import {
  editLibrary,
  readLibraryStrict,
  LibraryEditError,
  type LibraryEdit,
} from '@/lib/library/local-edit'
import { libraryButton } from './LibraryShell'
export function StudyPractice({
  id,
  title,
  href,
  track,
  checklist = [],
  visit = false,
}: {
  id: string
  title: string
  href: string
  track: 'engineer' | 'jira'
  checklist?: string[]
  visit?: boolean
}) {
  const [entry, setEntry] = useState<StudyEntry | null>(null),
    [draft, setDraft] = useState(''),
    [unsaved, setUnsaved] = useState(false),
    [conflictDraft, setConflictDraft] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState('')
  const baseline = useRef('')
  const pending = useRef(new Map<string, { text: string; expected: string }>())
  const failureMessage = (error: unknown) =>
    error instanceof LibraryEditError && error.code === 'conflict'
      ? '다른 화면에서 기록이 바뀌었어요. 현재 입력과 저장된 기록은 덮어쓰지 않았어요. 답안을 복사해 둔 뒤 저장된 답안과 비교해 주세요.'
      : error instanceof LibraryEditError &&
          (error.code === 'read' || error.code === 'format')
        ? '저장된 기록을 온전히 읽지 못했어요. 기존 기록은 바꾸지 않았어요. 현재 답안은 복사해 보관해 주세요.'
        : '저장하지 못했어요. 현재 답안은 화면에 남아 있어요. 기록 한도와 브라우저 저장 설정을 확인하고 답안을 복사해 보관해 주세요.'
  useEffect(() => {
    const held = pending.current.get(id)
    setReady(false)
    setEntry(null)
    setDraft(held?.text ?? '')
    setConflictDraft(null)
    try {
      const state = visit
        ? editLibrary(
            localStorage,
            id,
            { title, href, track },
            { kind: 'visit' },
            new Date().toISOString(),
          )
        : readLibraryStrict(localStorage)
      const found = state.entries[id]
      setEntry(found ?? null)
      setDraft(held?.text ?? found?.draft ?? '')
      baseline.current = held?.expected ?? found?.draft ?? ''
      setUnsaved(Boolean(held))
      if (held && held.text !== found?.draft)
        setConflictDraft(found?.draft ?? '')
      setMessage('')
      if (visit) window.dispatchEvent(new Event(LIBRARY_EVENT))
    } catch (error) {
      setMessage(failureMessage(error))
    }
    setReady(true)
  }, [id, title, href, track, visit])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pending.current.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const persist = (action: LibraryEdit, input = draft) => {
    try {
      const next = editLibrary(
        localStorage,
        id,
        { title, href, track },
        action,
        new Date().toISOString(),
      )
      const saved = next.entries[id]
      setEntry(saved)
      const same = saved.draft === input
      setUnsaved(!same)
      if (same) {
        baseline.current = input
        setConflictDraft(null)
        pending.current.delete(id)
      } else {
        setConflictDraft(saved.draft)
        pending.current.set(id, { text: input, expected: baseline.current })
      }
      setMessage(
        same
          ? '이 브라우저에 저장했어요.'
          : '점검 내용은 저장했어요. 화면의 답안은 아직 저장되지 않았어요. 복사해 둔 뒤 저장된 답안과 비교해 주세요.',
      )
      window.dispatchEvent(new Event(LIBRARY_EVENT))
    } catch (error) {
      if (action.kind === 'draft') {
        setUnsaved(true)
        pending.current.set(id, { text: input, expected: baseline.current })
      }
      setMessage(failureMessage(error))
      try {
        setConflictDraft(
          readLibraryStrict(localStorage).entries[id]?.draft ?? null,
        )
      } catch {}
    }
  }
  return (
    <section
      aria-label={title + ' 답안 연습'}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-7"
    >
      <h3 className="text-xl font-semibold">내 말로 써보기</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        답안을 쓴 뒤 아래 항목으로 점검하세요. 입력한 답안은 자동 채점되지
        않습니다.
      </p>
      <label className="mt-5 block text-sm" htmlFor={'draft-' + id}>
        내 답안
      </label>
      <textarea
        disabled={!ready}
        id={'draft-' + id}
        className="mt-2 w-full rounded-lg border border-line bg-raised p-3 text-base leading-7"
        rows={7}
        maxLength={6000}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          persist(
            { kind: 'draft', text: e.target.value, expected: baseline.current },
            e.target.value,
          )
        }}
      />
      <p className="study-meta text-faint">
        {draft.length}/6,000자 · 브라우저 저장 · 계정 동기화 없음
      </p>
      {unsaved && (
        <p className="study-meta" role="alert">
          아직 저장되지 않은 답안이 있어요. 화면을 닫기 전에 복사해 주세요.
        </p>
      )}
      {conflictDraft !== null && conflictDraft !== draft && (
        <details className="mt-4">
          <summary>저장된 답안과 비교하기</summary>
          <p className="whitespace-pre-wrap break-words mt-3">
            {conflictDraft || '저장된 답안은 비어 있어요.'}
          </p>
        </details>
      )}
      {checklist.length > 0 && (
        <fieldset className="mt-5 space-y-3">
          <legend className="mb-3 font-medium">내 답안 점검</legend>
          {checklist.map((x) => (
            <label key={x} className="flex items-start gap-3 text-sm leading-6">
              <input
                className="mt-1"
                type="checkbox"
                disabled={!ready}
                checked={entry?.checks.includes(x) ?? false}
                onChange={(e) =>
                  persist({
                    kind: 'check',
                    value: x,
                    checked: e.target.checked,
                  })
                }
              />
              {x}
            </label>
          ))}
        </fieldset>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          disabled={!ready}
          aria-pressed={entry?.status === 'review'}
          className={libraryButton}
          onClick={() => persist({ kind: 'review', status: 'review' })}
        >
          내일 다시 설명하기
        </button>
        <button
          disabled={!ready}
          aria-pressed={entry?.status === 'comfortable'}
          className={libraryButton}
          onClick={() => persist({ kind: 'review', status: 'comfortable' })}
        >
          설명 가능 · 3일 뒤 복습
        </button>
        <button
          disabled={!ready}
          className={libraryButton}
          onClick={() => persist({ kind: 'review', status: 'learning' })}
        >
          학습 중으로
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-muted">
        {message}
        {entry?.due ? ' · 다음 복습 ' + entry.due : ''}
      </p>
    </section>
  )
}
