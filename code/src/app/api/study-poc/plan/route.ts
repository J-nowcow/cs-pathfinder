import { isLocalPlanRequest, planRequestSchema, planStudyActivity } from '@/lib/study-poc/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff',
  } })
}

export async function POST(request: Request): Promise<Response> {
  if (!isLocalPlanRequest(request)) return json({ error: 'local_poc_only' }, 403)
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ error: 'invalid_content_type' }, 415)
  }
  const reader = request.body?.getReader()
  if (!reader) return json({ error: 'invalid_input' }, 400)
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > 4096) { await reader.cancel(); return json({ error: 'request_too_large' }, 413) }
      chunks.push(next.value)
    }
  } catch { return json({ error: 'invalid_input' }, 400) }
  finally { reader.releaseLock() }
  let raw: unknown
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) }
  catch { return json({ error: 'invalid_input' }, 400) }
  const parsed = planRequestSchema.safeParse(raw)
  if (!parsed.success) return json({ error: 'invalid_input' }, 400)
  return json(await planStudyActivity(parsed.data, request.signal))
}
