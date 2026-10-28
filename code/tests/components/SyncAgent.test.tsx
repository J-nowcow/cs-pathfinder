// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { SyncAgent } from '@/components/SyncAgent'

const state = vi.hoisted(() => ({ owner: null as string | null, start: vi.fn() }))
vi.mock('@/lib/auth/client', () => ({ authClient: { useSession: () => ({ data: state.owner ? { user: { id: state.owner } } : null }) } }))
vi.mock('@/lib/journey/sync', () => ({ startSyncForUser: state.start }))
const cancel = () => vi.fn()
beforeEach(() => { state.owner = null; state.start.mockReset() })
afterEach(cleanup)

it('starts no guest request and cancels the old run before switching owners and logging out', () => {
  const a = cancel(), b = cancel()
  state.start.mockReturnValueOnce({ done: Promise.resolve(true), cancel: a }).mockReturnValueOnce({ done: Promise.resolve(true), cancel: b })
  const view = render(<SyncAgent />)
  expect(state.start).not.toHaveBeenCalled()
  state.owner = 'A'; view.rerender(<SyncAgent />)
  expect(state.start).toHaveBeenLastCalledWith('A')
  state.owner = 'B'; view.rerender(<SyncAgent />)
  expect(a).toHaveBeenCalledOnce()
  expect(a.mock.invocationCallOrder[0]).toBeLessThan(state.start.mock.invocationCallOrder[1])
  state.owner = null; view.rerender(<SyncAgent />)
  expect(b).toHaveBeenCalledOnce()
  expect(state.start).toHaveBeenCalledTimes(2)
})

it('disposes on strict-mode effect replay and again on unmount', () => {
  const disposers: ReturnType<typeof cancel>[] = []
  state.owner = 'A'
  state.start.mockImplementation(() => { const dispose = cancel(); disposers.push(dispose); return { done: Promise.resolve(true), cancel: dispose } })
  const view = render(<StrictMode><SyncAgent /></StrictMode>)
  expect(disposers).toHaveLength(2)
  expect(disposers[0]).toHaveBeenCalledOnce()
  expect(disposers[1]).not.toHaveBeenCalled()
  view.unmount()
  expect(disposers[1]).toHaveBeenCalledOnce()
})
