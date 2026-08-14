'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { LearningTrack, ResolvedTrackQuestion } from '@/lib/learning/tracks'
import {
  getOrCreateDailySession,
  type DailySessionSnapshot,
  type LearningReviewCandidate,
} from '@/lib/learning/session'
import { kstToday } from '@/lib/daily/date'
import { loadAnswerPractice } from '@/lib/answer-practice/storage'

export const DAILY_LEARNING_STORAGE_KEY = 'csqt.daily-learning.v1'

type Props = {
  track: LearningTrack
  questions: readonly ResolvedTrackQuestion[]
}

function readSnapshot(): DailySessionSnapshot | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(DAILY_LEARNING_STORAGE_KEY) ?? 'null') as unknown
    if (!value || typeof value !== 'object') return null
    const snapshot = value as DailySessionSnapshot
    if (typeof snapshot.date !== 'string' || typeof snapshot.trackId !== 'string') return null
    if (typeof snapshot.createdAt !== 'string' || !Array.isArray(snapshot.items)) return null
    if (!snapshot.items.every((item) =>
      item && (item.kind === 'review' || item.kind === 'new')
      && typeof item.questionId === 'string' && typeof item.question === 'string'
      && typeof item.reason === 'string',
    )) return null
    return snapshot
  } catch {
    return null
  }
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
    }, readSnapshot())

    setCompleted(new Set(practice.practiceDays[today] ?? []))
    setSnapshot(next)
    try {
      window.localStorage.setItem(DAILY_LEARNING_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 저장을 못 해도 이번 세션의 질문은 보여 준다.
    }
  }, [questions, track.id])

  if (!snapshot) {
    return <div className="h-48 animate-pulse rounded-xl border border-line bg-raised" aria-label="오늘의 3문제 불러오는 중" />
  }

  const done = snapshot.items.filter((item) => completed.has(item.questionId)).length

  return (
    <section aria-labelledby="daily-learning-heading" className="rounded-xl border border-line bg-raised p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium text-faint">{track.title}</p>
          <h2 id="daily-learning-heading" className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">오늘의 3문제</h2>
          <p className="mt-1 text-[13px] text-muted">복습부터 채우고 남는 자리에 새 질문을 넣었어요. 약 15분</p>
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
