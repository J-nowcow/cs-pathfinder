'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Turn } from '@/lib/chat/ask'

const MAX = 300
/** FreeInput과 같은 규칙 — 넉넉히 남았을 때는 숫자를 안 센다 */
const SHOW_REMAINING_AT = 20

/**
 * 이 해설에 대해 물어보기.
 *
 * 자유 입력창(질문 만들기)과 정반대의 성격이라 따로 산다 — 저쪽은 공용
 * 그래프에 남을 질문을 만들고, 여기는 아무 데도 남지 않는 대화다. QA에서
 * "쉽게 설명해 달라"가 게이트에 거부당한 것이 이 컴포넌트가 생긴 이유다.
 *
 * 오른쪽 탭에 접어 둔다. 챗은 보조 출구지 주 동선이 아니다. 모바일에서는
 * 본문을 가리는 폭을 줄이려고 아래에서 올라오는 시트로 연다.
 */
export function NodeChat({ nodeId }: { nodeId: string }) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<'quota' | 'failed' | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<AbortController | null>(null)

  const over = text.length > MAX
  const canSend = text.trim().length > 0 && !over && !pending && error !== 'quota'

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  /* 답이 길어져도 새 답과 다음 입력칸을 찾아 스크롤할 필요가 없게 한다. */
  useEffect(() => {
    if (!open || (turns.length === 0 && !pending && !error)) return
    requestAnimationFrame(() =>
      conversationEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }),
    )
  }, [error, open, pending, turns.length])

  /* 다른 질문으로 떠난 뒤 끝난 응답이 사라진 패널을 갱신하지 않게 한다. */
  useEffect(() => () => requestRef.current?.abort(), [])

  async function send() {
    const asked = text.trim()
    if (!asked || pending) return
    setPending(true)
    setError(null)
    const controller = new AbortController()
    requestRef.current = controller
    const nextTurns: Turn[] = [...turns, { role: 'user', text: asked }]
    setTurns(nextTurns)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          node_id: nodeId,
          /* 방금 친 질문은 text로 가므로 이력에서는 뺀다 */
          history: nextTurns.slice(0, -1).slice(-6),
          text: asked,
        }),
      })
      if (res.status === 429) {
        setTurns(turns)
        setError('quota')
        return
      }
      if (!res.ok) {
        setTurns(turns)
        setError('failed')
        return
      }
      const data = (await res.json()) as { answer: string; quota: { used: number; limit: number } }
      setTurns([...nextTurns, { role: 'assistant', text: data.answer }])
      setText('')
      setRemaining(Math.max(0, data.quota.limit - data.quota.used))
    } catch {
      if (controller.signal.aborted) return
      setTurns(turns)
      setError('failed')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        aria-label="해설 질문 열기"
        aria-controls="node-chat-dialog"
        aria-expanded="false"
        className="fixed bottom-20 right-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold text-ink shadow-lg transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:bottom-auto xl:right-0 xl:top-1/2 xl:-translate-y-1/2 xl:rounded-l-xl xl:rounded-r-none xl:border-r-0 xl:px-3 xl:py-4"
      >
        <span aria-hidden className="grid size-5 place-items-center rounded-full bg-accent text-[12px] text-on-accent">?</span>
        해설 질문
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label="해설 질문 닫기"
        onClick={close}
        className="fixed inset-0 z-40 cursor-default bg-black/25 xl:hidden"
      />
      <section
        id="node-chat-dialog"
        role="dialog"
        aria-label="이 해설에 대해 물어보기"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col overflow-hidden rounded-t-2xl border border-line bg-raised p-4 shadow-2xl xl:inset-x-auto xl:bottom-20 xl:right-4 xl:top-20 xl:w-[360px] xl:max-h-none xl:rounded-2xl"
      >
        <div className="z-10 flex shrink-0 items-baseline justify-between bg-raised pb-2">
          <h3 className="text-[13px] font-medium text-muted">이 해설에 대해 물어보기</h3>
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 items-center px-2 text-[12px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            접기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {turns.length > 0 && (
            <ol
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="mt-3 flex list-none flex-col gap-2 p-0"
            >
              {turns.map((t, i) => (
                <li
                  key={i}
                  aria-label={t.role === 'user' ? '내 질문' : '답변'}
                  className={
                    t.role === 'user'
                      ? 'ml-8 rounded-lg bg-surface px-3 py-2 text-[14px] leading-[1.65]'
                      : 'mr-4 rounded-lg border border-line px-3 py-2 text-[14px] leading-[1.7] text-muted'
                  }
                >
                  {t.text}
                </li>
              ))}
            </ol>
          )}

          {pending && (
            <p role="status" className="mt-2 text-[13px] text-faint">
              답을 쓰는 중…
            </p>
          )}

          {error === 'quota' && (
            <p role="alert" className="mt-2 text-[13px] text-muted">
              오늘 물어볼 몫을 다 쓰셨습니다. 자정에 다시 채워집니다.
            </p>
          )}
          {error === 'failed' && (
            <p role="alert" className="mt-2 text-[13px] text-muted">
              답을 만들지 못했습니다. 다시 시도해 주세요.
            </p>
          )}

          <div ref={conversationEndRef} aria-hidden />
        </div>

        <form
          className="mt-3 shrink-0"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSend) void send()
          }}
        >
          <div className="rounded-lg border border-line bg-surface focus-within:border-accent">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
                  e.preventDefault()
                  void send()
                }
              }}
              rows={2}
              autoComplete="off"
              placeholder="이 해설에서 이해가 안 되는 부분을 적어 주세요"
              aria-label="해설에 대한 질문"
              aria-describedby="node-chat-count node-chat-notice"
              aria-invalid={over || undefined}
              className="block w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-[1.65] text-ink placeholder:text-faint focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-2">
              <span
                id="node-chat-count"
                className={`text-[12px] tabular-nums ${over ? 'text-warn' : 'text-faint'}`}
              >
                {text.length}/{MAX}
              </span>
              <button
                type="submit"
                disabled={!canSend}
                aria-busy={pending || undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-[13px] font-medium text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  pending ? 'cursor-wait disabled:opacity-100' : 'disabled:cursor-not-allowed disabled:opacity-50'
                }`}
              >
                {pending && (
                  <span
                    aria-hidden
                    className="size-3.5 animate-spin rounded-full border-2 border-on-accent/35 border-t-on-accent"
                  />
                )}
                {pending ? '답변 중' : '물어보기'}
              </button>
            </div>
          </div>
        </form>

        <p id="node-chat-notice" className="mt-2 shrink-0 text-[12px] leading-[1.6] text-faint">
          적은 내용은 AI 학습에 쓰일 수 있습니다. 이름이나 연락처는 넣지 말아 주세요. 대화는
          저장되지 않습니다 — 화면을 떠나면 사라집니다.
          {remaining !== null && remaining <= SHOW_REMAINING_AT && (
            <span className="ml-1">오늘 {remaining}번 더 물어볼 수 있습니다.</span>
          )}
        </p>
      </section>
    </>
  )
}
