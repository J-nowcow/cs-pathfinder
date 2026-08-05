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
        이 질문에는 추천 꼬리질문이 없습니다. 아래에 직접 물어보세요.
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
              className="group flex w-full items-start gap-3 rounded-lg border border-line bg-raised px-4 py-3.5 text-left transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span
                aria-hidden
                className={`mt-[7px] size-1.5 shrink-0 rounded-full ${
                  s.resolved ? 'bg-accent' : 'bg-line group-hover:bg-faint'
                }`}
              />

              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-[1.55] text-ink">{s.text}</span>
                {s.resolved && (
                  <span className="mt-1 block text-[12px] text-accent">이미 파인 길 · 즉시 이동</span>
                )}
              </span>

              <span
                aria-hidden
                className={`mt-0.5 shrink-0 text-[13px] ${pending ? 'text-accent' : 'text-faint'}`}
              >
                {pending ? '···' : '→'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
