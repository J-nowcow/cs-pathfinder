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

const next = () => screen.getByRole('button', { name: /다음 문제/ })

describe('QuizGate', () => {
  it('한 번에 한 문제만 편다', () => {
    renderGate()
    expect(screen.getByText('개념을 묻는 문제')).toBeTruthy()
    expect(screen.queryByText('오해를 묻는 문제')).toBeNull()
    expect(screen.queryByText('조건을 묻는 문제')).toBeNull()
  })

  it('몇 번째 문제이고 무엇을 재는지 알려 준다', () => {
    renderGate()
    expect(screen.getByText(/첫 번째 · 개념/)).toBeTruthy()
  })

  it('고르기 전에는 근거를 감춘다', () => {
    renderGate()
    expect(screen.queryByText(/개념 근거/)).toBeNull()
  })

  it('고르면 정오와 근거를 바로 보여준다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))

    expect(screen.getByText(/개념 근거/)).toBeTruthy()
    expect(screen.getByText(/아쉬워요/)).toBeTruthy()
  })

  it('맞히면 맞았다고 알린다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    expect(screen.getByText(/맞았어요/)).toBeTruthy()
  })

  it('한 번 고른 문제는 다시 고를 수 없다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))
    expect(screen.getByRole('button', { name: /개념 정답/ }).hasAttribute('disabled')).toBe(true)
  })

  it('답해야 다음으로 넘어가는 버튼이 나온다', async () => {
    renderGate()
    expect(screen.queryByRole('button', { name: /다음 문제/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    expect(next()).toBeTruthy()
  })

  it('다음을 누르면 두 번째 문제로 넘어간다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    await userEvent.click(next())

    expect(screen.getByText('오해를 묻는 문제')).toBeTruthy()
    expect(screen.queryByText('개념을 묻는 문제')).toBeNull()
    expect(screen.getByText(/두 번째 · 흔한 오해/)).toBeTruthy()
  })

  it('푼 개수를 센다', async () => {
    renderGate()
    expect(screen.getByText('0 / 3')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('틀린 문제가 겨냥한 꼬리질문을 부모에게 알린다', async () => {
    const onGrade = renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))
    await userEvent.click(next())
    await userEvent.click(screen.getByRole('button', { name: '오해 오답' }))

    expect(onGrade).toHaveBeenLastCalledWith([2, 4])
  })

  it('마지막까지 풀면 결과를 알리고 다음 버튼을 감춘다', async () => {
    const onGrade = renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 정답' }))
    await userEvent.click(next())
    await userEvent.click(screen.getByRole('button', { name: '오해 정답' }))
    await userEvent.click(next())
    await userEvent.click(screen.getByRole('button', { name: '조건 정답' }))

    expect(screen.getByText(/다 맞혔어요/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /다음 문제/ })).toBeNull()
    expect(onGrade).toHaveBeenLastCalledWith([])
  })

  it('틀린 것이 있으면 추천을 올려 뒀다고 알린다', async () => {
    renderGate()
    await userEvent.click(screen.getByRole('button', { name: '개념 오답' }))
    await userEvent.click(next())
    await userEvent.click(screen.getByRole('button', { name: '오해 정답' }))
    await userEvent.click(next())
    await userEvent.click(screen.getByRole('button', { name: '조건 정답' }))

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

  it('중간까지 푼 노드는 이어서 풀 자리에서 연다', () => {
    window.localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        attempts: { n1: { chosen: [0, -1, -1], at: 'now' } },
        skipped: [],
      }),
    )
    renderGate()
    expect(screen.getByText('오해를 묻는 문제')).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('다 푼 노드는 마지막 문제와 결과를 보여준다', () => {
    window.localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        attempts: { n1: { chosen: [1, 1, 0], at: 'now' } },
        skipped: [],
      }),
    )
    renderGate()
    expect(screen.getByText('조건을 묻는 문제')).toBeTruthy()
    expect(screen.getByText('3 / 3')).toBeTruthy()
    expect(screen.getByText(/맨 위로 올려/)).toBeTruthy()
  })

  it('문제가 없으면 아무것도 안 그린다', () => {
    const { container } = render(<QuizGate nodeId="n1" items={[]} onGrade={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
