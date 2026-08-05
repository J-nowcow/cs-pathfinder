'use client'

import { useState } from 'react'

const MAX = 300

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
        직접 물어보기
      </label>

      <div className="mt-2 rounded-lg border border-line bg-raised focus-within:border-accent">
        <textarea
          id="free-question"
          rows={2}
          value={text}
          disabled={blocked}
          placeholder={
            quotaExceeded ? '오늘 몫은 다 쓰셨어요' : '이 질문에서 더 궁금한 걸 적어보세요'
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSend) {
              e.preventDefault()
              onSubmit(text.trim())
            }
          }}
          className="w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />

        <div className="flex items-center justify-between px-4 pb-2.5">
          {/*
            남은 횟수를 상시 보여준다. 다 쓰고 나서야 알려주면 그때는 이미 늦다.
            글자 수와 같은 줄에 두는 것은 둘 다 "지금 쓸 수 있는 여유"를 말해서다.

            이미 파인 길은 차감되지 않는다. 이 숫자가 세는 것은 새로 만드는 질문이다.
          */}
          <span className={`font-mono text-[11px] ${over ? 'text-warn' : 'text-faint'}`}>
            {text.length}/{MAX}
            {!quotaExceeded && <span className="ml-2">오늘 {remaining}번 남음</span>}
          </span>

          <button
            type="submit"
            disabled={!canSend}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {pending ? '파는 중' : '파고들기'}
          </button>
        </div>
      </div>

      {/* 입력란만 흐려두면 왜 막혔는지 알 수 없다. 남은 길이 있다는 것도 함께 알린다 */}
      <p className="mt-2 text-[12px] leading-[1.6] text-faint">
        {quotaExceeded
          ? '오늘 몫은 다 쓰셨어요. 이미 파인 길은 그대로 누를 수 있고요. 자정에 초기화돼요.'
          : '적은 내용은 AI 학습에 쓰일 수 있어요. 이름이나 연락처는 넣지 말아주세요.'}
      </p>
    </form>
  )
}
