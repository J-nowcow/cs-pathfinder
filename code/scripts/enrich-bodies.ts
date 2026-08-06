import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { generateNodeContent } from '../src/lib/llm/generate'
import { rootNodeId } from '../src/lib/db/bootstrap'
import { EXAMPLE_NODES } from '../data/example-nodes'

/**
 * 도식 없는 옛 해설을 제자리에서 다시 쓴다.
 *
 * 도식 규칙을 프롬프트에 넣기 전에 만들어진 노드는 전부 줄글이다. 지난 질문을
 * 훑는 사람은 그 벽을 그대로 만난다.
 *
 * 트리를 지웠다 다시 만들지 않는다. 그러면 노드 id가 바뀌어서 남이 저장해 둔
 * 여정과 공유 링크가 끊긴다. 질문·꼬리질문·id는 그대로 두고 body만 바꾼다.
 *
 * 새 본문에 도식이 생겼을 때만 갈아끼운다. 줄글을 줄글로 바꾸면 LLM 호출만
 * 태우고 남는 게 없다.
 *
 * 실행: npm run db:enrich            (보기만)
 *       npm run db:enrich -- --yes   (반영)
 *       npm run db:enrich -- --yes --limit 5
 */

type Row = {
  id: string
  question: string
  identity_scope: string
  body: string
}

/** 줄글만 있는가 */
function isPlain(body: string): boolean {
  return parseBlocks(body).every((b) => b.type === 'paragraph')
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

const write = process.argv.includes('--yes')
const limit = Number(arg('--limit') ?? 30)

const db = await getDb()

const rows = await db.query<Row>(
  `select id, normalized_question as question, identity_scope, body
     from qnode
    where status = 'ready'
      and body <> ''
    order by created_at`,
)

/*
 * 손으로 쓴 예시는 건드리지 않는다.
 *
 * 그쪽은 생성 프롬프트의 기준선이다. 모델이 다시 쓰면 기준이 모델 출력으로
 * 바뀌고, 그러면 예시가 기준선 노릇을 못 한다. origin 열로는 구분이 안 되므로
 * (배치·요청 두 값뿐) 파일에서 id를 되짚어 뺀다.
 */
const exampleIds = new Set(EXAMPLE_NODES.map((e) => rootNodeId(e)))

const plainAll = rows.filter((r) => !exampleIds.has(r.id) && isPlain(r.body))
const plain = plainAll.slice(0, limit)

console.log(`ready ${rows.length}개 · 예시 ${exampleIds.size}개 제외 · 줄글만 ${plainAll.length}개`)
console.log(`이번에 볼 것 ${plain.length}개${write ? '' : '  (보기만 — 반영하려면 --yes)'}\n`)

let replaced = 0
let kept = 0
let failed = 0

for (const [i, row] of plain.entries()) {
  const head = `[${i + 1}/${plain.length}] ${row.question.slice(0, 40)}`
  try {
    const next = await generateNodeContent({
      question: row.question,
      identityScope: row.identity_scope,
      parentQuestion: null,
    })

    const kinds = parseBlocks(next.body).map((b) => b.type)
    const diagrams = kinds.filter((k) => k !== 'paragraph')

    /*
     * 도식이 안 붙었으면 그대로 둔다.
     *
     * 새 본문이 더 낫다는 보장이 없다. 같은 프롬프트로 다시 뽑았을 뿐이라
     * 도식이라는 눈에 보이는 차이가 없으면 바꿀 이유가 없다.
     */
    if (diagrams.length === 0) {
      kept++
      console.log(`${head} — 도식 없음, 그대로 둔다`)
      continue
    }

    /* 내용이 통째로 날아간 응답을 덮어쓰지 않는다 */
    if (next.body.trim().length < 120) {
      kept++
      console.log(`${head} — 새 본문이 너무 짧다(${next.body.trim().length}자), 그대로 둔다`)
      continue
    }

    if (write) {
      await db.query(`update qnode set body = $2 where id = $1`, [row.id, next.body])
    }
    replaced++
    console.log(`${head} — ${diagrams.join(',')} 붙음${write ? '' : ' (미반영)'}`)
  } catch (e) {
    failed++
    console.log(`${head} — 실패: ${e instanceof Error ? e.message : String(e)}`)
  }
}

console.log(`\n바꿈 ${replaced} · 그대로 ${kept} · 실패 ${failed}`)
process.exit(0)
