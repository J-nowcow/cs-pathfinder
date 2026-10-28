/** Shared public snapshots for one React server request, never a persistent data cache. */
import { cache } from 'react'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { isNodeKey, loadNode } from '@/lib/expand/cache'
import { loadTreeBySlug } from '@/lib/db/trees'
import { isValidSlug } from '@/lib/tree/slug'

export const loadPublicNodeForRender = cache(async (key: string) => {
  if (!isNodeKey(key)) return null
  await ensureSeeded()
  return loadNode(key)
})

export const loadPublicTreeForRender = cache(async (slug: string) => {
  if (!isValidSlug(slug)) return null
  await ensureSeeded()
  return loadTreeBySlug(slug)
})
