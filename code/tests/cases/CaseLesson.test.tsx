// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaseLesson } from '@/components/cases/CaseLesson'
import { CASE_STORAGE_KEY, changeRoleRecord, emptySession } from '@/lib/cases/storage'

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('evidence case learning', () => {
  it('preserves the first answer and assistance context through revision and new conditions', async () => {
    const user = userEvent.setup()
    render(<CaseLesson />)
    expect(screen.getByRole('button', { name: '첫 판단 남기고 비교하기' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'F2와 F3를 확인한다.' } })
    await user.selectOptions(screen.getByRole('combobox'), 'reported-none')
    await user.click(screen.getByRole('button', { name: '첫 판단 남기고 비교하기' }))
    expect(screen.getByText('첫 제출 전에 작성 예시를 열지 않았습니다. 받지 않았다고 표시')).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/무엇을 바꿨나요/), { target: { value: '연결 여유도 확인한다.' } })
    await user.click(screen.getByRole('button', { name: '새 조건으로 연습하기' }))
    expect(screen.queryByText('작성자가 만든 예시')).toBeNull()
    fireEvent.change(screen.getByLabelText('새 조건에서 내 판단'), { target: { value: '내부 작업의 연결 점유를 확인한다.' } })
    await user.click(screen.getByRole('button', { name: '답안 남기고 스스로 점검하기' }))
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    const record = JSON.parse(localStorage.getItem(CASE_STORAGE_KEY)!).records.developer
    expect(record.first).toMatchObject({ text: 'F2와 F3를 확인한다.', exampleViewed: false, assistance: 'reported-none' })
    expect(record.applied).toMatchObject({ text: '내부 작업의 연결 점유를 확인한다.', assistance: 'unspecified' })
  })
  it('records example exposure separately from unspecified external help', async () => {
    const user = userEvent.setup()
    render(<CaseLesson />)
    await user.click(screen.getByText('작성 예시 먼저 보기'))
    await waitFor(() => expect(document.querySelector('details[open]')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: '예시를 보고 작성했다.' } })
    await user.click(screen.getByRole('button', { name: '첫 판단 남기고 비교하기' }))
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    expect(JSON.parse(localStorage.getItem(CASE_STORAGE_KEY)!).records.developer.first).toMatchObject({ exampleViewed: true, assistance: 'unspecified' })
  })
  it('retains separate role drafts and the same answer when changing language', async () => {
    const user = userEvent.setup()
    render(<CaseLesson />)
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Dev draft' } })
    await user.click(screen.getByLabelText('프로젝트 PM'))
    expect((screen.getByLabelText('지금 내 판단') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Project draft' } })
    await user.click(screen.getByRole('button', { name: 'English' }))
    expect((screen.getByLabelText('My judgment now') as HTMLTextAreaElement).value).toBe('Project draft')
    expect(document.querySelector('article')?.lang).toBe('en')
    await user.click(screen.getByLabelText('Developer'))
    expect((screen.getByLabelText('My judgment now') as HTMLTextAreaElement).value).toBe('Dev draft')
  })
  it('closes the example on a role change rather than displaying an unrecorded new example', async () => {
    const user = userEvent.setup()
    render(<CaseLesson />)
    await user.click(screen.getByText('작성 예시 먼저 보기'))
    await waitFor(() => expect(document.querySelector('details[open]')).toBeTruthy())
    await user.click(screen.getByLabelText('프로젝트 PM'))
    expect(document.querySelector('details[open]')).toBeNull()
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Project reasoning' } })
    await user.click(screen.getByRole('button', { name: '첫 판단 남기고 비교하기' }))
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    expect(JSON.parse(localStorage.getItem(CASE_STORAGE_KEY)!).records.project.first.exampleViewed).toBe(false)
  })
  it('keeps the current input after a write failure', async () => {
    const user = userEvent.setup()
    render(<CaseLesson />)
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw Error('quota') })
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Unsent draft' } })
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    expect(screen.getByRole('alert').textContent).toContain('저장하지 못했습니다')
    expect((screen.getByLabelText('지금 내 판단') as HTMLTextAreaElement).value).toBe('Unsent draft')
  })
  it('preserves corrupt storage and refuses to overwrite another tab', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CASE_STORAGE_KEY, '{broken')
    const view = render(<CaseLesson />)
    expect(screen.getByRole('alert').textContent).toContain('원래 기록은 그대로')
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Keep this' } })
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    expect(localStorage.getItem(CASE_STORAGE_KEY)).toBe('{broken')
    view.unmount()
    localStorage.clear()
    render(<CaseLesson />)
    const remote = JSON.stringify(changeRoleRecord(emptySession(), 'product', { draft: 'Remote' }))
    localStorage.setItem(CASE_STORAGE_KEY, remote)
    fireEvent.change(screen.getByLabelText('지금 내 판단'), { target: { value: 'Local' } })
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    expect(localStorage.getItem(CASE_STORAGE_KEY)).toBe(remote)
    expect((screen.getByLabelText('지금 내 판단') as HTMLTextAreaElement).value).toBe('Local')
  })
  it('hides earlier answers on return and records actual recall time before comparison', async () => {
    const user = userEvent.setup()
    const at = '2026-10-28T09:00:00.000Z'
    const previous = changeRoleRecord(emptySession(), 'developer', {
      stage: 3, draft: 'Hidden first', first: { text: 'Hidden first', assistance: 'unspecified', exampleViewed: false, at },
      revision: 'Hidden revision', transfer: 'Hidden transfer', applied: { text: 'Hidden transfer', assistance: 'reported-none', at },
      reviewAt: '2026-10-31T09:00:00.000Z',
    })
    localStorage.setItem(CASE_STORAGE_KEY, JSON.stringify(previous))
    const view = render(<CaseLesson />)
    expect(screen.queryByText('Hidden first')).toBeNull()
    expect(screen.queryByText('Hidden transfer')).toBeNull()
    fireEvent.change(screen.getByLabelText('지금 다시 설명한 내용'), { target: { value: 'Recall before comparison' } })
    await user.click(screen.getByRole('button', { name: '재설명 남기고 이전 답과 비교하기' }))
    expect(screen.getByText('Hidden first')).toBeTruthy()
    expect(screen.getByText('Hidden transfer')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '이 브라우저에 저장' }))
    const recalled = JSON.parse(localStorage.getItem(CASE_STORAGE_KEY)!).records.developer.recalled
    expect(recalled.text).toBe('Recall before comparison')
    expect(Date.parse(recalled.at)).toBeGreaterThan(Date.parse(at))
    view.unmount()
    render(<CaseLesson />)
    expect(screen.getByText('Recall before comparison')).toBeTruthy()
  })
})
