// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Board } from '@/components/Board'
import type { BoardTree } from '@/lib/db/trees'

const tree: BoardTree = {
  id: 'tree-1',
  slug: 'first-map',
  title: '첫 질문 지도',
  kind: 'shared',
  category: '데이터베이스',
  summary: '인덱스에서 트랜잭션까지 이어진다.',
  upvotes: 0,
  views: 0,
  publishedAt: '2026-08-12T00:00:00.000Z',
  nodeCount: 3,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Board · 다음 페이지', () => {
  it('첫 목록 실패를 즉시 알리고 다시 시도할 수 있다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    render(<Board initial={{ trees: [], nextCursor: null }} />)

    await userEvent.click(screen.getByRole('button', { name: '최신' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('더 보기 실패 뒤에도 이미 읽던 질문 지도를 남긴다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    render(<Board initial={{ trees: [tree], nextCursor: 'next-page' }} />)

    await userEvent.click(screen.getByRole('button', { name: '더 보기' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByRole('heading', { name: '첫 질문 지도' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull()
  })
})
