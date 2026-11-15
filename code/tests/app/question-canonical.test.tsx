import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = 'c69036ba-5f3d-4dc6-9626-590a8b9715d6'
const fixture = vi.hoisted(() => ({ node: {
  id: 'c69036ba-5f3d-4dc6-9626-590a8b9715d6', number: 60,
  question: 'Public fixture question', body: 'Public fixture answer',
  tags: [], level: null, identityScope: 'generic', primaryCategory: 'network', suggestions: [],
} as Record<string, unknown> | null }))
vi.mock('@/lib/server/public-render-reads', () => ({
  loadPublicNodeForRender: vi.fn(async () => fixture.node),
}))
vi.mock('@/lib/expand/nodes', () => ({ relatedForDisplay: vi.fn(async () => []) }))
vi.mock('@/lib/quota', () => ({ getQuota: vi.fn(async () => ({ used: 0 })) }))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('@/components/ReadingView', () => ({ ReadingView: () => null }))

import ReadPage, { generateMetadata } from '@/app/(site)/q/[nodeId]/page'
import { loadPublicNodeForRender } from '@/lib/server/public-render-reads'
import { relatedForDisplay } from '@/lib/expand/nodes'
import { getQuota } from '@/lib/quota'
import { siteUrl } from '@/lib/site'

beforeEach(() => { vi.clearAllMocks() })

describe('question URL consolidation', () => {
  it.each(['60', ID.toUpperCase()])('permanently redirects alias %s before private state and related reads', async nodeId => {
    await expect(ReadPage({ params: Promise.resolve({ nodeId }) })).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;/q/${ID};308;`,
    })
    expect(loadPublicNodeForRender).toHaveBeenCalledExactlyOnceWith(nodeId)
    expect(relatedForDisplay).not.toHaveBeenCalled()
    expect(getQuota).not.toHaveBeenCalled()
  })

  it('renders the immutable URL without redirect and retains normal request-specific reads', async () => {
    await expect(ReadPage({ params: Promise.resolve({ nodeId: ID }) })).resolves.toBeTruthy()
    expect(relatedForDisplay).toHaveBeenCalledExactlyOnceWith(ID)
    expect(getQuota).toHaveBeenCalledOnce()
  })

  it('announces the same canonical and OG URL for the numeric alias and immutable URL', async () => {
    for (const nodeId of ['60', ID]) {
      const metadata = await generateMetadata({ params: Promise.resolve({ nodeId }) })
      const url = new URL('/q/' + ID, siteUrl()).href
      expect(metadata.alternates?.canonical).toBe(url)
      expect(metadata.openGraph).toMatchObject({ url })
    }
  })

  it('keeps missing aliases as 404 rather than redirecting to an invented target', async () => {
    const saved = fixture.node
    fixture.node = null
    try {
      await expect(ReadPage({ params: Promise.resolve({ nodeId: '999999999' }) })).rejects.toMatchObject({
        digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
      })
      expect(getQuota).not.toHaveBeenCalled()
    } finally { fixture.node = saved }
  })
})
