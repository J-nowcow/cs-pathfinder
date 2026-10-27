// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
const context = vi.hoisted(() => ({
  scope: {
    id: 'guest',
    ready: true,
    generation: 0,
    storage: undefined as Pick<Storage, 'getItem' | 'setItem'> | undefined,
  },
}))
vi.mock('@/components/library/LibraryAccount', () => ({
  useLibraryScope: () => context.scope,
  LibraryAccountPanel: () => null,
}))
import { LibraryProgress } from '@/components/library/LibraryProgress'
import { LIBRARY_KEY, LIBRARY_EVENT, emptyLibrary } from '@/lib/library/storage'
import type { LibraryState } from '@/lib/library/storage'
function state(id: string): LibraryState {
  return {
    version: 1,
    entries: {
      ['topic:' + id]: {
        title: id,
        href: '/learn/engineer/' + id,
        track: 'engineer',
        draft: id,
        checks: [],
        status: 'learning',
        visitedAt: '2026-10-27T00:00:00Z',
        updatedAt: '2026-10-27T00:00:00Z',
      },
    },
  }
}
function deferredFile() {
  let resolve!: (value: string) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<string>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { file: { size: 100, text: () => promise } as File, resolve, reject }
}
const payload = (id: string) =>
  JSON.stringify({ format: 'pathfinder.library.backup', ...state(id) })
function choose(container: HTMLElement, file: File) {
  const input = [
    ...container.querySelectorAll<HTMLInputElement>('input[type=file]'),
  ].at(-1)!
  fireEvent.change(input, { target: { files: [file] } })
}
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(emptyLibrary()))
  context.scope = {
    id: 'guest',
    ready: true,
    generation: 0,
    storage: undefined,
  }
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe('backup imports stay bound to their current selection and scope', () => {
  it('does not mutate the old guest or new account after a scope switch', async () => {
    const { container, rerender } = render(<LibraryProgress />)
    const file = deferredFile()
    const before = localStorage.getItem(LIBRARY_KEY)
    choose(container, file.file)
    const account = {
      getItem: () => JSON.stringify(emptyLibrary()),
      setItem: vi.fn(),
    }
    context.scope = {
      id: 'account:alice',
      ready: true,
      generation: 0,
      storage: account,
    }
    rerender(<LibraryProgress />)
    await act(async () => file.resolve(payload('late-guest')))
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
    expect(account.setItem).not.toHaveBeenCalled()
  })
  it('cancels an old import through loading even if the same guest scope returns', async () => {
    const { container, rerender } = render(<LibraryProgress />)
    const file = deferredFile(),
      before = localStorage.getItem(LIBRARY_KEY)
    choose(container, file.file)
    context.scope = { ...context.scope, id: 'loading', ready: false }
    rerender(<LibraryProgress />)
    context.scope = { ...context.scope, id: 'guest', ready: true }
    rerender(<LibraryProgress />)
    await act(async () => file.resolve(payload('late-guest')))
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
  })
  it('only applies the latest file when reads finish out of order', async () => {
    const { container } = render(<LibraryProgress />)
    const first = deferredFile(),
      second = deferredFile()
    choose(container, first.file)
    choose(container, second.file)
    await act(async () => second.resolve(payload('chosen-latest')))
    await act(async () => first.resolve(payload('stale-first')))
    expect(
      Object.keys(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).entries),
    ).toEqual(['topic:chosen-latest'])
  })
  it('does not write or dispatch an update after unmount', async () => {
    const { container, unmount } = render(<LibraryProgress />)
    const file = deferredFile(),
      before = localStorage.getItem(LIBRARY_KEY)
    const updates = vi.fn()
    window.addEventListener(LIBRARY_EVENT, updates)
    choose(container, file.file)
    unmount()
    await act(async () => file.resolve(payload('late-unmount')))
    window.removeEventListener(LIBRARY_EVENT, updates)
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(before)
    expect(updates).not.toHaveBeenCalled()
  })
  it('ignores a stale read failure instead of replacing the newest result', async () => {
    const { container } = render(<LibraryProgress />)
    const first = deferredFile(),
      second = deferredFile()
    choose(container, first.file)
    choose(container, second.file)
    await act(async () => second.resolve(payload('chosen-latest')))
    const latest = [...container.querySelectorAll('[role=status]')].at(
      -1,
    )!.textContent
    await act(async () => first.reject(Error('synthetic read failure')))
    expect(
      [...container.querySelectorAll('[role=status]')].at(-1)!.textContent,
    ).toBe(latest)
  })
  it('still merges the current account backup locally without touching guest data', async () => {
    let account = JSON.stringify(emptyLibrary())
    const store = {
      getItem: (key: string) =>
        key === LIBRARY_KEY ? account : localStorage.getItem(key),
      setItem: (_key: string, value: string) => {
        account = value
      },
    }
    context.scope = {
      id: 'account:alice',
      ready: true,
      generation: 0,
      storage: store,
    }
    const guest = localStorage.getItem(LIBRARY_KEY),
      file = deferredFile()
    const { container } = render(<LibraryProgress />)
    choose(container, file.file)
    await act(async () => file.resolve(payload('current-account')))
    expect(Object.keys(JSON.parse(account).entries)).toEqual([
      'topic:current-account',
    ])
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(guest)
  })
})
