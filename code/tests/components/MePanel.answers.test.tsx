// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MePanel } from '@/components/MePanel'
import { saveAnswerPractice, updateAnswerDraft, emptyAnswerPractice } from '@/lib/answer-practice/storage'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('학습 기록의 답변 초안', () => {
  it('저장한 초안을 질문 링크로 다시 이어준다', async () => {
    saveAnswerPractice(updateAnswerDraft(emptyAnswerPractice(), 'q1', '내 답', '2026-08-13'))
    render(
      <MePanel
        all={[{ id: 'q1', number: 7, question: '멱등성이 필요한 이유는?', category: '분산시스템' }]}
      />,
    )

    await waitFor(() => expect(screen.getByText('답변 초안')).toBeTruthy())
    const archive = screen.getByText('답변 초안').closest('section')!
    const link = archive.querySelector('a')
    expect(link?.getAttribute('href')).toBe('/q/7')
    expect(screen.getByText('1개')).toBeTruthy()
    expect(screen.getByText(/답변 초안은 로그인해도/)).toBeTruthy()
  })
})
