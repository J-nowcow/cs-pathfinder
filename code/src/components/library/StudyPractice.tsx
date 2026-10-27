'use client'
import { useEffect, useState } from 'react'
import {
  loadLibrary,
  saveLibrary,
  updateStudy,
  type StudyEntry,
} from '@/lib/library/storage'
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
    [ready, setReady] = useState(false),
    [message, setMessage] = useState('')
  useEffect(() => {
    const state = loadLibrary()
    setEntry(state.entries[id] ?? null)
    setReady(true)
    if (visit) {
      const next = updateStudy(
        state,
        id,
        { title, href, track },
        {},
        new Date().toISOString(),
      )
      if (next) {
        setEntry(next.entries[id])
        if (!saveLibrary(next))
          setMessage(
            '기록을 저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.',
          )
      }
    }
  }, [id, title, href, track, visit])
  const persist = (change: Parameters<typeof updateStudy>[3]) => {
    const stored = loadLibrary()
    if (
      entry &&
      (!stored.entries[id] || entry.updatedAt >= stored.entries[id].updatedAt)
    )
      stored.entries[id] = entry
    const next = updateStudy(
      stored,
      id,
      { title, href, track },
      change,
      new Date().toISOString(),
    )
    if (!next) {
      setMessage(
        '기록 한도 또는 형식을 확인해 주세요. 현재 초안을 복사해 보관해 주세요.',
      )
      return
    }
    setEntry(next.entries[id])
    setMessage(
      saveLibrary(next)
        ? '이 브라우저에 저장했어요.'
        : '저장하지 못했어요. 현재 초안을 복사해 보관해 주세요.',
    )
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
        value={entry?.draft ?? ''}
        onChange={(e) => persist({ draft: e.target.value })}
      />
      <p className="study-meta text-faint">
        {entry?.draft.length ?? 0}/6,000자 · 브라우저 저장 · 계정 동기화 없음
      </p>
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
                    checks: e.target.checked
                      ? [...(entry?.checks ?? []), x]
                      : (entry?.checks ?? []).filter((v) => v !== x),
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
          onClick={() => persist({ status: 'review' })}
        >
          내일 다시 설명하기
        </button>
        <button
          disabled={!ready}
          aria-pressed={entry?.status === 'comfortable'}
          className={libraryButton}
          onClick={() => persist({ status: 'comfortable' })}
        >
          설명 가능 · 3일 뒤 복습
        </button>
        <button
          disabled={!ready}
          className={libraryButton}
          onClick={() => persist({ status: 'learning' })}
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
