// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GraphMap } from '@/components/GraphMap'
import type { MapData } from '@/lib/db/graph'
import { STREAK_STORAGE_KEY } from '@/lib/streak/storage'
import { todayKst } from '@/lib/streak/client'

// Camera drawing is not the subject of this integration check. Parent mode
// switching, actual reading sheet and actual local-record join remain real.
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: ReactNode }) => <div className="react-flow">{children}</div>,
  Background: () => null,
  Controls: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useReactFlow: () => ({ setCenter: vi.fn(), getZoom: () => 1 }),
  useStore: (select: (state: { transform: [number, number, number] }) => unknown) => select({ transform: [0, 0, 1] }),
}))

const DATA: MapData = {
  nodes: [
    { id: 'tcp', question: 'TCP의 연결 보장은 무엇인가요?', category: '네트워크' },
    { id: 'handshake', question: 'Handshake는 연결 상태를 어떻게 정하나요?', category: '네트워크' },
  ],
  edges: [{ parentId: 'tcp', childId: 'handshake', kind: 'related', relationKind: 'prerequisite', relationDirection: 'forward', reason: '연결 보장에서 초기 상태 협의로 이어집니다' }],
}

beforeEach(() => {
  window.history.replaceState(null, '', '/map')
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{"body":"이 질문의 공개 해설입니다."}', { status: 200 })))
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('공용 지도에서 읽은 질문을 개인 연결 정리로 이어가기', () => {
  it('서버 마크업에 자바스크립트 없이 읽을 공개 질문 목록을 제공한다', () => {
    const html = renderToString(<GraphMap data={DATA} />)
    expect(html).toMatch(/<noscript>[\s\S]*href="\/questions"[\s\S]*공개 질문 목록에서 읽기[\s\S]*<\/noscript>/)
  })

  it('개인 보기 주소를 열고 보기 변경 및 브라우저 기록 복원을 반영한다', async () => {
    const user = userEvent.setup()
    window.history.replaceState({ existing: true }, '', '/map?view=connections&source=bookmark#saved')
    render(<GraphMap data={DATA} />)
    await screen.findByRole('heading', { name: '읽은 질문을 연결해서 돌아보기' })
    expect(screen.getByRole('button', { name: '읽은 지식 정리' }).getAttribute('aria-pressed')).toBe('true')

    await user.click(screen.getByRole('button', { name: '전체 지도' }))
    expect(window.location.search).toBe('?source=bookmark')
    expect(window.location.hash).toBe('#saved')
    expect(window.history.state).toEqual({ existing: true })

    window.history.replaceState({ existing: true }, '', '/map?view=connections&source=bookmark#saved')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('heading', { name: '읽은 질문을 연결해서 돌아보기' })
    await user.click(screen.getByRole('button', { name: '읽은 지식 정리' }))
    expect(window.location.search).toContain('view=connections')
  })

  it('정상 읽기를 누적하고 두 번째 질문을 읽으면 기존 질문 사이의 관계로 이동한다', async () => {
    const user = userEvent.setup()
    render(<GraphMap data={DATA} />)
    expect(screen.getByRole('button', { name: '전체 지도' }).getAttribute('aria-pressed')).toBe('true')

    await user.click(screen.getByRole('link', { name: DATA.nodes[0].question }))
    await screen.findByText('이 질문의 공개 해설입니다.')
    await user.click(screen.getByRole('button', { name: '닫기' }))
    await user.click(screen.getByRole('button', { name: '읽은 지식 정리' }))
    expect(screen.getByRole('button', { name: '읽은 지식 정리' }).getAttribute('aria-pressed')).toBe('true')
    await screen.findByRole('heading', { name: '읽은 질문을 연결해서 돌아보기' })

    const next = screen.getByRole('region', { name: '기록한 질문과 연결된 질문' })
    const unreadOpener = within(next).getByRole('button', { name: DATA.nodes[1].question })
    await user.click(unreadOpener)
    await screen.findByRole('dialog', { name: DATA.nodes[1].question })
    await screen.findByText('이 질문의 공개 해설입니다.')
    await waitFor(() => expect(unreadOpener.isConnected).toBe(false))
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '읽은 지식 정리' }))

    const existing = screen.getByRole('region', { name: '이미 본 질문 사이의 관계' })
    expect(within(existing).getByRole('button', { name: DATA.nodes[0].question })).toBeTruthy()
    expect(within(existing).getByRole('button', { name: DATA.nodes[1].question })).toBeTruthy()
    expect(within(existing).getByText('바탕 질문 → 이어지는 질문')).toBeTruthy()
    expect(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY)!).days[todayKst()]).toEqual(['tcp', 'handshake'])

    await user.click(screen.getByRole('button', { name: '전체 지도' }))
    expect(screen.getByRole('link', { name: DATA.nodes[0].question })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
