import { postgresPoolConfig } from '../src/lib/db/postgres-config'
import { loadEnvLocal } from '../src/lib/load-env'
import { parseBlocks } from '../src/lib/markdown/blocks'
import { flowShape, type FlowShape } from '../src/lib/markdown/flow-shape'
import type { FlowStep } from '../src/lib/markdown/blocks'

/**
 * 저장된 `:::flow` 74개가 실제로 어떤 모양인지 센다.
 *
 * `blocks.ts`는 `flow`를 "행위자 사이의 순서. 3-way handshake 같은 것"이라고
 * 정의한다. 그런데 실제로 들어 있는 것은 두 가지가 섞여 있을 수 있다.
 *
 * - **왕복** — A가 B에게 보내고 B가 A에게 답한다. 주체가 적고 오간다.
 *   시퀀스 도식(기둥과 화살표)이 맞는 모양이다
 * - **파이프라인** — A → B → C, 마디마다 한 번씩만 지난다. 되돌아오지 않는다.
 *   세로 트렁크가 맞는 모양이다
 *
 * 어느 쪽이 다수인지에 따라 렌더러 교체의 값어치가 갈린다. 잘못 고르면
 * 74편이 한꺼번에 나빠진다.
 *
 * 실행: npm run measure:flow-shape
 */
loadEnvLocal()

type Row = { number: number | null; question: string; body: string }

/**
 * 모양은 **화면이 쓰는 그 함수**로 판정한다.
 *
 * 여기 원래 `shapeOf()`라는 어림짐작이 따로 있었다. 이 도구가 `flow-shape.ts`
 * **보다 먼저** 만들어졌기 때문이다 — 판별기를 만들지 말지 정하려고 쓴 것이다.
 * 판별기가 생긴 뒤에도 이 사본이 그대로 남았다.
 *
 * 지금은 두 값이 같다(42/27/21). 그래서 더 위험하다. **같아 보이니 아무도
 * 안 본다.** 판별기의 `MAX_LANES`를 바꾸면 화면은 달라지는데 이 도구는
 * 옛 숫자를 계속 찍는다. "새 도식이 실제로 쓰이는지"를 재는 도구가 화면이
 * 안 쓰는 기준으로 재고 있으면 그건 재는 것이 아니다.
 */
type Shape = {
  actors: number
  steps: number
  kind: FlowShape
}

function shapeOf(steps: FlowStep[]): Shape {
  const actors = new Set<string>()
  for (const s of steps) {
    actors.add(s.from)
    actors.add(s.to)
  }
  return { actors: actors.size, steps: steps.length, kind: flowShape(steps) }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool(postgresPoolConfig(url))
  const r = await pool.query<Row>(
    `select number, normalized_question as question, coalesce(body,'') as body
       from qnode where body like '%:::flow%' order by number asc nulls last`,
  )

  const shapes: Array<Shape & { number: number | null; question: string }> = []
  for (const row of r.rows) {
    for (const b of parseBlocks(row.body)) {
      if (b.type !== 'flow') continue
      shapes.push({ ...shapeOf(b.steps), number: row.number, question: row.question })
    }
  }

  const n = shapes.length
  const backAndForth = shapes.filter((s) => s.kind === 'sequence')
  const linear = shapes.filter((s) => s.kind === 'chain')
  const other = shapes.filter((s) => s.kind === 'other')
  const drawn = backAndForth.length + linear.length

  console.log(`:::flow 블록 ${n}개  (해설 ${r.rows.length}편)`)
  console.log('')
  console.log(`기둥 (sequence)   ${backAndForth.length}개`)
  console.log(`사슬 (chain)      ${linear.length}개`)
  console.log(`그대로 (other)    ${other.length}개`)
  console.log(`**새 그림을 받는 것 ${drawn}/${n} (${Math.round((drawn / n) * 100)}%)**`)
  console.log('')

  const hist = new Map<number, number>()
  for (const s of shapes) hist.set(s.actors, (hist.get(s.actors) ?? 0) + 1)
  console.log('마디 수 분포')
  for (const [k, v] of [...hist.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(k).padStart(2)}개  ${'#'.repeat(v)} ${v}`)
  }
  console.log(`  5개 넘는 것 ${shapes.filter((s) => s.actors > 5).length}개  (시퀀스 도식이 390px에서 감당 못 하는 크기)`)

  console.log('\n기둥으로 그려지는 것 몇 개만')
  for (const s of backAndForth.slice(0, 6)) {
    console.log(`  #${s.number} 마디${s.actors} 단계${s.steps}  ${s.question.slice(0, 40)}`)
  }
  console.log('\n사슬로 그려지는 것 몇 개만')
  for (const s of linear.slice(0, 6)) {
    console.log(`  #${s.number} 마디${s.actors} 단계${s.steps}  ${s.question.slice(0, 40)}`)
  }

  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
