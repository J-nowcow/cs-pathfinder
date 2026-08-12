'use client'

import { useEffect, useRef, useState } from 'react'
import type { JourneyState } from '@/lib/journey/types'
import { MAX_TITLE_LENGTH } from '@/lib/tree/title'

/**
 * 판 경로를 링크로 만든다.
 *
 * 제목을 미리 채워둔다. 빈 칸을 주면 대부분 그냥 지나치고, 지나친 트리는 게시판에서
 * 서로 구분되지 않는다. 첫 질문이 이미 좋은 이름이라 그대로 두면 되고 고치고 싶은
 * 사람만 고치면 된다.
 */

type Phase =
  | { kind: 'closed' }
  | { kind: 'editing' }
  | { kind: 'creating' }
  | { kind: 'done'; url: string }
  | { kind: 'failed'; message: string }

export function ShareSheet({ journey }: { journey: JourneyState }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'closed' })
  const [title, setTitle] = useState('')
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const root = journey.occurrences.find((o) => o.parentId === null)

  // 뿌리 하나뿐이면 공유할 트리가 아니라 질문 하나다. 그건 이미 /q 주소가 있다
  const worthSharing = journey.occurrences.length >= 2

  const open = () => {
    setTitle(root?.question ?? '')
    setCopied(false)
    setPhase({ kind: 'editing' })
  }

  const close = () => {
    setPhase({ kind: 'closed' })
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  useEffect(() => {
    if (phase.kind === 'editing') inputRef.current?.focus()
  }, [phase.kind])

  useEffect(() => {
    if (phase.kind === 'closed') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind])

  const create = async () => {
    if (!journey.currentId) return
    setPhase({ kind: 'creating' })

    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          // 서버가 쓰는 건 구조뿐이다. 질문 문장은 서버가 DB에서 다시 읽는다
          occurrences: journey.occurrences.map((o) => ({
            id: o.id,
            node_id: o.nodeId,
            parent_id: o.parentId,
          })),
          current_id: journey.currentId,
          title,
        }),
      })

      const body = await res.json().catch(() => null)

      if (!res.ok) {
        setPhase({
          kind: 'failed',
          message: body?.detail ?? '링크를 만들지 못했습니다. 잠시 뒤에 다시 시도해 주세요.',
        })
        return
      }

      setPhase({ kind: 'done', url: new URL(body.url, window.location.origin).toString() })
    } catch {
      // 네트워크가 끊긴 경우다. 서버 사유가 없으니 지어내지 않는다
      setPhase({ kind: 'failed', message: '연결이 끊겼습니다. 잠시 뒤에 다시 시도해 주세요.' })
    }
  }

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // 클립보드 권한이 없거나 보안 컨텍스트가 아니다. 주소를 골라주면 직접 복사할 수 있다
      inputRef.current?.select()
    }
  }

  if (!worthSharing) return null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="rounded-md border border-line bg-raised px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        공유
      </button>

      {phase.kind !== 'closed' && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6"
          onClick={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="질문 지도 공유하기"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-xl border border-line bg-raised p-6 shadow-xl sm:rounded-xl"
          >
            {phase.kind === 'done' ? (
              <Done
                url={phase.url}
                copied={copied}
                onCopy={() => void copy(phase.url)}
                onClose={close}
                inputRef={inputRef}
              />
            ) : (
              <>
                <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">
                  질문 지도 공유하기
                </h2>
                <p className="mt-2 text-[13px] leading-[1.65] text-muted">
                  지금까지 이어간 질문 {journey.occurrences.length}개가 그 모습 그대로 남습니다. 나중에
                  다른 길이 생겨도 이 질문 지도는 바뀌지 않습니다.
                </p>

                <label htmlFor="share-title" className="mt-5 block text-[13px] font-medium text-muted">
                  제목
                </label>
                <input
                  id="share-title"
                  ref={inputRef}
                  value={title}
                  maxLength={MAX_TITLE_LENGTH}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={phase.kind === 'creating'}
                  className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-accent disabled:opacity-60"
                />
                <p className="mt-1.5 text-[12px] text-faint">
                  비워두면 첫 질문이 제목이 됩니다.
                </p>

                {phase.kind === 'failed' && (
                  <p
                    role="status"
                    className="mt-4 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] leading-[1.6] text-ink"
                  >
                    {phase.message}
                  </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md px-4 py-2.5 text-[14px] font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={() => void create()}
                    disabled={phase.kind === 'creating'}
                    aria-busy={phase.kind === 'creating' || undefined}
                    className={`inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      phase.kind === 'creating'
                        ? 'cursor-wait disabled:opacity-100'
                        : 'disabled:opacity-60'
                    }`}
                  >
                    {phase.kind === 'creating' && (
                      <span
                        aria-hidden
                        className="size-3.5 animate-spin rounded-full border-2 border-on-accent/35 border-t-on-accent"
                      />
                    )}
                    {phase.kind === 'creating' ? '만드는 중' : '링크 만들기'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function Done({
  url,
  copied,
  onCopy,
  onClose,
  inputRef,
}: {
  url: string
  copied: boolean
  onCopy: () => void
  onClose: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  // OS 공유 시트가 있으면 그걸 연다. 이 서비스의 목적지가 카톡이라
  // 링크를 복사해서 앱을 옮겨 다니는 것보다 한 단계 짧다
  const canShareNatively = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <>
      <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">링크가 생겼습니다</h2>
      <p className="mt-2 text-[13px] leading-[1.65] text-muted">
        이 주소를 받은 사람은 질문 지도를 그대로 보고, 같은 자리에서 학습을 이어갈 수 있습니다.
      </p>

      <input
        ref={inputRef}
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="mt-5 w-full rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-[13px] text-ink outline-none focus:border-accent"
      />

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-4 py-2.5 text-[14px] font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          열어보기
        </a>

        {canShareNatively && (
          <button
            type="button"
            onClick={() => void navigator.share({ url }).catch(() => undefined)}
            className="rounded-md border border-line px-4 py-2.5 text-[14px] font-medium text-ink hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            보내기
          </button>
        )}

        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {copied ? '복사했습니다' : '주소 복사'}
        </button>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full text-[13px] text-faint hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        계속 학습하기
      </button>
    </>
  )
}
