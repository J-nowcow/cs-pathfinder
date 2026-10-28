import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db/bootstrap', () => ({ ensureSeeded: vi.fn(async () => {}) }))
vi.mock('@/lib/expand/cache', async (original) => ({
  ...(await original<typeof import('@/lib/expand/cache')>()),
  loadNode: vi.fn(async () => null),
}))
vi.mock('@/components/ReadingView', () => ({ ReadingView: () => null }))
vi.mock('@/lib/quota', () => ({
  getQuota: vi.fn(async () => ({ used: 0, reserved: 0 })),
}))
import ReadPage, { generateMetadata } from '@/app/(site)/q/[nodeId]/page'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadNode, isNodeKey } from '@/lib/expand/cache'
import { getQuota } from '@/lib/quota'
afterEach(() => vi.clearAllMocks())
describe('public node validation happens before database seeding', () => {
  it.each([
    'not-a-node',
    '0',
    '01',
    '1e10',
    '9999999999',
    '../etc',
    '',
    '00000000-0000-0000-0000-00000000000x',
  ])(
    'invalid key %s skips seeding in metadata and page rendering',
    async (nodeId) => {
      expect(isNodeKey(nodeId)).toBe(false)
      const params = Promise.resolve({ nodeId })
      expect(await generateMetadata({ params })).toHaveProperty('title')
      await expect(ReadPage({ params })).rejects.toThrow()
      expect(ensureSeeded).not.toHaveBeenCalled()
      expect(getQuota).not.toHaveBeenCalled()
    },
  )
  it.each([
    '1',
    '999999999',
    '12345678-1234-1234-1234-123456789abc',
    'ABCDEFAB-1234-1234-1234-123456789ABC',
  ])('valid key %s retains seeding and normal lookup', async (nodeId) => {
    expect(isNodeKey(nodeId)).toBe(true)
    await generateMetadata({ params: Promise.resolve({ nodeId }) })
    expect(ensureSeeded).toHaveBeenCalledOnce()
    expect(loadNode).toHaveBeenCalledWith(nodeId)
  })
})
