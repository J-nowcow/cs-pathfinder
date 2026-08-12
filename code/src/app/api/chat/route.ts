import { z } from 'zod'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadNode } from '@/lib/expand/cache'
import {
  buildChatCall,
  chatAnswerIssues,
  CHAT_ANSWER_SCHEMA,
  MAX_HISTORY_TURNS,
  MAX_TURN_CHARS,
} from '@/lib/chat/ask'
import { realCaller, type StructuredCaller } from '@/lib/llm/client'
import { resolveCaller } from '@/lib/llm/resolve'
import { reserveQuota, commitQuota, releaseQuota, getQuota } from '@/lib/quota'
import { quotaKeyFromHeaders, chatDailyLimit } from '@/lib/quota/key'

/**
 * 노드 스코프 챗. 무엇을 왜 하는지는 `lib/chat/ask.ts`에 있다.
 *
 * 대화를 저장하지 않는다 — 이력은 요청 body로 왔다가 응답과 함께
 * 사라진다. 서버가 무상태라 표도 마이그레이션도 없다.
 */
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  node_id: z.string().uuid(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(MAX_TURN_CHARS),
      }),
    )
    .max(MAX_HISTORY_TURNS)
    .default([]),
  text: z.string().min(1).max(300),
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  await ensureSeeded()

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(await request.json())
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const node = await loadNode(parsed.node_id)
  if (!node) return json({ error: 'not_found' }, 404)

  /* 확장과 다른 몫 — 접두사로 가른다. 화면이 보여줄 남은 횟수도 이 키로 센다 */
  const quotaKey = `chat:${quotaKeyFromHeaders(request.headers)}`
  const limit = chatDailyLimit()
  if (!(await reserveQuota(quotaKey, limit))) {
    return json({ error: 'quota_exceeded', quota: { used: limit, limit } }, 429)
  }

  const call: StructuredCaller = resolveCaller() ?? realCaller
  try {
    const args = buildChatCall(
      { question: node.question, body: node.body },
      parsed.history,
      parsed.text,
    )
    const first = await call({ ...args, schema: CHAT_ANSWER_SCHEMA })
    let answer = first.answer.trim()
    const issues = chatAnswerIssues(answer)
    if (issues.length > 0) {
      try {
        const revised = await call({
          ...args,
          schema: CHAT_ANSWER_SCHEMA,
          prompt: `${args.prompt}\n\n[고칠 답]\n${answer}\n\n대본형 표현과 재요약을 빼고 기술 내용은 보존해 다시 답합니다.`,
        })
        if (chatAnswerIssues(revised.answer).length < issues.length) answer = revised.answer.trim()
      } catch {
        // 보조 재작성 실패로 원래 답까지 버리지는 않는다.
      }
    }
    await commitQuota(quotaKey)
    const used = (await getQuota(quotaKey)).used
    return json({ answer, quota: { used, limit } }, 200)
  } catch {
    /* 모델이 답을 못 만든 것은 사용자 몫이 아니다 — 예약을 돌려준다 */
    await releaseQuota(quotaKey)
    return json({ error: 'generation_failed' }, 502)
  }
}
