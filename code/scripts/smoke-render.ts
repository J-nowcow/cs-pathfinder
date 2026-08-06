import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { getDb } from '../src/lib/db/client'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * 파서를 고친 뒤 코퍼스 전체가 여전히 멀쩡한지 본다.
 *
 * 파서 한 줄이 **이미 나가 있는 276편 전부**의 화면을 바꾼다. 시험은 내가 쓴
 * 예시만 보고, 브라우저 확인은 두세 편만 본다. 그 사이에 있는 것 —
 * "273편은 그대로인가" — 는 아무도 안 봤다.
 *
 * 서버를 띄우지 않는다. 렌더러가 하는 일은 `parseBlocks`가 내놓은 블록을 그대로
 * 그리는 것뿐이라 파서 결과만 보면 화면이 어떻게 되는지 안다.
 *
 * 세 가지를 본다.
 * 1. **기호가 새는가** — 문단에 `:::`나 ```` ``` ````가 남으면 고장으로 읽힌다
 * 2. **구분줄이 새는가** — `---`가 층 이름이나 문단에 남으면 표가 깨진 것이다
 * 3. **본문을 잃었는가** — 파싱 뒤 글자 수가 원문보다 크게 줄면 삼킨 것이다
 *
 * 실행: npx tsx scripts/smoke-render.ts
 */
const db = await getDb()

const rows = await db.query<{ id: string; question: string; body: string }>(
  `select id, normalized_question as question, body
   from qnode where status = 'ready' and body is not null and body <> ''`,
)

const leakedFence: string[] = []
const leakedRule: string[] = []
const lostText: string[] = []

/** 울타리와 구분줄을 뺀 순수 글자 수. 이것이 크게 줄면 본문을 잃은 것이다 */
function meat(s: string) {
  return s
    .replace(/^:::.*$/gm, '')
    .replace(/^```.*$/gm, '')
    .replace(/[\s|\->→=]/g, '').length
}

for (const r of rows) {
  const blocks = parseBlocks(r.body)

  const texts: string[] = []
  for (const b of blocks) {
    if (b.type === 'paragraph') texts.push(b.text)
    else if (b.type === 'stack') texts.push(...b.layers.map((l) => `${l.name} ${l.note}`))
    else if (b.type === 'table') texts.push(...b.head, ...b.rows.flat())
    else if (b.type === 'flow' || b.type === 'state')
      texts.push(...b.steps.map((s) => `${s.from} ${s.to} ${s.label}`))
    else if (b.type === 'tree') texts.push(...b.nodes.map((n) => `${n.name} ${n.note}`))
    else if (b.type === 'memory') texts.push(...b.areas.map((a) => `${a.name} ${a.note}`))
    else if (b.type === 'timeline') texts.push(...b.rows.map((t) => `${t.actor} ${t.slots.join(' ')}`))
  }

  const joined = texts.join('\n')
  const head = `[${r.id.slice(0, 8)}] ${r.question.slice(0, 40)}`

  if (/:::|```/.test(joined)) leakedFence.push(head)
  /* 구분줄이 화면에 남았는가. 표로 읽혔으면 파서가 이미 떼어 냈다 */
  if (texts.some((t) => /^[\s|]*:?-{2,}:?[\s|]*$/.test(t))) leakedRule.push(head)

  const before = meat(r.body)
  const after = meat(joined)
  /* 5%까지는 울타리 기호를 떼면서 줄어드는 몫이다. 그보다 크면 삼킨 것이다 */
  if (before > 0 && after < before * 0.95) {
    lostText.push(`${head} — ${before}자 → ${after}자`)
  }
}

const show = (label: string, list: string[]) => {
  console.log(`\n## ${label}: ${list.length}편`)
  for (const l of list.slice(0, 10)) console.log(`  ${l}`)
  if (list.length > 10) console.log(`  … 그리고 ${list.length - 10}편 더`)
}

console.log(`## 훑은 해설 ${rows.length}편`)
show('기호가 샌 것 (0이어야 한다)', leakedFence)
show('구분줄이 남은 것 (0이어야 한다)', leakedRule)
show('본문을 잃은 것 (0이어야 한다)', lostText)

const bad = leakedFence.length + leakedRule.length + lostText.length
console.log(`\n판정: ${bad === 0 ? '멀쩡하다' : `${bad}편이 어긋났다`}`)
process.exit(bad === 0 ? 0 : 1)
