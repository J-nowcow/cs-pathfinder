// @vitest-environment happy-dom
import source from '../../learning-content/certificate/course.json'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CertificatePractice } from '@/components/certificate/CertificatePractice'
import { CERTIFICATE_KEY } from '@/lib/certificate/storage'
const lesson = source.lessons.find(n => n.id === 'keys')!
beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('renders the exact selected recall answer and checklist while keeping stored edits after remount', () => {
  const view = render(<CertificatePractice id={lesson.id} recallAnswer={lesson.recallAnswer} />)
  expect(screen.getByText(lesson.recallAnswer, { exact: true })).toBeTruthy()
  expect(screen.getByText(lesson.recall, { exact: true })).toBeTruthy()
  const check = view.container.querySelector<HTMLInputElement>('input[type=checkbox]')!
  fireEvent.click(check)
  fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Synthetic explanation' } })
  const saved = JSON.parse(localStorage.getItem(CERTIFICATE_KEY)!)
  expect(saved.entries.keys.checks).toEqual([lesson.checklist[0]])
  view.unmount()
  const again = render(<CertificatePractice id={lesson.id} recallAnswer={lesson.recallAnswer} />)
  expect(again.container.querySelector('textarea')!.value).toBe('Synthetic explanation')
  expect(again.container.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(true)
})

it('preserves the stored draft and current screen input when quota prevents saving', () => {
  const view = render(<CertificatePractice id={lesson.id} recallAnswer={lesson.recallAnswer} />)
  const before = localStorage.getItem(CERTIFICATE_KEY)
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Synthetic quota failure') })
  fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Unsaved visible explanation' } })
  expect(localStorage.getItem(CERTIFICATE_KEY)).toBe(before)
  expect(view.container.querySelector('textarea')!.value).toBe('Unsaved visible explanation')
  expect(screen.getByRole('status').textContent).toContain('Synthetic quota failure')
})

it('keeps an unsaved memo warning through independent checklist/review saves and supports explicit retry', () => {
  const view = render(<CertificatePractice id={lesson.id} recallAnswer={lesson.recallAnswer} />)
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Synthetic quota failure') })
  fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Pending explanation' } })
  write.mockRestore()
  fireEvent.click(view.container.querySelector('input[type=checkbox]')!)
  fireEvent.click(screen.getByRole('button', { name: '내일 다시 설명하기' }))
  expect(JSON.parse(localStorage.getItem(CERTIFICATE_KEY)!).entries.keys.draft).toBe('')
  expect(screen.getByText(/메모가 아직 저장되지 않았어요/)).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('복습 예약을 이 브라우저에 저장했어요.')
  fireEvent.click(screen.getByRole('button', { name: '메모 저장 다시 시도' }))
  const saved = JSON.parse(localStorage.getItem(CERTIFICATE_KEY)!).entries.keys
  expect(document.activeElement).toBe(view.container.querySelector('textarea'))
  expect(saved.draft).toBe('Pending explanation')
  expect(saved.checks).toEqual([lesson.checklist[0]])
  expect(saved.due).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  expect(screen.queryByRole('button', { name: '메모 저장 다시 시도' })).toBeNull()
})

it('keeps explicit retry conflict-safe when another tab has saved a different memo', () => {
  const view = render(<CertificatePractice id={lesson.id} recallAnswer={lesson.recallAnswer} />)
  const stored = JSON.parse(localStorage.getItem(CERTIFICATE_KEY)!)
  stored.entries.keys.draft = 'Other tab original'
  localStorage.setItem(CERTIFICATE_KEY, JSON.stringify(stored))
  fireEvent.change(view.container.querySelector('textarea')!, { target: { value: 'Current screen pending' } })
  fireEvent.click(screen.getByRole('button', { name: '메모 저장 다시 시도' }))
  expect(JSON.parse(localStorage.getItem(CERTIFICATE_KEY)!).entries.keys.draft).toBe('Other tab original')
  expect(view.container.querySelector('textarea')!.value).toBe('Current screen pending')
  expect(screen.getByRole('status').textContent).toContain('다른 탭에서 같은 메모가 바뀌었어요.')
  expect(screen.getByRole('button', { name: '메모 저장 다시 시도' })).toBeTruthy()
})
