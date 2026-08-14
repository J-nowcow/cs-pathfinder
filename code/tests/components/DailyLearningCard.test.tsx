// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DailyLearningCard } from '@/components/DailyLearningCard'
import { DAILY_LEARNING_STORAGE_KEY } from '@/lib/learning/storage'
import { emptyAnswerPractice, markAnswerReview, saveAnswerPractice, updateAnswerDraft } from '@/lib/answer-practice/storage'
import { kstToday } from '@/lib/daily/date'
import type { LearningTrack, ResolvedTrackQuestion } from '@/lib/learning/tracks'

const track: LearningTrack = {
  id: 'backend',
  title: '백엔드 CS 면접 30',
  description: '테스트 트랙',
  audience: '취준생',
  estimatedMinutesPerQuestion: 5,
  contentReviewedOn: '2026-08-14',
  questionKeys: ['질문 1', '질문 2', '질문 3'],
}

const questions: ResolvedTrackQuestion[] = track.questionKeys.map((question, index) => ({
  id: `q${index + 1}`,
  question,
  position: index + 1,
}))

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('오늘의 3문제 카드', () => {
  it('첫 방문에는 트랙의 새 질문 세 개를 보여 준다', async () => {
    render(<DailyLearningCard track={track} questions={questions} />)

    expect(await screen.findByRole('heading', { name: '오늘의 3문제' })).not.toBeNull()
    expect(screen.getByText('약 15분', { exact: false })).not.toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getByLabelText('3문제 중 0문제 완료')).not.toBeNull()
  })

  it('오늘 자기 점검한 질문을 완료로 표시한다', async () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', new Date().toISOString())
    saveAnswerPractice(markAnswerReview(draft, 'q1', 'understood', new Date().toISOString()))
    window.localStorage.setItem(DAILY_LEARNING_STORAGE_KEY, JSON.stringify({
      date: kstToday(),
      trackId: track.id,
      createdAt: new Date().toISOString(),
      items: questions.map((question) => ({
        kind: 'new', questionId: question.id, question: question.question, reason: '처음 선택',
      })),
    }))

    render(<DailyLearningCard track={track} questions={questions} />)

    expect(await screen.findByLabelText('3문제 중 1문제 완료')).not.toBeNull()
    expect(screen.getByText('오늘 자기 점검 완료')).not.toBeNull()
  })

  it('같은 날 저장한 순서를 새로고침해도 유지한다', async () => {
    window.localStorage.setItem(DAILY_LEARNING_STORAGE_KEY, JSON.stringify({
      date: kstToday(),
      trackId: track.id,
      createdAt: new Date().toISOString(),
      items: [{ kind: 'new', questionId: 'kept', question: '유지할 질문', reason: '처음 선택' }],
    }))

    render(<DailyLearningCard track={track} questions={questions} />)

    expect(await screen.findByText('유지할 질문')).not.toBeNull()
    expect(screen.getByLabelText('1문제 중 0문제 완료')).not.toBeNull()
  })

  it('깨진 스냅샷은 버리고 다시 선택한다', async () => {
    window.localStorage.setItem(DAILY_LEARNING_STORAGE_KEY, '{깨짐')

    render(<DailyLearningCard track={track} questions={questions} />)

    expect(await screen.findByText('질문 1')).not.toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })
})
