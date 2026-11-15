import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadMapData } from '@/lib/db/graph'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@/lib/db/client', () => ({ getDb: async () => ({ query }) }))

const visible = [
  { id: 'a', question: 'A', category: 'Network' },
  { id: 'b', question: 'B', category: 'Network' },
]

afterEach(() => {
  query.mockReset()
  vi.restoreAllMocks()
})

describe('map relation availability boundary', () => {
  it('retains public nodes and actual traversal when the optional relation table is absent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    query
      .mockResolvedValueOnce(visible)
      .mockResolvedValueOnce([{ parentId: 'a', childId: 'b', kind: 'walked' }])
      .mockRejectedValueOnce(Object.assign(new Error('missing optional relation table'), { code: '42P01' }))

    expect(await loadMapData('2026-11-11')).toEqual({
      nodes: visible,
      edges: [{ parentId: 'a', childId: 'b', kind: 'walked' }],
    })
    expect(query).toHaveBeenCalledTimes(3)
  })

  it('does not disguise a permission or connection failure as a map with no relations', async () => {
    const error = Object.assign(new Error('access denied'), { code: '42501' })
    query.mockResolvedValueOnce(visible).mockResolvedValueOnce([]).mockRejectedValueOnce(error)
    await expect(loadMapData('2026-11-11')).rejects.toBe(error)
  })

  it('does not issue edge queries when no public nodes can be displayed', async () => {
    query.mockResolvedValueOnce([])
    expect(await loadMapData('2026-11-11')).toEqual({ nodes: [], edges: [] })
    expect(query).toHaveBeenCalledTimes(1)
  })
})
