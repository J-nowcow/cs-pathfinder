// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnswerPractice } from '@/components/AnswerPractice'
import {
  ANSWER_PRACTICE_STORAGE_KEY,
  LEGACY_ANSWER_PRACTICE_STORAGE_KEY,
  deserializeAnswerPractice,
} from '@/lib/answer-practice/storage'

beforeEach(() => window.localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

  it('이전 버전 초안과 자기 점검을 잃지 않고 이어 쓴다', async () => {
    window.localStorage.setItem(LEGACY_ANSWER_PRACTICE_STORAGE_KEY, JSON.stringify({
      version: 1,
      drafts: {
        q1: {
          text: '예전 답',
          updatedAt: '2026-08-13T00:00:00Z',
          reviewStatus: 'needs-review',
          reviewedAt: '2026-08-13T00:01:00Z',
        },
      },
    }))
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)

    await user.click(screen.getByText('내 답변 적어보기'))
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('예전 답')
    await user.type(screen.getByRole('textbox'), ' 이어쓰기')
    await waitFor(() => {
      const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
      expect(state.drafts.q1.text).toBe('예전 답 이어쓰기')
      expect(state.reviews.q1.status).toBe('needs-review')
    })
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

  it('탭을 닫는 순간에도 기다리던 자동 저장을 마친다', async () => {
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '탭 닫기 직전 답')
    window.dispatchEvent(new Event('pagehide'))

    const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
    expect(state.drafts.q1.text).toBe('탭 닫기 직전 답')
    await waitFor(() => expect(screen.getByText(/이 브라우저에 자동 저장/)).toBeTruthy())
  })

  it('브라우저 저장소가 막히면 저장 실패를 숨기지 않는다', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '저장할 답')

    await waitFor(() => expect(screen.getByText('저장하지 못했습니다')).toBeTruthy())
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

  it('모범답안과 비교한 결과를 점수 없이 복습 표시로 남긴다', async () => {
    const user = userEvent.setup()
    render(<AnswerPractice nodeId="q1" modelAnswer="검증된 모범답안" />)
    await user.click(screen.getByText('내 답변 적어보기'))
    await user.type(screen.getByRole('textbox'), '내 답')
    await user.click(screen.getByText('모범답안 확인하기'))
    await user.click(screen.getByRole('button', { name: '다시 볼래요' }))

    const state = deserializeAnswerPractice(window.localStorage.getItem(ANSWER_PRACTICE_STORAGE_KEY))
    expect(state.reviews.q1.status).toBe('needs-review')
    expect(screen.getByRole('button', { name: '다시 볼래요' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('status').textContent).toMatch(/다음 복습일 \d{4}년 \d{1,2}월 \d{1,2}일/)
    expect(screen.queryByText(/점$/)).toBeNull()
  })
})
