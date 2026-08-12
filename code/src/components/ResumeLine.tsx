'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { JOURNEY_STORAGE_KEY, deserializeJourney } from '@/lib/journey/storage'
import { currentOccurrence, pathTo } from '@/lib/journey/path'

/**
 * 파던 자리로 돌아가는 줄.
 *
 * **돌아올 이유가 문자 그대로 0개였다.** manifest도 알림도 메일도 없다. 그런데
 * 판 기록은 이미 `localStorage`에 있다(596바이트). 홈에 그것을 보여줄 자리가
 * 없었을 뿐이다.
 *
 * 서버가 할 일이 없다. 계정도 스키마도 필요 없고 기존 저장 형식을 그대로 읽는다.
 *
 * **한 칸만 판 사람에게는 안 보인다.** 오늘의 질문을 열어 보기만 해도 발자국이
 * 하나 생기는데, 그것까지 "이어서 파던 곳"이라 부르면 바로 위 오늘 카드와 같은
 * 곳을 가리키는 줄이 두 개가 된다. 두 칸부터 보여준다.
 *
 * "어제"라고 안 쓴다. 저장된 것에 시각이 없어서 언제 팠는지 모른다. 모르는 것을
 * 아는 척하는 문장은 한 번만 틀려도 신뢰를 깎는다.
 */
export function ResumeLine() {
  const [resume, setResume] = useState<{ nodeId: string; question: string; depth: number } | null>(
    null,
  )

  /*
   * 서버에는 `localStorage`가 없다. 첫 렌더에서 읽으면 서버가 그린 것과
   * 달라져 하이드레이션이 어긋난다. 붙은 뒤에 한 번 읽는다.
   */
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY)
    } catch {
      /* 사파리 프라이빗 모드는 읽기에서도 던진다. 그러면 이 줄은 없는 것으로 한다 */
      return
    }

    const state = deserializeJourney(raw)
    if (!state) return

    const at = currentOccurrence(state)
    if (!at) return

    const depth = pathTo(state, at.id).length
    if (depth < 2) return

    setResume({ nodeId: at.nodeId, question: at.question, depth })
  }, [])

  if (!resume) return null

  return (
    <Link
      href={`/q/${resume.nodeId}`}
      className="mb-4 flex items-center gap-3 rounded-lg border border-line bg-raised px-4 py-3 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-faint">
          이어서 학습하기 · <span className="font-mono">깊이 {resume.depth - 1}</span>
        </p>
        <p className="mt-0.5 truncate text-[14px] font-medium text-ink">{resume.question}</p>
      </div>
      <span aria-hidden className="shrink-0 text-[13px] text-accent">
        →
      </span>
    </Link>
  )
}
