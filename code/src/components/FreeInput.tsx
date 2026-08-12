'use client'

import { useState } from 'react'

const MAX = 300

/**
 * 남은 횟수를 언제 보여줄지.
 *
 * 이 숫자는 "이제 곧 못 쓴다"를 알리려고 있다. 그런데 한도를 임시로 9999까지
 * 열어 두면서 처음 온 사람에게 **"오늘 9990번 남음"**이 그대로 보였다. 정보가
 * 아니라 내부 설정이 새는 것이고, 읽는 쪽에서는 뜻을 잡을 수도 없다.
 *
 * 기본 한도가 5회다. 스물을 넘게 남았으면 사실상 제한이 없는 상태라 굳이
 * 셀 이유가 없다. 줄어들어 실제로 걸리기 시작할 때만 말한다.
 */
const SHOW_REMAINING_AT = 20

/**
 * 자유 질문 입력.
 *
 * 고지가 필수다. 무료 티어는 입력이 모델 학습에 쓰이고 약관이 개인정보 제출을 금지한다.
 * 익명 사용자가 무엇을 입력할지 통제할 수 없으므로 입력 지점에서 알린다.
 *
 * 거절당해도 입력을 지우지 않는다. 다시 치게 하면 그 자리에서 이탈한다.
 */
export function FreeInput({
  disabled,
  pending,
  quotaExceeded,
  remaining,
  onSubmit,
}: {
  disabled: boolean
  pending: boolean
  quotaExceeded: boolean
  /** 오늘 새로 팔 수 있는 횟수 */
  remaining: number
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')

  const over = text.length > MAX
  const blocked = disabled || quotaExceeded
  const canSend = text.trim().length > 0 && !over && !blocked && !pending

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSubmit(text.trim())
      }}
    >
      <label htmlFor="free-question" className="block text-[13px] font-medium text-muted">
        원하는 꼬리질문 만들기
      </label>

      <div className="mt-2 rounded-lg border border-line bg-raised focus-within:border-accent">
        <textarea
          id="free-question"
          rows={2}
          value={text}
          autoComplete="off"
          disabled={blocked}
          placeholder={
            quotaExceeded ? '오늘 몫은 다 쓰셨습니다' : '이 질문에서 더 궁금한 내용을 적어 주세요'
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
              e.preventDefault()
              onSubmit(text.trim())
            }
          }}
          className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
          aria-describedby="free-question-count free-question-notice"
          aria-invalid={over || undefined}
        />

        <div className="flex items-center justify-between px-4 pb-2.5">
          {/*
            남은 횟수를 상시 보여준다. 다 쓰고 나서야 알려주면 그때는 이미 늦다.
            글자 수와 같은 줄에 두는 것은 둘 다 "지금 쓸 수 있는 여유"를 말해서다.

            이미 만든 질문은 차감되지 않는다. 이 숫자가 세는 것은 새로 만드는 질문이다.
          */}
          <span
            id="free-question-count"
            className={`font-mono text-[11px] ${over ? 'text-warn' : 'text-faint'}`}
          >
            {text.length}/{MAX}
            {!quotaExceeded && remaining <= SHOW_REMAINING_AT && (
              <span className="ml-2">오늘 {remaining}번 남음</span>
            )}
          </span>

          <button
            type="submit"
            disabled={!canSend}
            aria-busy={pending || undefined}
            /*
              이 화면의 주 행동이다. 폰에서 재보니 높이가 32px이었다.

              여기는 배경이 있는 버튼이라 헤더처럼 눌러 당기지 않는다 — 당기면
              색칠된 면이 커져 보이는 모양이 바뀐다. 대신 실제로 키운다.
              주 행동을 작게 둘 이유가 없다.
            */
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-[13px] font-medium text-on-accent transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              pending
                ? 'cursor-wait disabled:opacity-100'
                : 'disabled:cursor-not-allowed disabled:opacity-40'
            }`}
          >
            {pending && (
              <span
                aria-hidden
                className="size-3.5 animate-spin rounded-full border-2 border-on-accent/35 border-t-on-accent"
              />
            )}
            {pending ? '만드는 중' : '꼬리질문 만들기'}
          </button>
        </div>
      </div>

      {/* 입력란만 흐려두면 왜 막혔는지 알 수 없다. 남은 길이 있다는 것도 함께 알린다 */}
      <p id="free-question-notice" className="mt-2 text-[12px] leading-[1.6] text-faint">
        {quotaExceeded
          ? '오늘 몫은 다 쓰셨습니다. 이미 만든 질문은 그대로 열 수 있습니다. 자정에 초기화됩니다.'
          : '적은 내용은 AI 학습에 쓰일 수 있습니다. 이름이나 연락처는 넣지 말아 주세요.'}
      </p>
    </form>
  )
}
