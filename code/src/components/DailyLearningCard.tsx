'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { LearningTrack, ResolvedTrackQuestion } from '@/lib/learning/tracks'
import {
  getOrCreateDailySession,
  type DailySessionSnapshot,
  type LearningReviewCandidate,
} from '@/lib/learning/session'
import { kstToday } from '@/lib/daily/date'
import { loadAnswerPractice } from '@/lib/answer-practice/storage'
import { loadDailySession, saveDailySession } from '@/lib/learning/storage'

type Props = {
  track: LearningTrack
  questions: readonly ResolvedTrackQuestion[]
}

export function DailyLearningCard({ track, questions }: Props) {
  const [snapshot, setSnapshot] = useState<DailySessionSnapshot | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    const today = kstToday()
    const practice = loadAnswerPractice()
    const questionById = new Map(questions.map((question) => [question.id, question.question]))
    const reviews: LearningReviewCandidate[] = Object.entries(practice.reviews)
      .flatMap(([questionId, review]) => {
        const question = questionById.get(questionId)
        return question ? [{ questionId, question, status: review.status, nextReviewOn: review.nextReviewOn }] : []
      })
    const completedQuestionIds = new Set(Object.values(practice.practiceDays).flat())
    const next = getOrCreateDailySession({
      today,
      trackId: track.id,
      createdAt: new Date().toISOString(),
      trackQuestions: questions,
      reviews,
      completedQuestionIds,
    }, loadDailySession())

    setCompleted(new Set(practice.practiceDays[today] ?? []))
    setSnapshot(next)
    saveDailySession(next)
  }, [questions, track.id])

  if (!snapshot) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-raised" aria-label="오늘의 3문제 불러오는 중" />
  }

  const done = snapshot.items.filter((item) => completed.has(item.questionId)).length

  return (
    <section aria-labelledby="daily-learning-heading" className="rounded-xl border border-line bg-raised p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {/*
            다 풀었으면 찾아낸 얼굴로 바꾼다. 폰에서는 히어로의 두더지가 제목을
            가려 빼 두었으므로, 첫 화면에서 마스코트를 만나는 자리가 여기다.
          */}
          <Image
            src={done === snapshot.items.length ? '/mascot/mole-found.png' : '/mascot/mole-curious.png'}
            alt=""
            aria-hidden
            width={44}
            height={44}
            /*
             * 이 카드는 저장소를 읽은 뒤에야 붙는다. 기본 lazy로 두면 이미
             * 지나간 자리로 취급돼 영영 안 불러온다 — 실제로 빈 자리만 남았다.
             */
            priority
            className="mt-0.5 size-11 shrink-0 select-none"
          />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-faint">{track.title}</p>
            <h2 id="daily-learning-heading" className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">오늘의 3문제</h2>
            <p className="mt-1 text-[13px] text-muted">복습부터 채우고 남는 자리에 새 질문을 넣었어요. 약 15분</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-muted" aria-label={`${snapshot.items.length}문제 중 ${done}문제 완료`}>
          {done}/{snapshot.items.length}
        </span>
      </div>

      <ol className="mt-5 divide-y divide-line">
        {snapshot.items.map((item, index) => {
          const isDone = completed.has(item.questionId)
          return (
            <li key={item.questionId}>
              <Link
                href={`/q/${item.questionId}`}
                className="group flex min-h-16 items-center gap-3 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${isDone ? 'bg-accent text-white' : 'bg-surface text-muted'}`} aria-hidden>
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14px] font-medium leading-snug ${isDone ? 'text-muted line-through' : 'text-ink group-hover:text-accent'}`}>{item.question}</span>
                  <span className="mt-1 block text-[12px] text-faint">{isDone ? '오늘 자기 점검 완료' : item.reason}</span>
                </span>
                <span aria-hidden className="text-muted group-hover:text-accent">→</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
