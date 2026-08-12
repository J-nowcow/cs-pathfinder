import { z } from 'zod'
import { readUserId } from '@/lib/auth/session'
import { realCaller, type StructuredCaller } from '@/lib/llm/client'
import { resolveCaller } from '@/lib/llm/resolve'
import {
  generateResumeQuestions,
  MAX_RESUME_LENGTH,
  prepareResumeText,
} from '@/lib/personalize/resume'
import { commitQuota, getQuota, releaseQuota, reserveQuota } from '@/lib/quota'
import { resumeDailyLimit } from '@/lib/quota/key'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({ text: z.string().max(MAX_RESUME_LENGTH + 1) })

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const userId = await readUserId(request.headers)
  if (!userId) return json({ error: 'unauthorized' }, 401)

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const prepared = prepareResumeText(body.text)
  if (!prepared.ok) {
    return json({ error: 'invalid_input', code: prepared.code, detail: prepared.detail }, 400)
  }

  const quotaKey = `resume:${userId}`
  const limit = resumeDailyLimit()
  if (!(await reserveQuota(quotaKey, limit))) {
    return json({ error: 'quota_exceeded', quota: { used: limit, limit } }, 429)
  }

  const call: StructuredCaller = resolveCaller() ?? realCaller
  try {
    const result = await generateResumeQuestions({ resumeText: prepared.value, call })
    if (result.kind !== 'ok') {
      await releaseQuota(quotaKey)
      return json({ error: 'invalid_output' }, 502)
    }

    await commitQuota(quotaKey)
    const used = (await getQuota(quotaKey)).used
    return json({ questions: result.questions, quota: { used, limit } }, 200)
  } catch {
    await releaseQuota(quotaKey)
    return json({ error: 'generation_failed' }, 502)
  }
}
