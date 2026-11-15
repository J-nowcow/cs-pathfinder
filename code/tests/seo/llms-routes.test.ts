import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureSeeded: vi.fn(),
  loadCatalog: vi.fn(),
}))
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: mocks.ensureSeeded }))
vi.mock('@/lib/db/catalog', () => ({ loadCatalog: mocks.loadCatalog }))
vi.mock('@/lib/site', () => ({ siteUrl: () => new URL('https://example.com') }))
import { GET as index } from '@/app/llms.txt/route'
import { GET as full } from '@/app/llms-full.txt/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.ensureSeeded.mockResolvedValue(undefined)
  mocks.loadCatalog.mockResolvedValue({ date: '2026-11-09', entries: [], byCategory: [] })
})

describe('public machine-readable source routes', () => {
  it.each([
    ['index', index, { canonicalOnly: true }],
    ['full', full, { canonicalOnly: true, withBody: true }],
  ] as const)('%s remains readable and cacheable while HTML remains the search destination', async (_name, get, options) => {
    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, follow')
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=3600')
    expect(mocks.ensureSeeded).toHaveBeenCalledTimes(1)
    expect(mocks.loadCatalog).toHaveBeenCalledExactlyOnceWith(undefined, options)
    expect(mocks.ensureSeeded.mock.invocationCallOrder[0]).toBeLessThan(mocks.loadCatalog.mock.invocationCallOrder[0])
    expect(await response.text()).toContain('https://example.com/learn/cases/github-migration-2026')
  })

  it('does not serve a success document when the public catalog fails', async () => {
    mocks.loadCatalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    await expect(index()).rejects.toThrow('catalog unavailable')
  })
})
