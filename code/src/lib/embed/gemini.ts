import { loadApiKeys } from '@/lib/llm/keys'
import { EMBED_MODEL, EMBED_DIM } from '@/lib/embed/model'

/**
 * 질문 문장을 Gemini로 임베딩한다.
 *
 * 밤 스윕(`/api/embed-sweep`)·응답 뒤 백필(`after()`)·일회성 스크립트
 * (`scripts/embed.ts`)가 전부 이 함수를 지난다. 경로마다 따로 부르면
 * taskType이나 정규화가 갈라져 **같은 모델인데 다른 공간**이 된다.
 *
 * `taskType: 'SEMANTIC_SIMILARITY'`를 고정한다. Gemini는 taskType마다
 * 벡터를 다르게 내놓는다 — 검색용(RETRIEVAL_*)은 질의와 문서를 비대칭으로
 * 만드는데, 우리는 질문끼리 대칭으로 견주므로 유사도용이 맞다.
 * **이 값을 바꾸는 것도 모델을 바꾸는 것이다.** 전량 재임베딩감이다.
 */

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`

/** batchEmbedContents가 한 번에 받는 최대 개수 (API 제한 100의 절반로 여유) */
const MAX_PER_CALL = 50

type BatchResponse = { embeddings?: Array<{ values?: number[] }> }

/**
 * L2 정규화.
 *
 * 3072가 아닌 차원은 정규화 안 된 채로 온다(공식 문서). 코사인 거리(`<=>`)는
 * 안에서 정규화하므로 안 해도 순위는 같지만, 내적을 쓰는 코드가 나중에
 * 생겼을 때 조용히 틀리는 것을 막으려면 여기서 맞춰 두는 것이 싸다.
 */
function normalize(v: number[]): number[] {
  let n = 0
  for (const x of v) n += x * x
  const d = Math.sqrt(n)
  if (d === 0) return v
  return v.map((x) => x / d)
}

async function callOnce(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: EMBED_DIM,
      })),
    }),
  })
  if (!res.ok) {
    throw new Error(`gemini embed ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  const json = (await res.json()) as BatchResponse
  const out = json.embeddings?.map((e) => e.values ?? [])
  if (!out || out.length !== texts.length) {
    throw new Error(`임베딩 개수가 안 맞는다: ${out?.length} vs ${texts.length}`)
  }
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(
        `차원이 ${v.length}인데 상수는 ${EMBED_DIM}이다. ` +
          `모델이나 outputDimensionality를 바꿨으면 src/lib/embed/model.ts도 고쳐야 한다`,
      )
    }
  }
  return out.map(normalize)
}

/**
 * 문장 목록을 임베딩한다. 순서가 보존된다.
 *
 * 키는 `loadApiKeys()` 순서로 시도한다. 폐기된 키로 서비스가 죽지 않게
 * 하려는 것이지 한도 우회가 아니다 — 무료 한도는 프로젝트에 붙고
 * Google 약관이 한도 우회를 금지한다(`keys.ts` 주석).
 */
export async function embedQuestions(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const keys = loadApiKeys()
  if (keys.length === 0) {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set')
  }

  const out: number[][] = []
  for (let i = 0; i < texts.length; i += MAX_PER_CALL) {
    const chunk = texts.slice(i, i + MAX_PER_CALL)

    let lastError: unknown
    let done: number[][] | null = null
    for (const key of keys) {
      try {
        done = await callOnce(key, chunk)
        break
      } catch (e) {
        lastError = e
      }
    }
    if (!done) throw lastError

    out.push(...done)
  }
  return out
}
