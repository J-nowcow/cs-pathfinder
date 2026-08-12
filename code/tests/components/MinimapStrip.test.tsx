// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MinimapStrip } from '@/components/MinimapStrip'
import type { Layout } from '@/lib/journey/graph'

afterEach(cleanup)

const layout: Layout = {
  nodes: [
    {
      occurrenceId: 'o1',
      nodeId: 'n1',
      label: '트랜잭션은 무엇인가요?',
      category: '데이터베이스',
      depth: 0,
      x: 0,
      y: 0,
      onPath: true,
      isCurrent: true,
    },
  ],
  edges: [],
  bounds: { width: 0, height: 0 },
  hiddenCount: 0,
}

describe('MinimapStrip', () => {
  it('지도 노드는 키보드로 현재 위치를 옮길 수 있다', async () => {
    const user = userEvent.setup()
    const onJump = vi.fn()
    render(
      <MinimapStrip layout={layout} justAddedId={null} onJump={onJump} onOpenMap={vi.fn()} />,
    )

    const node = screen.getByRole('button', { name: '트랜잭션은 무엇인가요?로 이동' })
    expect(node.getAttribute('aria-current')).toBe('location')

    node.focus()
    await user.keyboard('{Enter}')
    expect(onJump).toHaveBeenCalledWith('o1')
  })
})
