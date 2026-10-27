// @vitest-environment happy-dom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExamBrowser } from '@/components/library/ExamBrowser'
import index from '../../data/engineer-index.json'
import guides from '../../data/engineer-guides.json'
afterEach(cleanup)
const props = {
  questions: index.questions,
  topicTitles: Object.fromEntries(guides.map((g) => [g.id, g.title])),
}
const reviewed = index.questions.filter((q) => q.classification)
describe('기출의 핵심·배경 및 분류 상태', () => {
  it('원문 대조/자동 상태, 수업 역할과 요구 유형을 함께 필터하고 초기화한다', async () => {
    const user = userEvent.setup()
    render(<ExamBrowser {...props} />)
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
