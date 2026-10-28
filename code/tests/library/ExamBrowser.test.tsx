// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExamBrowser } from '@/components/library/ExamBrowser'
import { emptyLibrary, updateStudy, LIBRARY_KEY } from '@/lib/library/storage'
import index from '../../data/engineer-index.json'
import guides from '../../data/engineer-guides.json'
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.removeItem(LIBRARY_KEY)
  window.history.replaceState(null, '', '/')
})
const props = {
  questions: index.questions,
  topicTitles: Object.fromEntries(guides.map((g) => [g.id, g.title])),
}
const reviewed = index.questions.filter((q) => q.classification)
describe('기출의 핵심·배경 및 분류 상태', () => {
  it('원문 대조/자동 상태, 수업 역할과 요구 유형을 함께 필터하고 초기화한다', async () => {
    const user = userEvent.setup()
    render(<ExamBrowser {...props} />)
    await user.click(screen.getByText('교시·분류·자료 범위 더 고르기'))
    await user.selectOptions(screen.getByLabelText('분류 상태'), 'reviewed')
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('31개 기록')
    await user.selectOptions(
      screen.getByLabelText('수업 연결 구분'),
      'background',
    )
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain(
      `${reviewed.filter((q) => q.backgroundTopics.length).length}개 기록`,
    )
    await user.selectOptions(screen.getByLabelText('요구 유형'), '설계')
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('검색 결과 없음')
    await user.click(screen.getByRole('button', { name: '조건 초기화' }))
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('1,860개 기록')
    await user.selectOptions(screen.getByLabelText('분류 상태'), 'candidate')
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('1,829개 기록')
  })
  it('하이브리드 검색은 핵심 검색 주제와 RAG 보충을 구분하고 클라우드 링크를 붙이지 않는다', () => {
    const q = index.questions.find((q) => q.id === 'impe-140-1-06')!
    render(<ExamBrowser {...props} questions={[q]} />)
    const card = within(screen.getByRole('article'))
    expect(card.getByText(/핵심 출제 주제:/).textContent).toContain(
      '하이브리드 검색',
    )
    expect(
      card.getByRole('link', { name: /보충: 생성형 AI와 RAG/ }),
    ).toBeTruthy()
    expect(card.queryByRole('link', { name: /클라우드/ })).toBeNull()
    expect(card.getByText(/요구 유형에 학습용 해석 포함/)).toBeTruthy()
    expect(card.getByText(/원래 기술명 색인 확인/)).toBeTruthy()
  })
  it('보충만 있는 문항을 연결 대기에서 제외하고 핵심·보충 필터를 교차하지 않는다', async () => {
    const user = userEvent.setup()
    const q = index.questions.find((q) => q.id === 'impe-140-1-06')!
    render(<ExamBrowser {...props} questions={[q]} />)
    await user.click(screen.getByText('교시·분류·자료 범위 더 고르기'))
    await user.selectOptions(screen.getByLabelText('수업 연결 구분'), 'core')
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('검색 결과 없음')
    await user.selectOptions(
      screen.getByLabelText('수업 연결 구분'),
      'background',
    )
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('1개 기록')
    await user.selectOptions(screen.getByLabelText('자료 범위'), 'unclassified')
    expect(
      screen.getByRole('status', { name: '기출 검색 결과' }).textContent,
    ).toContain('검색 결과 없음')
  })
})

describe('exam result pagination reading position', () => {
  it('preserves direct exam resume and opens its note without taking result-status focus', () => {
    const question = index.questions[20]
    window.history.replaceState(null, '', '/learn/engineer?exam=' + question.id + '#' + question.id)
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    render(<ExamBrowser {...props} questions={index.questions.slice(0, 25)} />)
    const article = screen.getByRole('article')
    expect(article.id).toBe(question.id)
    expect(article.querySelector('details[data-exam-note]')?.hasAttribute('open')).toBe(true)
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
    expect(document.activeElement).not.toBe(screen.getByRole('status', { name: '기출 검색 결과' }))
  })

  it('starts the next and previous result sets at their status, then tabs to their first link', async () => {
    const user = userEvent.setup()
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    render(<ExamBrowser {...props} questions={index.questions.slice(0, 25)} />)
    const result = screen.getByRole('status', { name: '기출 검색 결과' })
    expect(scroll).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '다음20개 →' }))
    expect(result.textContent).toContain('21–25')
    expect(document.activeElement).toBe(result)
    expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior: 'instant' })
    expect(screen.getByRole('button', { name: '다음20개 →' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getAllByRole('article')[0].id).toBe(index.questions[20].id)
    await user.tab()
    expect(document.activeElement).toBe(within(screen.getAllByRole('article')[0]).getByRole('link', { name: 'Q-Net 공식 문제지 ↗' }))
    await user.click(screen.getByRole('button', { name: '← 이전20개' }))
    expect(result.textContent).toContain('1–20')
    expect(document.activeElement).toBe(result)
    expect(scroll).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: '← 이전20개' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps filter/reset focus and saved records when returning to the first result set', async () => {
    const user = userEvent.setup()
    const scroll = vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => {})
    const question = index.questions[0]
    const stored = JSON.stringify(updateStudy(emptyLibrary(), 'exam:' + question.id, {
      title: 'Synthetic existing exam answer',
      href: '/learn/engineer?exam=' + question.id + '#' + question.id,
      track: 'engineer',
    }, { draft: 'Synthetic existing draft', checks: ['Synthetic checked condition'], status: 'review' }, '2026-10-27T10:00:00.000Z'))
    expect(JSON.parse(stored).entries['exam:' + question.id].due).toBe('2026-10-28')
    localStorage.setItem(LIBRARY_KEY, stored)
    render(<ExamBrowser {...props} questions={index.questions.slice(0, 25)} />)
    await user.click(screen.getByRole('button', { name: '다음20개 →' }))
    const filter = screen.getByLabelText('회차')
    await user.selectOptions(filter, String(index.questions[0].round))
    expect(document.activeElement).toBe(filter)
    expect(screen.getByRole('status', { name: '기출 검색 결과' }).textContent).toContain('1–20')
    expect(scroll).toHaveBeenCalledTimes(1)
    const reset = screen.getByRole('button', { name: '조건 초기화' })
    await user.click(reset)
    expect(document.activeElement).toBe(reset)
    expect(scroll).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(stored)
  })
})
