// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PmpBackup } from '@/components/pmp/PmpBackup'
import { PMP_KEY } from '@/lib/pmp/storage'
const raw = (notes: Record<string, string>) =>
  JSON.stringify({ version: 1, notes })
const file = (text: string, name = 'synthetic.json') => ({
  name,
  size: new Blob([text]).size,
  text: async () => text,
})
const upload = (value: ReturnType<typeof file>) =>
  fireEvent.change(screen.getByLabelText('PMP 백업 파일 비교'), {
    target: { files: [value] },
  })
beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
afterEach(cleanup)
describe('native PMP backup decisions', () => {
  it('requires comparison choices, rechecks changes and preserves other tracks', async () => {
    const before = raw({ n01: 'Current explanation' })
    localStorage.setItem(PMP_KEY, before)
    localStorage.setItem('pathfinder.library.v1', 'keep-other')
    render(<PmpBackup />)
    await userEvent.click(screen.getByText('PMP 기록 백업'))
    upload(file(raw({ n01: 'Backup explanation', n02: 'New note' })))
    const button = await screen.findByRole('button', {
      name: '선택한 내용으로 가져오기',
    })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(localStorage.getItem(PMP_KEY)).toBe(before)
    await userEvent.click(
      screen.getByRole('radio', { name: /백업 파일의 기록 사용/ }),
    )
    localStorage.setItem(
      PMP_KEY,
      raw({ n01: 'Edited after preview', n03: 'Other tab' }),
    )
    await userEvent.click(button)
    await screen.findByRole('button', { name: '최신 기록과 다시 비교' })
    expect(JSON.parse(localStorage.getItem(PMP_KEY)!).notes.n01).toBe(
      'Edited after preview',
    )
    await userEvent.click(
      screen.getByRole('button', { name: '최신 기록과 다시 비교' }),
    )
    expect(screen.getByText('Edited after preview')).toBeTruthy()
    await userEvent.click(
      screen.getByRole('radio', { name: /현재 브라우저 기록 유지/ }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: '선택한 내용으로 가져오기' }),
    )
    expect(JSON.parse(localStorage.getItem(PMP_KEY)!).notes).toEqual({
      n01: 'Edited after preview',
      n02: 'New note',
      n03: 'Other tab',
    })
    expect(localStorage.getItem('pathfinder.library.v1')).toBe('keep-other')
  })
  it('keeps the comparison and current raw data after quota failure; cancel does not import', async () => {
    const before = raw({ n01: 'Original' })
    localStorage.setItem(PMP_KEY, before)
    render(<PmpBackup />)
    await userEvent.click(screen.getByText('PMP 기록 백업'))
    upload(file(raw({ n02: 'Backup' })))
    await screen.findByRole('button', { name: '선택한 내용으로 가져오기' })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('synthetic quota', 'QuotaExceededError')
    })
    await userEvent.click(
      screen.getByRole('button', { name: '선택한 내용으로 가져오기' }),
    )
    expect(screen.getByRole('status').textContent).toContain(
      '가져오기를 완료하지 않았으니',
    )
    expect(localStorage.getItem(PMP_KEY)).toBe(before)
    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(localStorage.getItem(PMP_KEY)).toBe(before)
    expect(screen.queryByRole('region', { name: 'PMP 백업 비교' })).toBeNull()
  })
  it('can download malformed stored bytes as a rescue copy without silently resetting them', async () => {
    const before = '{broken-private-synthetic'
    localStorage.setItem(PMP_KEY, before)
    let captured: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      captured = blob as Blob
      return 'blob:synthetic'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<PmpBackup />)
    await userEvent.click(screen.getByText('PMP 기록 백업'))
    await userEvent.click(
      screen.getByRole('button', { name: 'PMP 기록 원본 저장' }),
    )
    expect(await captured!.text()).toBe(before)
    expect(localStorage.getItem(PMP_KEY)).toBe(before)
    upload(file(raw({ n01: 'New' })))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(
        '현재 기록은 바꾸지 않았어요',
      ),
    )
    expect(localStorage.getItem(PMP_KEY)).toBe(before)
  })
})
