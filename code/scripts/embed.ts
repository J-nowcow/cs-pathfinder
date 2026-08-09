import { loadEnvLocal } from '../src/lib/load-env'
import { EMBED_MODEL, EMBED_DIM } from '../src/lib/embed/model'

/**
 * 질문 문장을 임베딩해 `qnode.embedding`에 담는다.
 *
 * **밤에 도는 배치다.** 런타임은 이 값을 읽기만 하고 모델을 부르지 않는다
 * (`src/lib/embed/model.ts`가 왜 그런지 적어 뒀다).
 *
 * 로컬 ollama를 쓴다. 무료 한도가 없고 글자가 밖으로 안 나가서
 * `/privacy`의 위탁 처리자를 안 늘려도 된다.
 *
 * **NULL인 것만 처리한다.** 중간에 끊겨도 다시 돌리면 이어서 간다. 앞
 * 사이클에 관계 만들기가 한도 소진으로 멈춘 적이 있어서, 멈추는 것을
 * 전제로 만든다.
 *
 * 실행:
 *   npm run embed              -- NULL인 것만
 *   npm run embed -- --all     -- 전부 다시
 *   npm run embed -- --probe   -- 담지 않고 가까운 쌍만 보여준다
 */
loadEnvLocal()

const OLLAMA = process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'

type Row = { id: string; number: number | null; question: string }

/**
 * ollama에 한 덩이씩 보낸다.
 *
 * 한 번에 다 보내면 응답이 커지고, 하나가 터지면 그 묶음을 통째로 잃는다.
 * 로컬이라 왕복 비용이 싸므로 작게 자른다.
 */
async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  })
  if (!res.ok) {
    throw new Error(`ollama ${res.status}: ${await res.text()}`)
  }
  const json = (await res.json()) as { embeddings?: number[][] }
  const out = json.embeddings
  if (!out || out.length !== texts.length) {
    throw new Error(`임베딩 개수가 안 맞는다: ${out?.length} vs ${texts.length}`)
  }
  /*
   * 차원을 여기서 본다.
   *
   * 모델을 바꿔 놓고 상수를 안 고치면 SQL 캐스팅이 터지는데, 그때는 이미
   * 절반이 담긴 뒤다. 담기 전에 잡는다.
   */
  for (const v of out) {
    if (v.length !== EMBED_DIM) {
      throw new Error(
        `차원이 ${v.length}인데 상수는 ${EMBED_DIM}이다. ` +
          `모델(${EMBED_MODEL})을 바꿨으면 src/lib/embed/model.ts도 고쳐야 한다`,
      )
    }
  }
  return out
}

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

  const SIZE = 16
  const vectors = new Map<string, number[]>()
  let done = 0

  for (let i = 0; i < rows.length; i += SIZE) {
    const chunk = rows.slice(i, i + SIZE)
    const vecs = await embedBatch(chunk.map((c) => c.question))

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
   * 숫자가 들어갔다는 것과 그 숫자가 쓸 만하다는 것은 다르다. 한국어 CS
   * 용어에서 이 모델이 뭘 가깝다고 보는지 **눈으로 봐야** 문턱을 정할 수 있다.
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
