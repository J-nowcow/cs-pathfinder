// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const auth = vi.hoisted(() => ({
  user: { id: 'alice', email: 'alice@example.invalid' } as {
    id: string
    email: string
  } | null,
}))
vi.mock('@/lib/auth/client', () => ({
  authClient: {
    useSession: () => ({
      data: auth.user ? { user: auth.user } : null,
      isPending: false,
    }),
  },
}))
import {
  LibraryAccountPanel,
  LibraryAccountProvider,
} from '@/components/library/LibraryAccount'
import { StudyPractice } from '@/components/library/StudyPractice'
import { emptyLibrary, LIBRARY_KEY } from '@/lib/library/storage'
import { editLibrary } from '@/lib/library/local-edit'
import { libraryAccountKey } from '@/lib/library/account-client'
const id = 'topic:normalization'
const props = {
  id,
  title: 'Normal forms',
  href: '/learn/engineer/normalization',
  track: 'engineer' as const,
  checklist: ['Dependencies'],
}
const meta = { title: props.title, href: props.href, track: props.track }
let server = emptyLibrary(),
  revision = 0
let requests: string[] = []
function content(enabled = true) {
  return (
    <LibraryAccountProvider enabled={enabled}>
      <LibraryAccountPanel />
      <StudyPractice {...props} />
    </LibraryAccountProvider>
  )
}
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  server = emptyLibrary()
  revision = 0
  requests = []
  auth.user = { id: 'alice', email: 'alice@example.invalid' }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method)
        return Response.json({
          ownerId: auth.user!.id,
          revision,
          state: server,
        })
      requests.push(init.body as string)
      const input = JSON.parse(init.body as string)
      if (input.baseRevision !== revision)
        return Response.json(
          {
            ownerId: auth.user!.id,
            kind: 'conflict',
            snapshot: { revision, state: server },
          },
          { status: 409 },
        )
      revision++
      server = input.state
      return Response.json({
        ownerId: auth.user!.id,
        kind: 'ok',
        snapshot: { revision, state: server },
        acknowledgedRevision: revision,
        replayed: false,
      })
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('account library UI', () => {
  it('keeps production rollout hidden and local study usable when disabled', () => {
    render(content(false))
    expect(screen.queryByText('기술사·Jira 과제 계정 저장')).toBeNull()
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('opens the account without guest upload, explicitly saves, and returns to the unchanged guest answer', async () => {
    editLibrary(
      localStorage,
      id,
      meta,
      { kind: 'draft', text: 'Guest answer', expected: '' },
      '2026-10-28T00:00:00Z',
    )
    const guest = localStorage.getItem(LIBRARY_KEY)
    render(content())
    const user = userEvent.setup()
    await user.click(screen.getByText('기술사·Jira 과제 계정 저장'))
    await user.click(
      screen.getByRole('button', { name: '이 계정의 기록 열기' }),
    )
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        '',
      ),
    )
    expect(requests).toHaveLength(0)
    await user.type(screen.getByRole('textbox'), 'Account answer')
    expect(requests).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '계정에 저장하기' }))
    await screen.findByText('이 계정의 서버 기록과 같음을 확인했어요.')
    expect(server.entries[id].draft).toBe('Account answer')
    await user.click(screen.getByRole('button', { name: '손님 기록 보기' }))
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Guest answer',
      ),
    )
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(guest)
  })
  it('keeps failed input scoped across an account change and exposes none of it in another owner', async () => {
    const view = render(content()),
      user = userEvent.setup()
    await user.click(screen.getByText('기술사·Jira 과제 계정 저장'))
    await user.click(
      screen.getByRole('button', { name: '이 계정의 기록 열기' }),
    )
    await screen.findByRole('button', { name: '계정에 저장하기' })
    const set = localStorage.setItem.bind(localStorage)
    const spy = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation((key, value) => {
        if (key === libraryAccountKey('alice')) throw Error('quota')
        set(key, value)
      })
    await user.type(screen.getByRole('textbox'), 'Alice unsaved private')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'Alice unsaved private',
    )
    auth.user = { id: 'bob', email: 'bob@example.invalid' }
    view.rerender(content())
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        '',
      ),
    )
    expect(screen.queryByText('Alice unsaved private')).toBeNull()
    expect(requests).toHaveLength(0)
    spy.mockRestore()
    auth.user = { id: 'alice', email: 'alice@example.invalid' }
    view.rerender(content())
    await user.click(
      screen.getByRole('button', { name: '이 계정의 기록 열기' }),
    )
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Alice unsaved private',
      ),
    )
    expect(screen.getByRole('alert').textContent).toContain(
      '아직 저장되지 않은 답안',
    )
  })
  it('shows both drafts and the comparison base before an explicit conflict choice', async () => {
    editLibrary(
      localStorage,
      id,
      meta,
      { kind: 'draft', text: 'Base', expected: '' },
      '2026-10-28T00:00:00Z',
    )
    server = JSON.parse(localStorage.getItem(LIBRARY_KEY)!)
    render(content())
    const user = userEvent.setup()
    await user.click(screen.getByText('기술사·Jira 과제 계정 저장'))
    await user.click(
      screen.getByRole('button', { name: '이 계정의 기록 열기' }),
    )
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Base',
      ),
    )
    await waitFor(() =>
      expect(
        (screen.getByRole('textbox') as HTMLTextAreaElement).disabled,
      ).toBe(false),
    )
    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'My draft')
    server.entries[id].draft = 'Remote draft'
    revision++
    await user.click(screen.getByRole('button', { name: '계정에 저장하기' }))
    await screen.findByRole('region', { name: '계정 답안 충돌 비교' })
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
      'My draft',
    )
    expect(screen.getByText('Remote draft', { exact: true })).toBeTruthy()
    await user.click(screen.getByText('비교 기준 기록 보기'))
    expect(screen.getByText('Base', { exact: true })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '계정 항목 사용' }))
    await waitFor(() =>
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(
        'Remote draft',
      ),
    )
    expect(
      screen.queryByRole('region', { name: '계정 답안 충돌 비교' }),
    ).toBeNull()
  })
})
