'use client'

import { useEffect, useState } from 'react'
import {
  emptyAnswerPractice,
  loadAnswerPractice,
  saveAnswerPractice,
  type AnswerPracticeState,
} from '@/lib/answer-practice/storage'

/** 계정과 무관하게 이 브라우저에 적용되는 학습 화면 설정. */
export function LearningSettings() {
  const [state, setState] = useState<AnswerPracticeState>(emptyAnswerPractice)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setState(loadAnswerPractice())
    setReady(true)
  }, [])

  return (
    <div className="rounded-xl border border-line bg-raised p-4">
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={state.alwaysOpen}
          disabled={!ready}
          onChange={(event) => {
            const next = { ...state, alwaysOpen: event.target.checked }
            setState(next)
            saveAnswerPractice(next)
          }}
          className="mt-1"
        />
        <span>
          <strong className="block text-[14px] font-medium">답변칸 항상 펼치기</strong>
          <span className="mt-1 block text-[13px] leading-[1.6] text-muted">
            질문을 열면 내 답변 입력칸을 바로 보여줍니다. 모범답안은 계속 접어 둡니다.
          </span>
        </span>
      </label>
      <p className="mt-2 text-[12px] text-faint">이 설정은 현재 브라우저에만 저장됩니다.</p>
    </div>
  )
}
