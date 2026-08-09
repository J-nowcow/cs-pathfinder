import { loadEnvLocal } from '../src/lib/load-env'

// import보다 먼저 돌아야 한다. 키를 읽는 모듈이 아래에 있다
loadEnvLocal()

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { EXAMPLE_NODES } from '../data/example-nodes'
import { GENERATED_NODES } from '../data/generated-nodes'
import { AUTHORED_NODES } from '../data/authored-nodes'
import { ON_DEMAND_NODES } from '../data/on-demand-nodes'
import { shortlist } from '../src/lib/relations/shortlist'
import { judgeRelations, type JudgeNode } from '../src/lib/relations/judge'
import { nextPace } from '../src/lib/relations/pace'
import type { RelationKind } from '../src/lib/db/relations'
import { MODEL_GEMMA } from '../src/lib/llm/client'

/**
 * 질문 사이의 의미 관계를 만든다.
 *
 * 결과를 `data/relations.ts`에 적는다. 화면이 쓰는 DB는 배포마다 새로 만들어지는
 * PGlite라 여기서 만든 것을 DB에 바로 넣어봐야 사라진다. 질문 자체도 같은 이유로
 * 데이터 파일에 있다.
 *
 * 판정은 회차마다 흔들린다. 그래서 판정기가 안에서 세 번 뽑아 다수결을 낸다.
 * 여기서는 그 결과만 받는다.
 *
 * 실행:
 *   npx tsx scripts/build-relations.ts               # 이어서 하기
 *   npx tsx scripts/build-relations.ts --from 100    # 100번째 질문부터
 *   npx tsx scripts/build-relations.ts --limit 20    # 20개만
 */

const OUT = 'data/relations.ts'
const CACHE_DIR = '/tmp'
const cachePath = (n: number) => `${CACHE_DIR}/cs-relations-${n}.json`

type Row = {
  fromScope: string
  fromQuestion: string
  toScope: string
  toQuestion: string
  kind: RelationKind
  reason: string
  votes: number
}

const arg = (name: string): number | null => {
  const i = process.argv.indexOf(name)
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : null
}

/*
 * **네 벌을 다 넣는다.**
 *
 * 예전에는 앞의 둘만 읽었다. 그래서 손으로 쓴 것과 사용자가 물어봐 생긴 것은
 * 관계가 하나도 안 붙었다. 지도에서 312개 중 217개만 이어져 있었고, 빠진
 * 95개의 상당수가 그 둘이었다.
 *
 * 이어지지 않은 질문은 지도에서 외딴 점으로 뜨고 "꼬리를 물고" 넘어갈 길도
 * 없다. 이 서비스에서 그건 없는 것과 비슷하다.
 */
const ALL = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]

/*
 * 판정에는 질문과 카테고리만 필요하다. id는 여기서만 쓰는 임시 번호다 —
 * 진짜 노드 id는 시드할 때 (범위, 질문)에서 파생된다. 판정 프롬프트에 uuid를
 * 넣으면 36자짜리가 후보 수만큼 붙어 프롬프트가 두 배가 된다.
 */
const nodes: JudgeNode[] = ALL.map((n, i) => ({
  id: `q${i}`,
  question: n.question,
  category: n.category,
}))
const byId = new Map(nodes.map((n, i) => [n.id, ALL[i]]))

/**
 * 임베딩을 실어 준다.
 *
 * 없어도 돈다 -- `shortlist`가 낱말 방식으로 떨어진다. 그래서 DB가 없거나
 * 아직 안 담겼으면 경고만 하고 넘어간다. **이 스크립트가 임베딩을 만들지는
 * 않는다.** 그건 `npm run embed`가 밤에 하는 일이다.
 *
 * 질문 문장으로 맞춘다. 여기 `id`는 `q0` 같은 임시 번호라 DB의 uuid와
 * 이어지지 않는다.
 */
async function attachEmbeddings(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.warn('DATABASE_URL이 없다. 낱말로 후보를 추린다')
    return
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  try {
    const r = await pool.query<{ q: string; embedding: number[] | null }>(
      `select normalized_question as q, embedding
         from qnode
        where status = 'ready' and embedding is not null`,
    )
    const byQuestion = new Map(r.rows.map((x) => [x.q.trim(), x.embedding]))

    let hit = 0
    for (const n of nodes) {
      const v = byQuestion.get(n.question.trim())
      if (v) {
        n.embedding = v
        hit += 1
      }
    }
    console.log(`임베딩 ${hit}/${nodes.length} 실림`)
    if (hit === 0) {
      console.warn('하나도 못 실었다. 낱말로 후보를 추린다 — npm run embed')
    }
  } finally {
    await pool.end()
  }
}

/*
 * 조각으로 나눠 동시에 돌린다.
 *
 * 249개를 한 프로세스로 돌면 여덟 시간이다. `--shard 0/4`처럼 주면 자기 몫만
 * 본다. 나머지 연산으로 나누므로 조각마다 카테고리가 골고루 섞인다 — 앞뒤로
 * 자르면 한 조각이 데이터베이스만 보게 되고, 그 조각만 후보가 많아 느려진다.
 */
const [shard, shards] = process.argv.includes('--shard')
  ? process.argv[process.argv.indexOf('--shard') + 1].split('/').map(Number)
  : [0, 1]

/*
 * 하다 만 것을 이어서 한다. 249개면 회차 3번씩 747번 호출이라 한 번에 끝나지
 * 않는다. 무료 한도가 마르면 건당 2분까지 간다.
 *
 * 조각마다 자기 파일에 쓴다. 한 파일을 나눠 쓰면 늦게 쓴 조각이 앞선 조각을 덮는다.
 * 이 조각이 이미 한 것만 건너뛰면 되므로 남의 파일은 안 읽는다.
 */
const CACHE = cachePath(shard)
const done: Row[] = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : []

/** 조각을 다 모은다. 마지막에 데이터 파일로 쓸 것 */
function mergeAll(): Row[] {
  const all: Row[] = []

  /*
   * **이미 만들어 둔 것을 먼저 넣는다.**
   *
   * 조각 캐시는 `/tmp`에 있다. 기계를 껐거나 임시 폴더가 비워졌으면 그 조각의
   * 결과가 사라지는데, 그 상태로 합치면 **데이터 파일을 그만큼 덜어 낸 채로
   * 덮어쓴다.** 몇 시간 걸려 만든 것이 조용히 없어진다.
   *
   * 그래서 지금 파일에 있는 것을 후보에 함께 넣는다. 아래 다수결이 같은 쌍을
   * 하나로 줄이므로 겹쳐도 문제가 없다. 합치기는 늘어나기만 한다.
   */
  try {
    if (existsSync(OUT)) {
      const text = readFileSync(OUT, 'utf8')
      const start = text.indexOf('[')
      const end = text.lastIndexOf(']')
      if (start > 0 && end > start) {
        /* 데이터 파일은 TS라 그대로 못 읽는다. 줄 단위로 필요한 값만 뽑는다 */
        for (const line of text.slice(start, end).split('\n')) {
          const m =
            /fromScope: "((?:[^"\\]|\\.)*)", fromQuestion: "((?:[^"\\]|\\.)*)", toScope: "((?:[^"\\]|\\.)*)", toQuestion: "((?:[^"\\]|\\.)*)", kind: "([a-z_]+)", reason: "((?:[^"\\]|\\.)*)", votes: (\d+)/.exec(
              line,
            )
          if (!m) continue
          all.push({
            fromScope: JSON.parse(`"${m[1]}"`),
            fromQuestion: JSON.parse(`"${m[2]}"`),
            toScope: JSON.parse(`"${m[3]}"`),
            toQuestion: JSON.parse(`"${m[4]}"`),
            kind: m[5] as RelationKind,
            reason: JSON.parse(`"${m[6]}"`),
            votes: Number(m[7]),
          })
        }
      }
    }
  } catch {
    console.log('  (기존 관계를 못 읽었다 — 캐시만으로 합친다)')
  }
  const carried = all.length
  if (carried > 0) console.log(`  기존 관계 ${carried}개를 이어받는다`)

  for (let i = 0; i < 16; i += 1) {
    const p = cachePath(i)
    if (!existsSync(p)) continue
    try {
      all.push(...(JSON.parse(readFileSync(p, 'utf8')) as Row[]))
    } catch {
      // 아직 쓰는 중이면 반쪽 JSON이다. 그 조각만 건너뛴다
      console.log(`  (${p} 읽는 중 — 건너뜀)`)
    }
  }

  /*
   * 같은 쌍이 두 번 나오면 표를 많이 받은 쪽만 남긴다.
   *
   * 조각 경계를 바꿔 다시 돌리면 생긴다 — 예전 조각이 이미 한 질문을 새 조각이
   * 다시 맡는다. 저장 쪽에서도 걸러내지만 데이터 파일에 두 줄로 남을 이유가 없다.
   */
  const best = new Map<string, Row>()
  for (const r of all) {
    const key = `${r.fromScope}::${r.fromQuestion}::${r.toScope}::${r.toQuestion}::${r.kind}`
    const cur = best.get(key)
    if (!cur || r.votes > cur.votes) best.set(key, r)
  }
  return [...best.values()]
}

/*
 * 이미 판정한 질문은 **어느 조각에서 했든** 건너뛴다.
 *
 * 자기 파일만 보면 조각 수를 바꿀 때마다 남이 한 것을 다시 한다. 4조각으로
 * 돌리다 2조각으로 줄이면 절반이 재판정 대상이 된다. 판정은 세 번 호출이라
 * 그 낭비가 그대로 한도로 나간다.
 *
 * 관계가 하나도 안 나온 질문은 여기서 안 잡힌다. 흔적을 안 남기기 때문이다.
 * 그건 감수한다 — 안 나온 질문을 따로 기록하면 "아직 안 함"과 "해봤는데 없음"을
 * 가르는 파일이 하나 더 생기고, 다시 물어 봐야 대개 또 빈손이라 손해가 작다.
 */
const judged = new Set(mergeAll().map((r) => `${r.fromScope}::${r.fromQuestion}`))

const from = arg('--from') ?? 0
const limit = arg('--limit') ?? nodes.length
const targets = nodes.slice(from, from + limit).filter((_, i) => (i + from) % shards === shard)

await attachEmbeddings()

console.log(`질문 ${nodes.length}개 · 이번에 볼 것 ${targets.length}개 · 이미 한 것 ${judged.size}개`)

let asked = 0
let failures = 0
for (const focus of targets) {
  const src = byId.get(focus.id)!
  if (judged.has(`${src.identityScope}::${src.question}`)) continue

  const cands = shortlist(focus, nodes)
  if (cands.length === 0) {
    judged.add(`${src.identityScope}::${src.question}`)
    continue
  }

  let rels
  try {
    /*
     * gemma로 묻는다.
     *
     * 무료 티어 하루 한도가 모델마다 자릿수가 다르다. gemini-3.6-flash는
     * 하루 20건이라 판정 일곱 번이면 마른다(limit: 20을 오류 본문에서 확인).
     * gemma는 그보다 훨씬 넉넉하다.
     *
     * 대신 gemma는 분당 제한에 잘 걸린다. 조각을 적게 나누는 이유가 그것이다.
     */
    rels = await judgeRelations(focus, cands, { model: MODEL_GEMMA })
  } catch (e) {
    /*
     * 막히면 쉬고, 쉬어도 안 되면 그만둔다.
     *
     * 예전에는 그냥 다음 질문으로 넘어갔다. 한도에 걸린 실행이 남은 102개를
     * 순식간에 전부 실패로 태우고 끝났다(성공 1개). 실패가 빨라지자 목록을
     * 빠르게 태우게 된 것이다.
     */
    failures += 1
    const pace = nextPace({ consecutiveFailures: failures })
    console.log(`  ! ${focus.question} — ${(e as Error).message.slice(0, 90)}`)

    if (pace.stop) {
      console.log(`  연속 ${failures}회 막혔다. 여기서 끝낸다 — 남은 질문은 다음 실행이 이어받는다`)
      break
    }
    console.log(`  ${Math.round(pace.waitMs / 1000)}초 쉰다`)
    await new Promise((r) => setTimeout(r, pace.waitMs))
    continue
  }
  failures = 0

  for (const r of rels) {
    const dst = byId.get(r.toId)
    if (!dst) continue
    done.push({
      fromScope: src.identityScope,
      fromQuestion: src.question,
      toScope: dst.identityScope,
      toQuestion: dst.question,
      kind: r.kind,
      reason: r.reason,
      votes: r.votes,
    })
  }

  judged.add(`${src.identityScope}::${src.question}`)
  asked += 1
  writeFileSync(CACHE, JSON.stringify(done, null, 2))
  console.log(`  ${asked}/${targets.length} ${focus.question} → ${rels.length}개 (후보 ${cands.length})`)
}

const merged = mergeAll()

const q = (s: string) => JSON.stringify(s)
const lines = [
  '/**',
  ' * 질문 사이의 의미 관계.',
  ' *',
  ' * "같은 질문인가"가 아니라 "관련 있는가"다. 꼬리질문이 기존 질문과 같은 경우는',
  ' * 5%뿐이라 같음만으로는 선이 안 생긴다.',
  ' *',
  ' * 노드 id 대신 (범위, 질문)으로 적는다. id는 그 둘에서 파생되므로 같은 것을',
  ' * 가리키고, 이쪽이 사람이 읽고 고칠 수 있다.',
  ' *',
  ' * scripts/build-relations.ts가 만든다. 손으로 고치지 않는다.',
  ' */',
  'export type SeedRelation = {',
  '  fromScope: string',
  '  fromQuestion: string',
  '  toScope: string',
  '  toQuestion: string',
  "  kind: 'shares_concept' | 'prerequisite' | 'alternative' | 'instance_of'",
  '  reason: string',
  '  votes: number',
  '}',
  '',
  'export const SEED_RELATIONS: SeedRelation[] = [',
]
for (const r of merged) {
  lines.push(
    `  { fromScope: ${q(r.fromScope)}, fromQuestion: ${q(r.fromQuestion)}, toScope: ${q(r.toScope)}, toQuestion: ${q(r.toQuestion)}, kind: ${q(r.kind)}, reason: ${q(r.reason)}, votes: ${r.votes} },`,
  )
}
lines.push(']', '')
writeFileSync(OUT, lines.join('\n'))

const byKind = new Map<string, number>()
for (const r of merged) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1)
const linked = new Set(merged.flatMap((r) => [r.fromQuestion, r.toQuestion]))

console.log(`\n관계 ${merged.length}개 · 선이 닿은 질문 ${linked.size}/${nodes.length}개`)
for (const [k, n] of [...byKind].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
