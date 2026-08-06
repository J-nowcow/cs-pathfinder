'use client'

import { useEffect, useState } from 'react'

/**
 * 설계 §7 상태 표를 화면으로 옮긴 것.
 *
 * 어느 배너든 경로를 건드리지 않는다. 오류가 났다고 파던 자리를 잃으면
 * 재시도할 이유가 사라진다.
 *
 * 문구는 브랜드 노트의 카피 원칙을 따른다(vault: cs-pathfinder MOC). "~다"를 연달아 쓰지 않고
 * 문장 길이를 일부러 어긋낸다. 상태 문구까지 같은 톤이어야 한 사람이 쓴 것처럼 읽힌다.
 */
export type BannerState =
  | { kind: 'none' }
  | { kind: 'rejected'; reason: string }
  // 서버는 429에 사용량 수치를 싣지 않는다. 숫자를 지어내지 않고 사실만 말한다.
  | { kind: 'quota_exceeded' }
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
          <strong className="font-medium">질문으로 받기 어려운 내용이에요.</strong>
          <span className="mt-1 block text-muted">{state.reason}</span>
        </>
      )}

      {state.kind === 'quota_exceeded' && (
        <>
          <strong className="font-medium">오늘 몫은 다 쓰셨어요.</strong>
          <span className="mt-1 block text-muted">
            이미 파인 길로 표시된 추천은 그대로 누를 수 있고요. 자정에 초기화돼요.
          </span>
        </>
      )}

      {state.kind === 'rate_limited' && (
        <>
          <strong className="font-medium">잠깐, 요청이 몰렸어요.</strong>
          <span className="mt-1 block text-muted">{state.retryAfter}초 뒤에 다시 눌러주세요.</span>
        </>
      )}

      {state.kind === 'gate_unavailable' && (
        <>
          <strong className="font-medium">지금은 새 질문을 못 받아요.</strong>
          <span className="mt-1 block text-muted">
            이미 파인 길로 표시된 추천은 그대로 쓸 수 있어요.
          </span>
        </>
      )}

      {state.kind === 'error' && (
        <div className="flex items-start justify-between gap-4">
          <span>
            <strong className="font-medium">파고들지 못했어요.</strong>
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
          <strong className="font-medium">이미 지나온 질문이에요.</strong>
          <span className="mt-1 block text-muted">그 자리로 돌아왔어요.</span>
        </>
      )}
    </div>
  )
}

/** 생성 대기. 질문은 이미 화면에 있고 해설 자리만 비어 있는 상태다 */
/**
 * 기다리는 동안 하는 말.
 *
 * "몇 초만요"는 약속이다. 무료 한도에 걸려 폴백 사슬을 타면 실제로 20초가
 * 걸리는데, 그때까지 같은 문구가 떠 있으면 거짓말이 된다. 한 번 어긋나면
 * 다음부터 안 기다린다.
 *
 * 시간이 지나면 말을 바꾼다. 마지막 문구는 원인을 그대로 말한다 — 숨기는 것보다
 * 왜 느린지 아는 편이 기다리기 쉽다.
 */
const WAITING_COPY: Array<{ after: number; text: string }> = [
  { after: 0, text: '해설 만드는 중이에요. 몇 초만요.' },
  { after: 8, text: '조금 더 걸리고 있어요. 그대로 두셔도 돼요.' },
  { after: 18, text: '오래 걸리네요. 무료 한도에 걸려 다른 모델로 넘어가는 중일 수 있어요.' },
]

/** 기다린 시간에 맞는 문구를 고른다 */
function useWaitingCopy(): string {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return ([...WAITING_COPY].reverse().find((c) => elapsed >= c.after) ?? WAITING_COPY[0]).text
}

/**
 * 파고드는 동안 누르는 자리 옆에 붙는 한 줄.
 *
 * 재보니 꼬리질문을 누르고 새 화면이 뜰 때까지 **35초**가 걸렸다. 그동안
 * 화면에 바뀌는 것은 화살표 `→`가 `···`이 되는 것뿐이었고, `role="status"`도
 * `aria-busy`도 없어서 화면 낭독기에는 아무것도 안 알려줬다.
 *
 * 35초면 사람은 고장 났다고 판단한다.
 *
 * 여기서는 본문을 스켈레톤으로 갈아끼우지 않는다. 읽던 글을 지우는 셈이라
 * 기다리는 동안 읽을 것마저 없어진다. 대신 누른 자리 바로 아래에 말을 붙인다.
 */
export function ExpandingNote() {
  const copy = useWaitingCopy()

  return (
    <p role="status" aria-live="polite" className="mt-3 text-[13px] leading-[1.6] text-muted">
      <span
        aria-hidden
        className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent align-middle"
      />
      {copy}
    </p>
  )
}

export function GeneratingBody() {
  const copy = useWaitingCopy()

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <p className="text-[14px] text-muted">{copy}</p>
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
