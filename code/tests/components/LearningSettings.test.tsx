// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LearningSettings } from '@/components/LearningSettings'
import { ANSWER_PRACTICE_STORAGE_KEY, deserializeAnswerPractice } from '@/lib/answer-practice/storage'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('학습 설정', () => {
  it('답변칸을 항상 펼치는 설정을 브라우저에 저장한다', async () => {
    const user = userEvent.setup()
    render(<LearningSettings />)
    const checkbox = screen.getByRole('checkbox', { name: /답변칸 항상 펼치기/ })
    await user.click(checkbox)

    expect((checkbox as HTMLInputElement).checked).toBe(true)
    const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
    expect(state.alwaysOpen).toBe(true)
  })

  it('모범답안은 계속 접어 둔다는 범위를 알린다', () => {
    render(<LearningSettings />)
    expect(screen.getByText(/모범답안은 계속 접어 둡니다/)).toBeTruthy()
    expect(screen.getByText(/현재 브라우저에만 저장/)).toBeTruthy()
  })
})
