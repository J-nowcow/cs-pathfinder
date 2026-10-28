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
