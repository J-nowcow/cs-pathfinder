'use client'

import { useEffect, useState } from 'react'
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

/**
 * 해설을 읽기 전에 내는 진단 세 문제.
 *
 * **세 문제를 한 화면에 다 편다.** 하나씩 넘기면 이탈 지점이 세 번 생긴다.
 * 진단이 목적이지 시험이 목적이 아니라서, 건너뛰기를 항상 열어두는 것과
 * 같은 결로 판단했다.
 *
 * 고른 답은 되돌리지 않는다. 정답이 이미 보이는 상태에서 다시 고르게 하면
 * 진단이 아니라 맞히기가 된다. 다만 다음 방문에서는 다시 풀 수 있다 —
 * 저장소가 덮어쓰기를 허용한다.
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

  useEffect(() => {
    const loaded = loadQuiz()
    setState(loaded)
    setReady(true)
    onGrade(gradeQuiz(items, loaded.attempts[nodeId]?.chosen ?? []).leadsTo)
    // 노드가 바뀌면 부모가 key로 다시 마운트한다. items·onGrade는 그때 같이 바뀐다.
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
   * 저장소를 읽기 전에는 아무것도 안 그린다. 서버 렌더와 첫 페인트에서 문제가
   * 보였다가 "이미 푼 노드"라 사라지면 화면이 튄다.
   */
  if (!ready) return null
  if (!shouldAsk(state, nodeId, items.length) && !done) return null
  if (!items.length) return null

  return (
    <section
      aria-labelledby={`quiz-title-${nodeId}`}
      className="rounded-xl border border-line bg-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={`quiz-title-${nodeId}`} className="text-[13px] font-medium">
          읽기 전에 세 문제
          <span className="ml-2 font-normal text-faint">
            {done ? `${grade.correctCount}/${items.length} 정답` : '틀려도 됩니다'}
          </span>
        </h2>

        {!done && (
          <button
            type="button"
            onClick={() => persist(skipQuiz(state, nodeId))}
            className="min-h-11 rounded-sm text-[13px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            건너뛰고 바로 읽기
          </button>
        )}
      </div>

      <ol className="divide-y divide-line">
        {items.map((item, index) => {
          const pick = chosen[index] ?? -1
          const answered = pick >= 0 && pick < item.choices.length
          const isCorrect = grade.results[index] === true

          return (
            <li key={item.stem} className="px-4 py-4">
              <fieldset disabled={answered}>
                <legend className="mb-3">
                  <span className="mr-2 text-[12px] text-faint">{KIND_LABEL[item.kind]}</span>
                  <span className="text-[15px] leading-[1.55] text-ink">{item.stem}</span>
                </legend>

                <div className="space-y-2">
                  {item.choices.map((choice, choiceIndex) => {
                    const picked = pick === choiceIndex
                    const revealed = answered && choice.correct === true

                    return (
                      <button
                        key={choice.text}
                        type="button"
                        /* fieldset만으로는 DOM 속성에 안 실린다. 보조기기와 시험 양쪽에 명시한다 */
                        disabled={answered}
                        aria-pressed={picked || undefined}
                        onClick={() =>
                          persist(
                            recordChoice(
                              state,
                              nodeId,
                              index,
                              choiceIndex,
                              items.length,
                              new Date().toISOString(),
                            ),
                          )
                        }
                        className={`flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-[14px] leading-[1.55] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          revealed
                            ? 'border-accent bg-accent-soft text-ink'
                            : picked
                              ? 'border-warn bg-surface text-ink'
                              : 'border-line bg-surface enabled:hover:border-accent disabled:opacity-60'
                        }`}
                      >
                        {/* 정오를 색만으로 알리지 않는다 */}
                        <span
                          aria-hidden
                          className="mt-px w-4 shrink-0 text-[13px] text-faint"
                        >
                          {revealed ? '✓' : picked ? '✕' : ''}
                        </span>
                        <span className="min-w-0 flex-1">{choice.text}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {answered && (
                <p
                  aria-live="polite"
                  className="mt-3 border-l-2 border-line pl-3 text-[13px] leading-[1.6] text-muted"
                >
                  <span className="font-medium text-ink">
                    {isCorrect ? '맞았습니다. ' : '아쉽습니다. '}
                  </span>
                  {item.rationale}
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {done && (
        <p className="border-t border-line px-4 py-3 text-[13px] text-muted">
          {grade.leadsTo.length
            ? '틀린 곳과 이어지는 꼬리질문을 아래 추천 맨 위로 올려 두었습니다.'
            : '다 맞혔습니다. 해설은 확인용으로만 훑어도 됩니다.'}
        </p>
      )}
    </section>
  )
}
