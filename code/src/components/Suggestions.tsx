'use client'

import type { PublicSuggestion } from '@/lib/api/expand-client'

/**
 * 추천 꼬리질문 5개.
 *
 * resolved 표시가 중요하다. 이미 노드가 있는 추천은 LLM을 태우지 않고 즉시 이동하며
 * 할당량도 깎지 않는다. 사용자가 그걸 알면 남은 할당량을 자유 입력에 쓴다.
 */
export function Suggestions({
  suggestions,
  pendingId,
  disabled,
  onPick,
}: {
  suggestions: PublicSuggestion[]
  pendingId: string | null
  disabled: boolean
  onPick: (s: PublicSuggestion) => void
}) {
  if (suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[14px] text-faint">
        추천 꼬리질문이 없습니다. 아래에서 원하는 꼬리질문을 만들어 보세요.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {suggestions.map((s) => {
        const pending = pendingId === s.id

        return (
          <li key={s.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              data-pending={pending || undefined}
              aria-busy={pending || undefined}
              className={`group flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                pending
                  ? 'cursor-wait border-accent bg-accent-soft'
                  : 'border-line bg-raised hover:border-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line'
              }`}
            >
              <span
                aria-hidden
                className={`mt-[7px] size-1.5 shrink-0 rounded-full ${
                  s.resolved ? 'bg-accent' : 'bg-line group-hover:bg-faint'
                }`}
              />

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-[1.55] text-ink">{s.text}</span>
                {pending ? (
                  <span className="mt-1 block text-[12px] text-accent">
                    새 질문과 해설을 만드는 중
                  </span>
                ) : s.resolved ? (
                  <span className="mt-1 block text-[12px] text-accent">이미 만든 질문 · 바로 이동</span>
                ) : null}
              </span>

              {pending ? (
                <span
                  aria-hidden
                  className="mt-1 size-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
                />
              ) : (
                <span aria-hidden className="mt-0.5 shrink-0 text-[13px] text-faint">
                  →
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
