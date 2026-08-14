// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MePanel } from '@/components/MePanel'
import {
  saveAnswerPractice,
  updateAnswerDraft,
  emptyAnswerPractice,
  markAnswerReview,
} from '@/lib/answer-practice/storage'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('학습 기록의 답변 초안', () => {
  it('저장한 초안을 질문 링크로 다시 이어준다', async () => {
    const draft = updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '2026-08-13')
    saveAnswerPractice(markAnswerReview(draft, 'q1', 'needs-review', '2026-08-13'))
    render(
      <MePanel
        all={[{ id: 'q1', number: 7, question: '멱등성이 필요한 이유는?', category: '분산시스템' }]}
        track={{ title: '백엔드 CS 면접 30', total: 2, questionIds: ['q1', 'q2'] }}
      />,
    )

    await waitFor(() => expect(screen.getByText('답변 기록')).toBeTruthy())
    const archive = screen.getByText('답변 기록').closest('section')!
    const link = archive.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/q/7')
    expect(archive.querySelector('span')?.textContent).toContain('다시 볼 답')
    expect(screen.getByText('다시 볼 답 1개')).toBeTruthy()
    expect(screen.getByText('오늘 복습')).toBeTruthy()
    expect(screen.getByText('1/2문제 자기 점검')).toBeTruthy()
    expect(screen.getByText('1개')).toBeTruthy()
    expect(screen.getByText(/답변 초안은 로그인해도/)).toBeTruthy()
  })
})
