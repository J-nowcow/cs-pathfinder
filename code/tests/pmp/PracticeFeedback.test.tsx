// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PmpPractice } from '@/components/pmp/PmpPractice'
import { PMP_KEY } from '@/lib/pmp/storage'

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
it('only shows a success check after durable local storage, preserving reload and legacy keys', () => {
  const view = render(<PmpPractice id="n01" visit />)
  const note = screen.getByLabelText('내 메모')
  fireEvent.change(note, { target: { value: 'Synthetic note' } })
  expect(screen.getByRole('status').getAttribute('data-state')).toBe('saved')
  expect(screen.getByRole('status').querySelector('svg')).not.toBeNull()
  const saved = JSON.parse(localStorage.getItem(PMP_KEY)!)
  expect(saved.notes.n01).toBe('Synthetic note')
  view.unmount()
  render(<PmpPractice id="n01" visit />)
  expect((screen.getByLabelText('내 메모') as HTMLTextAreaElement).value).toBe(
    'Synthetic note',
  )
  expect(screen.getByRole('status').querySelector('svg')).toBeNull()
})
it('removes the success check on quota failure and retains the current input and previous stored note', () => {
  render(<PmpPractice id="n01" visit />)
  fireEvent.change(screen.getByLabelText('내 메모'), {
    target: { value: 'Stored' },
  })
  const previous = localStorage.getItem(PMP_KEY)
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Synthetic quota')
  })
  fireEvent.change(screen.getByLabelText('내 메모'), {
    target: { value: 'Still visible' },
  })
  expect(screen.getByRole('status').getAttribute('data-state')).toBe('error')
  expect(screen.getByRole('status').querySelector('svg')).toBeNull()
  expect(screen.getByRole('status').textContent).toContain('저장되지 않았어요')
  expect((screen.getByLabelText('내 메모') as HTMLTextAreaElement).value).toBe(
    'Still visible',
  )
  expect(localStorage.getItem(PMP_KEY)).toBe(previous)
})
