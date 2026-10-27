import { readUserId } from '@/lib/auth/session'
import { loadLibraryForUser, writeLibraryForUser } from '@/lib/db/library-study'
import {
  libraryWriteSchema,
  MAX_LIBRARY_BYTES,
} from '@/lib/library/account-schema'

export const dynamic = 'force-dynamic'
function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      vary: 'Cookie',
      'x-content-type-options': 'nosniff',
    },
  })
}
function enabled() {
  return process.env.LIBRARY_ACCOUNT_SYNC_ENABLED === '1'
}
export async function GET(request: Request): Promise<Response> {
  if (!enabled()) return json({ error: 'sync_unavailable' }, 503)
  try {
    const userId = await readUserId(request.headers)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    return json({ ownerId: userId, ...(await loadLibraryForUser(userId)) })
  } catch {
    return json({ error: 'sync_unavailable' }, 503)
  }
}
export async function PUT(request: Request): Promise<Response> {
  if (!enabled()) return json({ error: 'sync_unavailable' }, 503)
  if (
    request.headers.get('origin') !== new URL(request.url).origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return json({ error: 'invalid_origin' }, 403)
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    return json({ error: 'invalid_content_type' }, 415)
  try {
    const userId = await readUserId(request.headers)
    if (!userId) return json({ error: 'unauthorized' }, 401)
    // The header is only a precondition, never the database owner selector.
    if (request.headers.get('x-library-owner') !== userId)
      return json({ error: 'account_changed' }, 409)
    if (Number(request.headers.get('content-length')) > MAX_LIBRARY_BYTES)
      return json({ error: 'request_too_large' }, 413)
    const reader = request.body?.getReader()
    if (!reader) return json({ error: 'invalid_input' }, 400)
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        bytes += next.value.byteLength
        if (bytes > MAX_LIBRARY_BYTES) {
          await reader.cancel()
          return json({ error: 'request_too_large' }, 413)
        }
        chunks.push(next.value)
      }
    } finally {
      reader.releaseLock()
    }
    let raw: unknown
    try {
      raw = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
      )
    } catch {
      return json({ error: 'invalid_input' }, 400)
    }
    const parsed = libraryWriteSchema.safeParse(raw)
    if (!parsed.success) return json({ error: 'invalid_input' }, 400)
    const result = await writeLibraryForUser(userId, parsed.data)
    return json(
      { ownerId: userId, ...result },
      result.kind === 'ok' ? 200 : 409,
    )
  } catch {
    return json({ error: 'sync_unavailable' }, 503)
  }
}
