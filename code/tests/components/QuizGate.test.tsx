// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizGate } from '@/components/QuizGate'
import { QUIZ_STORAGE_KEY } from '@/lib/quiz/storage'
import type { QuizItem } from '../../data/quiz'

afterEach(cleanup)
beforeEach(() => window.localStorage.clear())

const items: QuizItem[] = [
  {
    kind: 'concept',
    stem: '개념을 묻는 문제',
    choices: [
      { text: '개념 정답', correct: true },
      { text: '개념 오답', leadsTo: 2 },
    ],
    rationale: '개념 근거',
  },
  {
    kind: 'misconception',
    stem: '오해를 묻는 문제',
    choices: [
      { text: '오해 오답', leadsTo: 4 },
      { text: '오해 정답', correct: true },
    ],
    rationale: '오해 근거',
  },
  {
    kind: 'boundary',
    stem: '조건을 묻는 문제',
    choices: [
      { text: '조건 정답', correct: true },
      { text: '조건 오답', leadsTo: 1 },
    ],
    rationale: '조건 근거',
  },
]

function renderGate(onGrade = vi.fn()) {
  render(<QuizGate nodeId="n1" items={items} onGrade={onGrade} />)
  return onGrade
}

describe('QuizGate', () => {
  it('세 문제를 한 화면에 모두 편다', () => {
    renderGate()
    for (const item of items) expect(screen.getByText(item.stem)).toBeTruthy()
  })

  it('고르기 전에는 근거를 감춘다', () => {
    renderGate()
    expect(screen.queryByText(/개념 근거/)).toBeNull()
  })

  it('고르면 정오와 근거를 바로 보여준다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))

    expect(screen.getByText(/개념 근거/)).toBeTruthy()
    expect(screen.getByText(/아쉽습니다/)).toBeTruthy()
  })

  it('맞히면 맞았다고 알린다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    expect(screen.getByText(/맞았습니다/)).toBeTruthy()
  })

  it('한 번 고른 문제는 다시 고를 수 없다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))
    expect(screen.getByRole('button', { name: /개념 정답/ }).hasAttribute('disabled')).toBe(true)
  })

  it('틀린 문제가 겨냥한 꼬리질문을 부모에게 알린다', async () => {
    const onGrade = renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))
    await userEvent.click(screen.getByRole('button', { name: '오해 오답' }))

    expect(onGrade).toHaveBeenLastCalledWith([2, 4])
  })

  it('다 맞히면 아무 데도 보내지 않는다', async () => {
    const onGrade = renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    await userEvent.click(screen.getByRole('button', { name: '오해 정답' }))
    await userEvent.click(screen.getByRole('button', { name: '조건 정답' }))

    expect(onGrade).toHaveBeenLastCalledWith([])
    expect(screen.getByText(/다 맞혔습니다/)).toBeTruthy()
  })

  it('다 풀면 점수를 보여준다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    await userEvent.click(screen.getByRole('button', { name: '오해 오답' }))
    await userEvent.click(screen.getByRole('button', { name: '조건 정답' }))

    expect(screen.getByText('2/3 정답')).toBeTruthy()
    expect(screen.getByText(/맨 위로 올려/)).toBeTruthy()
  })

  it('건너뛰면 사라지고 저장에 남는다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '건너뛰고 바로 읽기' }))

    expect(screen.queryByText('개념을 묻는 문제')).toBeNull()
    expect(window.localStorage.getItem(QUIZ_STORAGE_KEY)).toContain('n1')
  })

  it('건너뛴 노드는 다시 열어도 안 묻는다', () => {
    window.localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({ version: 1, attempts: {}, skipped: ['n1'] }),
    )
    renderGate()
    expect(screen.queryByText('개념을 묻는 문제')).toBeNull()
  })

  it('이미 푼 노드는 결과를 그대로 다시 보여준다', () => {
    window.localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        attempts: { n1: { chosen: [1, 1, 0], at: 'now' } },
        skipped: [],
      }),
    )
    renderGate()

    expect(screen.getByText('2/3 정답')).toBeTruthy()
    expect(screen.getByText(/개념 근거/)).toBeTruthy()
  })

  it('다 푼 뒤에는 건너뛰기를 감춘다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    expect(screen.getByRole('button', { name: '건너뛰고 바로 읽기' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: '오해 정답' }))
    await userEvent.click(screen.getByRole('button', { name: '조건 정답' }))
    expect(screen.queryByRole('button', { name: '건너뛰고 바로 읽기' })).toBeNull()
  })

  it('문제가 없으면 아무것도 안 그린다', () => {
    const { container } = render(<QuizGate nodeId="n1" items={[]} onGrade={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
