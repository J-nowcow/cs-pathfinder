import { z } from 'zod'
import { realCaller, MODEL_GENERATE, type StructuredCaller } from '@/lib/llm/client'

const generateSchema = z.object({
  body: z.string(),
  suggestions: z.array(z.object({ text: z.string() })),
})

const SYSTEM = `당신은 CS 면접 학습 콘텐츠를 쓰는 저자다.

해설(body) 규칙:
- 3~5문단. 마크다운 문단만 쓰고 제목·표·HTML은 쓰지 않는다.
- 결론을 먼저 말하고 근거를 뒤에 붙인다.
- 짧고 간결한 문장을 쓴다. 쉼표로 길게 늘여 쓰지 않는다.
- 면접에서 한 단계 더 들어오는 지점을 짚어준다.
- 이 노드는 여러 경로에서 도달할 수 있다. 특정 부모 질문에만 통하는 서술을 피하고
  문장만 봐도 뜻이 통하게 쓴다.

꼬리질문(suggestions) 규칙:
- 정확히 5개.
- 각각 이 질문에서 한 단계 더 깊이 들어가는 독립된 질문이어야 한다.
- 서로 겹치지 않게 다른 방향으로 뻗는다.
- 물음표로 끝나는 한 문장.
- 부모 질문을 그대로 되풀이하지 않는다.`

export async function generateNodeContent(args: {
  question: string
  identityScope: string
  parentQuestion: string | null
  call?: StructuredCaller
}): Promise<{ body: string; suggestions: string[] }> {
  const call = args.call ?? realCaller

  const prompt = [
    `질문: ${args.question}`,
    `의미 범위: ${args.identityScope}`,
    args.parentQuestion ? `상위 맥락: ${args.parentQuestion}` : '상위 맥락: (없음)',
  ].join('\n')

  const out = await call({
    model: MODEL_GENERATE,
    schema: generateSchema,
    system: SYSTEM,
    prompt,
  })

  const body = out.body.trim()
  if (body.length === 0) {
    throw new Error('generation returned an empty body')
  }

  const suggestions = out.suggestions
    .map((s) => s.text.trim())
    .filter((s) => s.length > 0)
    .slice(0, 5)

  return { body, suggestions }
}
