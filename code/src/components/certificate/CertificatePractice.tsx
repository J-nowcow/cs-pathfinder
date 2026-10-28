'use client'
import { useEffect, useRef, useState } from 'react'
import {
  CERTIFICATE_EVENT,
  saveCertificate,
  type CertificateEntry,
  type CertificateChange,
} from '@/lib/certificate/storage'
import { certificateCatalog as certificateLessons } from '@/lib/certificate/catalog'
import { libraryButton } from '@/components/library/LibraryShell'
export function CertificatePractice({ id, recallAnswer }: { id: string; recallAnswer: string }) {
  const [entry, setEntry] = useState<CertificateEntry | null>(null),
    [draft, setDraft] = useState(''),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState('')
  const input = useRef<HTMLTextAreaElement>(null)
  const baseline = useRef(''),
    lesson = certificateLessons.get(id)!
  useEffect(() => {
    try {
      const next = saveCertificate(localStorage, id, { kind: 'visit' })
      setEntry(next.entries[id])
      setDraft(next.entries[id].draft)
      baseline.current = next.entries[id].draft
      window.dispatchEvent(new Event(CERTIFICATE_EVENT))
    } catch {
      setMessage(
        '기록을 읽거나 저장하지 못했어요. 입력한 메모는 따로 복사해 보관해 주세요.',
      )
    }
    setReady(true)
  }, [id])
  function persist(action: CertificateChange) {
    try {
      const next = saveCertificate(localStorage, id, action)
      setEntry(next.entries[id])
      if (action.kind === 'draft') baseline.current = action.text
      setMessage(action.kind === 'check'
        ? '점검 항목을 이 브라우저에 저장했어요.'
        : action.kind === 'review'
          ? '복습 예약을 이 브라우저에 저장했어요.'
          : '메모를 이 브라우저에 저장했어요.')
      window.dispatchEvent(new Event(CERTIFICATE_EVENT))
    } catch (e) {
      setMessage(
        (e instanceof Error ? e.message : '저장하지 못했어요.') +
          ' 현재 입력은 화면에 남아 있어요.',
      )
    }
  }
  const hasUnsavedDraft = ready && draft !== baseline.current
  const metaId = 'certificate-meta-' + id
  const unsavedId = 'certificate-unsaved-' + id
  return (
    <section className="pmp-practice" aria-label="정처기 회상 메모">
      <h2>개념 확인</h2>
      <p>{lesson.recall}</p>
      <label htmlFor={'certificate-' + id}>내 설명·메모</label>
      <textarea
        ref={input}
        id={'certificate-' + id}
        rows={6}
        maxLength={6000}
        aria-describedby={hasUnsavedDraft ? metaId + ' ' + unsavedId : metaId}
        disabled={!ready}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          persist({
            kind: 'draft',
            text: e.target.value,
            expected: baseline.current,
          })
        }}
      />
      <p id={metaId} className="study-meta">
        {draft.length}/6,000자 · 브라우저 저장 · 계정 동기화 없음
      </p>
      {hasUnsavedDraft && (
        <div className="my-3 grid justify-items-start gap-2">
          <p id={unsavedId}>메모가 아직 저장되지 않았어요. 다시 저장하거나 입력한 글을 복사해 보관해 주세요.</p>
          <button className={libraryButton} onClick={() => {
            persist({ kind: 'draft', text: draft, expected: baseline.current })
            input.current?.focus()
          }}>
            메모 저장 다시 시도
          </button>
        </div>
      )}
      <fieldset>
        <legend>설명한 뒤 점검하기</legend>
        {lesson.checklist.map((value) => (
          <label className="certificate-check" key={value}>
            <input
              type="checkbox"
              disabled={!ready}
              checked={entry?.checks.includes(value) ?? false}
              onChange={(e) =>
                persist({ kind: 'check', value, checked: e.target.checked })
              }
            />
            {value}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button
          className={libraryButton}
          disabled={!ready}
          onClick={() => persist({ kind: 'review', interval: 1 })}
        >
          내일 다시 설명하기
        </button>
        <button
          className={libraryButton}
          disabled={!ready}
          onClick={() => persist({ kind: 'review', interval: 3 })}
        >
          3일 뒤 복습
        </button>
        <button
          className={libraryButton}
          disabled={!ready}
          onClick={() => persist({ kind: 'review', interval: 0 })}
        >
          복습 예약 해제
        </button>
      </div>
      <p role="status">
        {message}
        {entry?.due ? ' · 복습 ' + entry.due : ''}
      </p>
      <details>
        <summary>설명 예시 확인</summary>
        <p>{recallAnswer}</p>
        <p className="study-meta">
          암기한 문장과 같을 필요는 없어요. 개념의 기준과 예외가 맞는지
          비교하세요.
        </p>
      </details>
      <noscript>
        <p>
          본문과 설명 예시는 그대로 읽을 수 있어요. 메모·복습 저장에는
          JavaScript가 필요해요.
        </p>
      </noscript>
    </section>
  )
}
