// @vitest-environment happy-dom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapModal } from '@/components/MapModal'
import type { Layout } from '@/lib/journey/graph'

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Background: () => null,
  Controls: () => <button type="button">지도 확대</button>,
  Position: { Right: 'right', Left: 'left' },
  useReactFlow: () => ({
    getNodesBounds: () => ({ width: 0, height: 0 }),
    getNodes: () => [],
    getNode: () => null,
    setCenter: vi.fn(),
  }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const layout: Layout = {
  nodes: [],
  edges: [],
  bounds: { width: 0, height: 0 },
  hiddenCount: 0,
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>질문 지도 열기</button>
      {open && <MapModal layout={layout} onJump={vi.fn()} onClose={() => setOpen(false)} />}
    </>
  )
}

describe('MapModal', () => {
  it('열면 닫기 버튼에 초점을 두고 Esc로 닫은 뒤 열기 버튼으로 돌아간다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: '질문 지도 열기' })

    await user.click(trigger)
    const close = screen.getByRole('button', { name: '닫기' })
    await waitFor(() => expect(document.activeElement).toBe(close))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('마지막 조작 요소에서 Tab을 눌러도 대화상자 안에 머문다', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: '질문 지도 열기' }))

    const last = screen.getByRole('button', { name: '지도 확대' })
    last.focus()
    await user.keyboard('{Tab}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '닫기' }))
  })
})
