import { loadEnvLocal } from '../src/lib/load-env'
import { EMBED_MODEL, EMBED_DIM } from '../src/lib/embed/model'
import { embedQuestions } from '../src/lib/embed/gemini'

/**
 * 질문 문장을 임베딩해 `qnode.embedding`에 담는다.
 *
 * 상시 경로는 이것이 아니다 — 신규 노드는 응답 뒤 백필(`after()`)이,
 * 놓친 것은 매일 GitHub Actions가 `/api/embed-sweep`으로 줍는다.
 * 이 스크립트는 **전량 재작업**용이다: 모델·차원·taskType을 바꿔 벡터
 * 공간이 통째로 갈릴 때, 그리고 문턱을 정하려고 분포를 볼 때.
 *
 * **NULL인 것만 처리한다**(기본). 중간에 끊겨도 다시 돌리면 이어서 간다.
 *
 * 실행:
 *   npm run embed              -- NULL인 것만
 *   npm run embed -- --all     -- 전부 다시 (모델을 바꿨을 때)
 *   npm run embed -- --probe   -- 담지 않고 분포와 가까운 쌍만 보여준다
 */
loadEnvLocal()

type Row = { id: string; number: number | null; question: string }

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const all = process.argv.includes('--all')
  const probe = process.argv.includes('--probe')

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })

  const where = all || probe ? '' : 'and embedding is null'
  const r = await pool.query<Row>(
    `select id, number, normalized_question as question
       from qnode
      where status = 'ready' ${where}
      order by number asc nulls last`,
  )
  const rows = r.rows

  if (rows.length === 0) {
    console.log('할 것이 없다. 전부 담겨 있다.')
    await pool.end()
    return
  }

  console.log(`${rows.length}편 · 모델 ${EMBED_MODEL} · ${EMBED_DIM}차원`)

  /* 진행이 보이게 작게 자른다. embedQuestions 안에서 또 API 상한으로 자른다 */
  const SIZE = 50
  const vectors = new Map<string, number[]>()
  let done = 0

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  /*
   * 분당 한도를 존중한다.
   *
   * batchEmbedContents는 **안에 든 항목이 각각 요청으로 센다.** 50개짜리
   * 두 덩이를 몇 초 안에 보냈더니 429가 왔다(실측 2026-08-09). 그래서
   * 덩이 사이를 띄우고, 429가 오면 기다렸다 같은 덩이를 다시 던진다.
   * 배치 전용 처방이다 — 런타임(백필·스윕)은 실패를 세고 다음 스윕이
   * 줍는 것이 이미 재시도라 기다리지 않는다.
   */
  async function embedWithBackoff(texts: string[]): Promise<number[][]> {
    let lastError: unknown
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await embedQuestions(texts)
      } catch (e) {
        lastError = e
        if (!/429|RESOURCE_EXHAUSTED/i.test(String(e))) throw e
        process.stdout.write(`\r  429 — 45초 대기 (${attempt + 1}/4)      `)
        await sleep(45_000)
      }
    }
    throw lastError
  }

  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE)
    if (i > 0) await sleep(20_000)
    const vecs = await embedWithBackoff(chunk.map((c) => c.question))

    for (const [j, node] of chunk.entries()) vectors.set(node.id, vecs[j])

    if (!probe) {
      for (const [j, node] of chunk.entries()) {
        await pool.query(`update qnode set embedding = $2::real[] where id = $1`, [
          node.id,
          vecs[j],
        ])
      }
    }

    done += chunk.length
    process.stdout.write(`\r  ${done}/${rows.length}`)
  }
  process.stdout.write('\n')

  /*
   * 담고 끝내지 않는다.
   *
   * 숫자가 들어갔다는 것과 그 숫자가 쓸 만하다는 것은 다르다. 이 모델이
   * 한국어 CS 용어에서 뭘 가깝다고 보는지 **눈으로 봐야** 문턱을 정할 수 있다.
   */
  const ids = [...vectors.keys()]
  const byId = new Map(rows.map((x) => [x.id, x]))
  const pairs: Array<{ a: Row; b: Row; sim: number }> = []
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push({
        a: byId.get(ids[i])!,
        b: byId.get(ids[j])!,
        sim: cosine(vectors.get(ids[i])!, vectors.get(ids[j])!),
      })
    }
  }
  pairs.sort((x, y) => y.sim - x.sim)

  const sims = pairs.map((p) => p.sim).sort((a, b) => a - b)
  const q = (p: number) => sims[Math.min(sims.length - 1, Math.floor(sims.length * p))]

  console.log(`\n--- 쌍 유사도 분포 (${pairs.length}쌍) ---`)
  console.log(`중앙값  ${q(0.5).toFixed(3)}`)
  console.log(`90분위  ${q(0.9).toFixed(3)}`)
  console.log(`99분위  ${q(0.99).toFixed(3)}`)
  console.log(`최대    ${sims[sims.length - 1].toFixed(3)}`)

  console.log('\n--- 가장 가까운 20쌍 (눈으로 볼 것) ---')
  for (const p of pairs.slice(0, 20)) {
    console.log(`  ${p.sim.toFixed(3)}  #${p.a.number} ${p.a.question}`)
    console.log(`         #${p.b.number} ${p.b.question}`)
  }

  if (probe) console.log('\n--probe라 담지 않았다.')
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
