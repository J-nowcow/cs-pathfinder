'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { gradeQuiz } from '@/lib/quiz'
import {
  emptyQuizState,
  loadQuiz,
  recordChoice,
  saveQuiz,
  shouldAsk,
  skipQuiz,
  type QuizState,
} from '@/lib/quiz/storage'
import type { QuizItem } from '../../data/quiz'

const KIND_LABEL: Record<QuizItem['kind'], string> = {
  concept: '개념',
  misconception: '흔한 오해',
  boundary: '조건과 예외',
}

const ORDINAL = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째'] as const

/** 두더지는 지금 무엇을 하고 있는가 */
function mole(state: 'ask' | 'right' | 'wrong' | 'done') {
  if (state === 'ask') return { src: '/mascot/mole-curious.png', w: 72 }
  if (state === 'wrong') return { src: '/mascot/mole-digging.png', w: 72 }
  return { src: '/mascot/mole-found.png', w: 72 }
}

/**
 * 해설을 읽기 전에 내는 진단 문제.
 *
 * **한 번에 한 문제만 편다.** 셋을 한 화면에 늘어놓았더니 보기 열두 개가
 * 글자 덩어리로 읽혔다. 한 장씩이면 한 화면 글자가 481자에서 125자로 준다.
 * 대신 세 문제를 한눈에 훑을 수는 없다 — 진단은 훑는 일이 아니라고 봤다.
 *
 * 고른 답은 되돌리지 않는다. 정답이 이미 보이는 상태에서 다시 고르게 하면
 * 진단이 아니라 맞히기가 된다. 다음 방문에서는 다시 풀 수 있다.
 *
 * 설계: `docs/design/2026-08-29-quiz.md`
 */
export function QuizGate({
  nodeId,
  items,
  onGrade,
}: {
  nodeId: string
  items: QuizItem[]
  /** 틀린 문제가 겨냥한 suggestions 인덱스. 부모가 꼬리질문 순서를 바꾼다 */
  onGrade: (leadsTo: number[]) => void
}) {
  const [state, setState] = useState<QuizState>(emptyQuizState)
  const [ready, setReady] = useState(false)
  /** 지금 펼친 문제. 저장소를 읽은 뒤 처음 안 푼 자리에서 시작한다 */
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    const loaded = loadQuiz()
    const chosen = loaded.attempts[nodeId]?.chosen ?? []
    const firstOpen = items.findIndex((_, i) => (chosen[i] ?? -1) < 0)

    setState(loaded)
    setCursor(firstOpen < 0 ? items.length - 1 : firstOpen)
    setReady(true)
    onGrade(gradeQuiz(items, chosen).leadsTo)
    // 노드가 바뀌면 부모가 key로 다시 마운트한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId])

  const chosen = state.attempts[nodeId]?.chosen ?? []
  const grade = gradeQuiz(items, chosen)
  const done = grade.answeredCount === items.length

  const persist = (next: QuizState) => {
    setState(next)
    saveQuiz(next)
    onGrade(gradeQuiz(items, next.attempts[nodeId]?.chosen ?? []).leadsTo)
  }

  /*
   * 저장소를 읽기 전에는 아무것도 안 그린다. 서버 렌더에서 문제가 보였다가
   * "이미 푼 노드"라 사라지면 화면이 튄다.
   */
  if (!ready || !items.length) return null
  if (!shouldAsk(state, nodeId, items.length) && !done) return null

  const item = items[cursor]
  const pick = chosen[cursor] ?? -1
  const answered = pick >= 0 && pick < item.choices.length
  const isRight = grade.results[cursor] === true
  const last = cursor === items.length - 1
  const face = mole(!answered ? 'ask' : done && last ? 'done' : isRight ? 'right' : 'wrong')

  return (
    <section
      aria-labelledby={`quiz-title-${nodeId}`}
      className="relative rounded-[22px] border border-line bg-raised p-5 shadow-[0_2px_4px_rgba(64,48,30,.05),0_14px_34px_-16px_rgba(64,48,30,.18)] sm:p-6"
    >
      <h2 id={`quiz-title-${nodeId}`} className="sr-only">
        읽기 전에 세 문제
      </h2>

      {/* 카드 모서리에 걸터앉는다. 글과 겹치는 정보가 없어 낭독기에는 안 읽힌다 */}
      <Image
        src={face.src}
        alt=""
        aria-hidden
        width={face.w}
        height={face.w}
        className="pointer-events-none absolute -top-6 right-4 size-14 select-none sm:size-[68px]"
      />

      <p className="pr-16 font-mono text-[11.5px] uppercase tracking-[0.06em] text-faint">
        {ORDINAL[cursor] ?? `${cursor + 1}번째`} · {KIND_LABEL[item.kind]}
      </p>
      <p
        id={`quiz-stem-${nodeId}`}
        className="mt-1.5 pr-16 text-[17px] font-bold leading-[1.45] tracking-[-0.01em] text-ink"
      >
        {item.stem}
      </p>

      {/* 문제 문장을 legend로 되풀이하지 않는다 — 낭독기가 두 번 읽는다 */}
      <fieldset disabled={answered} aria-labelledby={`quiz-stem-${nodeId}`} className="mt-4">
        <div className="space-y-2">
          {item.choices.map((choice, index) => {
            const picked = pick === index
            const reveal = answered && choice.correct === true

            return (
              <button
                key={choice.text}
                type="button"
                disabled={answered}
                aria-pressed={picked || undefined}
                onClick={() =>
                  persist(
                    recordChoice(
                      state,
                      nodeId,
                      cursor,
                      index,
                      items.length,
                      new Date().toISOString(),
                    ),
                  )
                }
                className={`flex min-h-12 w-full items-start gap-3 rounded-[13px] border-[1.5px] px-3.5 py-3 text-left text-[14.5px] leading-[1.5] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  reveal
                    ? 'border-accent bg-accent-soft text-ink'
                    : picked
                      ? 'border-warn bg-warn-soft text-ink'
                      : answered
                        ? 'border-line bg-raised text-muted opacity-60'
                        : 'border-line bg-raised text-ink hover:border-accent hover:bg-accent-soft/40'
                }`}
              >
                {/* 정오를 색만으로 알리지 않는다 — 채워진 점과 빈 점으로도 갈린다 */}
                <span
                  aria-hidden
                  className={`mt-0.5 size-[17px] shrink-0 rounded-full border-2 ${
                    reveal
                      ? 'border-accent bg-accent shadow-[inset_0_0_0_2.5px_var(--raised)]'
                      : picked
                        ? 'border-warn bg-warn shadow-[inset_0_0_0_2.5px_var(--raised)]'
                        : 'border-line'
                  }`}
                />
                <span className="min-w-0 flex-1">{choice.text}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      {answered && (
        <p
          aria-live="polite"
          className="mt-3.5 rounded-[13px] bg-surface px-3.5 py-3 text-[13.5px] leading-[1.65] text-muted"
        >
          <span className="font-semibold text-ink">
            {isRight ? '맞았어요. ' : '아쉬워요. '}
          </span>
          {item.rationale}
        </p>
      )}

      {/* 진행 눈금. 푼 것은 채워지고 틀린 것은 흙빛으로 남는다 */}
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {items.map((it, i) => (
          <span
            key={it.stem}
            className={`h-[5px] flex-1 rounded-full ${
              grade.results[i] === true
                ? 'bg-accent'
                : grade.results[i] === false
                  ? 'bg-warn'
                  : 'bg-line'
            }`}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[12px] text-faint" aria-live="polite">
          {grade.answeredCount} / {items.length}
        </span>

        {done ? (
          <span className="text-[13px] text-muted">
            {grade.leadsTo.length
              ? '틀린 곳과 이어지는 꼬리질문을 아래 맨 위로 올려 두었어요'
              : '다 맞혔어요. 해설은 확인용으로만 훑어도 돼요'}
          </span>
        ) : answered ? (
          <button
            type="button"
            onClick={() => setCursor((c) => Math.min(c + 1, items.length - 1))}
            className="min-h-11 rounded-xl bg-ink px-5 text-[14px] font-semibold text-raised transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            다음 문제 →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => persist(skipQuiz(state, nodeId))}
            className="min-h-11 rounded-lg px-1 text-[13px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            건너뛰고 바로 읽기
          </button>
        )}
      </div>
    </section>
  )
}
