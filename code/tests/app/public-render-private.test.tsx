import React, { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  ip: '192.0.2.1',
  voter: '11111111-1111-1111-1111-111111111111',
}))
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'x-forwarded-for': state.ip })),
  cookies: vi.fn(async () => ({ get: () => ({ value: state.voter }) })),
}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/server/public-render-reads', () => ({
  loadPublicNodeForRender: vi.fn(async () => ({
    id: 'fixture',
    number: 1,
    question: 'Public question',
    body: 'Public body',
    tags: [],
    level: null,
    identityScope: 'network',
    primaryCategory: 'network',
    suggestions: [],
  })),
  loadPublicTreeForRender: vi.fn(async () => ({
    id: 'tree',
    slug: 'abcdefghjkmn',
    title: 'Public tree',
    category: 'network',
    summary: 'Public summary',
    nodes: [],
    rootNodeId: 'fixture',
    views: 3,
    upvotes: 2,
  })),
}))
vi.mock('@/lib/expand/nodes', () => ({
  relatedForDisplay: vi.fn(async () => []),
}))
vi.mock('@/lib/quota', () => ({
  getQuota: vi.fn(async (key: string) => ({
    used: key.endsWith('.1') ? 1 : 4,
  })),
}))
vi.mock('@/lib/db/votes', () => ({
  hasVoted: vi.fn(async (_slug: string, key: string) =>
    key.includes('11111111'),
  ),
}))
vi.mock('@/lib/db/trees', () => ({ bumpTreeViews: vi.fn() }))
vi.mock('@/components/ReadingView', () => ({ ReadingView: () => null }))
vi.mock('@/components/SharedTree', () => ({ SharedTree: () => null }))
vi.mock('@/components/VoteButton', () => ({ VoteButton: () => null }))

import ReadPage, {
  generateMetadata as nodeMetadata,
} from '@/app/(site)/q/[nodeId]/page'
import TreePage, {
  generateMetadata as treeMetadata,
} from '@/app/(site)/t/[slug]/page'
import { ReadingView } from '@/components/ReadingView'
import { VoteButton } from '@/components/VoteButton'
import { getQuota } from '@/lib/quota'
import { hasVoted } from '@/lib/db/votes'
import { bumpTreeViews } from '@/lib/db/trees'
import { relatedForDisplay } from '@/lib/expand/nodes'
import { after } from 'next/server'

function find(
  node: ReactNode,
  type: unknown,
): Record<string, unknown> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.type === type) return child.props
    const result = find(child.props.children, type)
    if (result) return result
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.ip = '192.0.2.1'
  state.voter = '11111111-1111-1111-1111-111111111111'
})

describe('private page state stays outside public snapshots', () => {
  it('reads anonymous quota from each request and still loads related questions for the body', async () => {
    const params = Promise.resolve({ nodeId: '1' })
    await nodeMetadata({ params })
    expect(getQuota).not.toHaveBeenCalled()
    expect(relatedForDisplay).not.toHaveBeenCalled()
    const first = find(await ReadPage({ params }), ReadingView)
    state.ip = '192.0.2.2'
    const second = find(await ReadPage({ params }), ReadingView)
    expect(first?.initialQuota).toMatchObject({ used: 1 })
    expect(second?.initialQuota).toMatchObject({ used: 4 })
    expect(getQuota).toHaveBeenNthCalledWith(1, 'anon:192.0.2.1')
    expect(getQuota).toHaveBeenNthCalledWith(2, 'anon:192.0.2.2')
    expect(relatedForDisplay).toHaveBeenCalledTimes(2)
  })

  it('reads each voter cookie separately and schedules one view increment per page render', async () => {
    const params = Promise.resolve({ slug: 'abcdefghjkmn' })
    await treeMetadata({ params })
    expect(hasVoted).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
    const first = find(await TreePage({ params }), VoteButton)
    state.voter = '22222222-2222-2222-2222-222222222222'
    const second = find(await TreePage({ params }), VoteButton)
    expect(first?.initialVoted).toBe(true)
    expect(second?.initialVoted).toBe(false)
    expect(hasVoted).toHaveBeenNthCalledWith(
      1,
      'abcdefghjkmn',
      'anon:11111111-1111-1111-1111-111111111111',
    )
    expect(hasVoted).toHaveBeenNthCalledWith(
      2,
      'abcdefghjkmn',
      'anon:22222222-2222-2222-2222-222222222222',
    )
    expect(after).toHaveBeenCalledTimes(2)
    for (const [callback] of vi.mocked(after).mock.calls)
      if (typeof callback === 'function') await callback()
    expect(bumpTreeViews).toHaveBeenCalledTimes(2)
  })
})
