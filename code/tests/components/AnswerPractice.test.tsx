// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnswerPractice } from '@/components/AnswerPractice'
import { ANSWER_PRACTICE_STORAGE_KEY, deserializeAnswerPractice } from '@/lib/answer-practice/storage'

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('면접 답변 연습', () => {
  it('답변칸과 모범답안은 처음에 접혀 있다', () => {
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    expect(screen.getByText('내 답변 적어보기').closest('details')?.open).toBe(false)
    expect(screen.getByText('모범답안 확인하기').closest('details')?.open).toBe(false)
  })

  it('쓴 답변을 현재 브라우저에 질문별로 저장한다', async () => {
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '핵심 답변')

    await waitFor(() => {
      const state = deserializeAnswerPractice(
        window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY),
      )
      expect(state.drafts.q1.text).toBe('핵심 답변')
    })
    expect(screen.getByText(/이 브라우저에 자동 저장/)).toBeTruthy()
  })

  it('초안을 직접 지울 수 있다', async () => {
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '지울 답변')
    await user.click(screen.getByRole('button', { name: '초안 지우기' }))

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
    const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
    expect(state.drafts.q1).toBeUndefined()
  })

  it('자동 저장을 기다리기 전에 화면을 떠나도 마지막 입력을 보존한다', async () => {
    const user = userEvent.setup()
    const view = render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '떠나기 직전 답')
    view.unmount()

    const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
    expect(state.drafts.q1.text).toBe('떠나기 직전 답')
  })

  it('설정을 켜면 다음 질문의 답변칸도 펼친다', async () => {
    const user = userEvent.setup()
    const first = render(<AnswerPractice nodeId="q1" modelAnswer="답" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.click(screen.getByRole('checkbox'))
    first.unmount()

    render(<AnswerPractice nodeId="q2" modelAnswer="답" />)
    expect(screen.getByText('내 답변 적어보기').closest('details')?.open).toBe(true)
  })

  it('모범답안을 열기 전에는 본문을 보여주지 않는다', async () => {
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="검증된 모범답안" />)
    const details = screen.getByText('모범답안 확인하기').closest('details')!
    expect(details.open).toBe(false)
    await user.click(screen.getByText('모범답안 확인하기'))
    expect(details.open).toBe(true)
    expect(screen.getByText('검증된 모범답안')).toBeTruthy()
  })
})
