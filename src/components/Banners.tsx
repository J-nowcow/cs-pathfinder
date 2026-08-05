'use client'

/**
 * 설계 §7 상태 표를 화면으로 옮긴 것.
 *
 * 어느 배너든 경로를 건드리지 않는다. 오류가 났다고 파던 자리를 잃으면
 * 재시도할 이유가 사라진다.
 */
export type BannerState =
  | { kind: 'none' }
  | { kind: 'rejected'; reason: string }
  | { kind: 'quota_exceeded'; used: number; limit: number }
  | { kind: 'rate_limited'; retryAfter: number }
  | { kind: 'gate_unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'ancestor_jump'; question: string }

export function Banner({ state, onRetry }: { state: BannerState; onRetry?: () => void }) {
  if (state.kind === 'none') return null

  const tone =
    state.kind === 'ancestor_jump'
      ? 'border-accent/35 bg-accent-soft text-ink'
      : 'border-warn/30 bg-warn-soft text-ink'

  return (
    <div role="status" className={`rounded-lg border px-4 py-3 text-[14px] leading-[1.6] ${tone}`}>
      {state.kind === 'rejected' && (
        <>
          <strong className="font-medium">질문으로 받지 못했습니다.</strong>
          <span className="mt-1 block text-muted">{state.reason}</span>
        </>
      )}

      {state.kind === 'quota_exceeded' && (
        <>
          <strong className="font-medium">
            오늘 확장 한도를 다 썼습니다 ({state.used}/{state.limit}).
          </strong>
          <span className="mt-1 block text-muted">
            이미 파인 길로 표시된 추천은 계속 누를 수 있습니다. 한도는 자정에 초기화됩니다.
          </span>
        </>
      )}

      {state.kind === 'rate_limited' && (
        <>
          <strong className="font-medium">요청이 몰렸습니다.</strong>
          <span className="mt-1 block text-muted">
            {state.retryAfter}초 뒤에 다시 시도해 주세요.
          </span>
        </>
      )}

      {state.kind === 'gate_unavailable' && (
        <>
          <strong className="font-medium">지금은 새 질문을 받을 수 없습니다.</strong>
          <span className="mt-1 block text-muted">
            이미 파인 길로 표시된 추천만 이동할 수 있습니다.
          </span>
        </>
      )}

      {state.kind === 'error' && (
        <div className="flex items-start justify-between gap-4">
          <span>
            <strong className="font-medium">확장하지 못했습니다.</strong>
            <span className="mt-1 block text-muted">{state.message}</span>
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md border border-line bg-raised px-3 py-1.5 text-[13px] font-medium text-ink hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              다시 시도
            </button>
          )}
        </div>
      )}

      {state.kind === 'ancestor_jump' && (
        <>
          <strong className="font-medium">이미 지나온 질문입니다.</strong>
          <span className="mt-1 block text-muted">그 지점으로 돌아왔습니다.</span>
        </>
      )}
    </div>
  )
}

/** 생성 대기. 질문은 이미 화면에 있고 해설 자리만 비어 있는 상태다 */
export function GeneratingBody() {
  return (
    <div aria-live="polite" className="space-y-3">
      <p className="text-[14px] text-muted">해설을 만들고 있습니다. 몇 초 걸립니다.</p>
      <div className="space-y-2.5" aria-hidden>
        {[100, 96, 88, 94, 62].map((w, i) => (
          <div
            key={i}
            className="h-3.5 animate-pulse rounded bg-ink/[0.07]"
            style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
