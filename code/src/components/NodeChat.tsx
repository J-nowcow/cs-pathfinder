'use client'

import { useRef, useState } from 'react'
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
 * 접어 둔다. 챗은 보조 출구지 주 동선이 아니다 — 펼쳐진 채로 두면
 * 화면이 챗봇처럼 읽혀 자유 입력창이 겪던 오해를 여기가 물려받는다.
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

  const over = text.length > MAX
  const canSend = text.trim().length > 0 && !over && !pending && error !== 'quota'

  async function send() {
    const asked = text.trim()
    if (!asked || pending) return
    setPending(true)
    setError(null)
    const nextTurns: Turn[] = [...turns, { role: 'user', text: asked }]
    setTurns(nextTurns)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          /* 방금 친 질문은 text로 가므로 이력에서는 뺀다 */
          history: nextTurns.slice(0, -1).slice(-6),
          text: asked,
        }),
      })
      if (res.status === 429) {
        setError('quota')
        return
      }
      if (!res.ok) {
        setError('failed')
        return
      }
      const data = (await res.json()) as { answer: string; quota: { used: number; limit: number } }
      setTurns([...nextTurns, { role: 'assistant', text: data.answer }])
      setText('')
      setRemaining(Math.max(0, data.quota.limit - data.quota.used))
    } catch {
      setError('failed')
    } finally {
      setPending(false)
    }
  }

  if (!open) {
    return (
      <div className="mt-6">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            setOpen(true)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          aria-expanded="false"
          className="inline-flex min-h-11 items-center text-[13px] font-medium text-muted underline decoration-dotted underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          해설이 어렵나요? 이 해설에 대해 물어보기
        </button>
      </div>
    )
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-raised p-4" aria-label="이 해설에 대해 물어보기">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-medium text-muted">이 해설에 대해 물어보기</h3>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            requestAnimationFrame(() => triggerRef.current?.focus())
          }}
          aria-expanded="true"
          className="inline-flex min-h-11 items-center px-2 text-[12px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          접기
        </button>
      </div>

      {turns.length > 0 && (
        <ol className="mt-3 flex list-none flex-col gap-2 p-0">
          {turns.map((t, i) => (
            <li
              key={i}
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
        <p role="status" className="mt-2 text-[13px] text-muted">
          오늘 물어볼 몫을 다 쓰셨습니다. 자정에 다시 채워집니다.
        </p>
      )}
      {error === 'failed' && (
        <p role="status" className="mt-2 text-[13px] text-muted">
          답을 만들지 못했습니다. 다시 시도해 주세요.
        </p>
      )}

      <form
        className="mt-3"
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
            placeholder="이 해설에서 이해가 안 되는 부분을 적어 주세요"
            aria-label="해설에 대한 질문"
            className="block w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-[1.65] text-ink placeholder:text-faint focus:outline-none"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <span className={`text-[12px] tabular-nums ${over ? 'text-warn' : 'text-faint'}`}>
              {text.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={!canSend}
              aria-busy={pending || undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-3 text-[13px] font-medium text-on-accent ${
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

      <p className="mt-2 text-[12px] leading-[1.6] text-faint">
        적은 내용은 AI 학습에 쓰일 수 있습니다. 이름이나 연락처는 넣지 말아 주세요. 대화는
        저장되지 않습니다 — 화면을 떠나면 사라집니다.
        {remaining !== null && remaining <= SHOW_REMAINING_AT && (
          <span className="ml-1">오늘 {remaining}번 더 물어볼 수 있습니다.</span>
        )}
      </p>
    </section>
  )
}
