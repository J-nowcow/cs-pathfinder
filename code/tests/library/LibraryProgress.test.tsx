// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryProgress } from '@/components/library/LibraryProgress'
import { emptyLibrary, updateStudy, LIBRARY_KEY } from '@/lib/library/storage'
beforeEach(() => localStorage.clear())
afterEach(cleanup)
const exam = 'impe-140-1-06'
function seed() {
  const older = new Date(Date.now() - 3 * 86400000).toISOString()
  const latest = new Date(Date.now() - 3600000).toISOString()
  let state = updateStudy(
    emptyLibrary(),
    'topic:normalization',
    {
      title: '정규화와 역정규화',
      href: '/learn/engineer/normalization',
      track: 'engineer',
    },
    { status: 'review' },
    older,
  )!
  state = updateStudy(
    state,
    'exam:' + exam,
    {
      title: '140회 1교시 6번',
      href: '/learn/engineer?exam=' + exam + '#' + exam,
      track: 'engineer',
    },
    { draft: '검색 결과를 결합할 때 두 점수의 기준을 확인한다.' },
    latest,
  )!
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(state))
  return JSON.stringify(state)
}
describe('통계보다 공부할 내용을 앞세우는 서재', () => {
  it('가장 최근 항목을 크게 표시하고 정확한 이어보기 주소·내 초안을 유지한다', async () => {
    const before = seed()
    render(<LibraryProgress questionTitles={{ [exam]: '하이브리드 검색' }} />)
    const focus = within(
      screen.getByRole('region', { name: '이어서 공부할 내용' }),
    )
    expect(focus.getByRole('heading', { name: '하이브리드 검색' })).toBeTruthy()
    expect(
      focus.getByRole('link', { name: '이어서 읽기' }).getAttribute('href'),
    ).toBe('/learn/engineer?exam=' + exam + '#' + exam)
    expect(focus.getByText(/두 점수의 기준/)).toBeTruthy()
    const review = within(screen.getByRole('region', { name: '복습할 내용' }))
    expect(review.getByRole('link', { name: /정규화와 역정규화/ })).toBeTruthy()
    const disclosure = screen.getByText('분야별 학습 기록').closest('details')!
    expect(disclosure.open).toBe(false)
    await userEvent.setup().click(screen.getByText('분야별 학습 기록'))
    expect(disclosure.open).toBe(true)
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
  })
  it('keeps personal resume/review in the shelf and points catalogue discovery to the separate home', () => {
    seed()
    render(
      <LibraryProgress
        mode="shelf"
        questionTitles={{ [exam]: '하이브리드 검색' }}
      />,
    )
    expect(screen.getByRole('link', { name: '이어서 읽기' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: '공부 자료' })).toBeNull()
    expect(screen.getByRole('link', { name: '다른 공부 자료 찾기 →' }).getAttribute('href')).toBe('/')
    expect(
      screen
        .getByRole('link', { name: /복습할 내용 1개/ })
        .getAttribute('href'),
    ).toBe('/learn/progress#desk-review-heading')
    expect(screen.queryByText('분야별 학습 기록')).toBeNull()
  })
  it('기록이 없으면 실제 공부 자료를 제시하고 가짜 진도나 최근 기록을 만들지 않는다', () => {
    render(<LibraryProgress />)
    expect(screen.getByRole('region', { name: '공부 시작하기' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '이어서 읽기' })).toBeNull()
    expect(
      screen
        .getByRole('link', { name: /정보관리기술사 정규화와 역정규화/ })
        .getAttribute('href'),
    ).toBe('/learn/engineer/normalization')
    expect(
      screen.queryByRole('heading', { name: '이전에 공부한 내용' }),
    ).toBeNull()
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull()
  })
})
