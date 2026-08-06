import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDb } from '../src/lib/db/client'
import { ensureSeeded } from '../src/lib/db/bootstrap'
import { CATEGORIES, categoryAnchor } from '../src/lib/tree/categories'
import { toGithubMarkdown } from '../src/lib/markdown/to-github'
import { kstToday } from '../src/lib/daily/date'
import { SITE_URL } from '../src/lib/site'

/**
 * 해설 전문을 레포에 떠 놓는다.
 *
 * 대문은 "질문 전문은 `cs/questions.md`에 있다"고 말하는데 **그 파일에는 링크만
 * 있다.** 레포를 둘러보는 사람은 읽을 것이 하나도 없이 링크를 하나씩 눌러야
 * 한다. 별을 모으려는 자료 레포에서 그건 치명적이다.
 *
 * `cs/questions.md`는 건드리지 않는다. 그 파일은 발행 워크플로가 배포된 앱의
 * `/api/catalog`를 받아 덮어쓴다. 여기서 같이 쓰면 서로 밀어낸다.
 *
 * **분야마다 파일을 나눈다.** 한 파일에 다 넣으면 200KB가 넘어 GitHub에서 한
 * 화면에 안 들어오고, 무엇이 있는지 훑을 수도 없다.
 *
 * 담는 범위는 `loadCatalog`와 같은 규칙이다 — `origin='batch'`이고 발행일이
 * 지난 것만. 사용자가 자유 입력으로 판 질문은 안 담는다. 생성이 끝났다는 것과
 * 공개해도 된다는 것은 다르고, 레포에 박히면 되돌릴 수 없다.
 *
 * 실행: npx tsx scripts/dump-explanations.ts
 */
const DIR = resolve(process.cwd(), '../cs/explanations')

/*
 * 주소를 반드시 확인하고 쓴다.
 *
 * `SITE_URL`은 환경변수가 없으면 `http://localhost:3000`으로 떨어진다. 그대로
 * 돌렸다가 **257편의 링크가 전부 localhost를 가리키는 파일을 만들 뻔했다.**
 * 레포에 박히면 레포를 보는 모든 사람에게 죽은 링크다.
 *
 * 조용히 로컬 주소를 쓰느니 멈춘다. 손으로 돌릴 때는
 * `NEXT_PUBLIC_SITE_URL=https://cs-pathfinder.vercel.app`을 앞에 붙인다.
 */
if (SITE_URL.includes('localhost')) {
  console.error('SITE_URL이 로컬이다. NEXT_PUBLIC_SITE_URL을 주고 다시 돌려라.')
  console.error(`  NEXT_PUBLIC_SITE_URL=https://cs-pathfinder.vercel.app npx tsx ${process.argv[1]}`)
  process.exit(1)
}

/** 파일 이름. 분야 이름에 공백과 `·`가 있어 그대로는 못 쓴다 */
const fileOf = (category: string) => `${categoryAnchor(category).replace(/^c-/, '')}.md`

await ensureSeeded()

const db = await getDb()
const rows = await db.query<{ id: string; question: string; category: string; body: string }>(
  `select n.id,
          n.normalized_question as question,
          n.primary_category    as category,
          n.body
     from qnode n
     left join tree t
            on t.root_node_id = n.id
           and t.kind = 'daily'
    where n.status = 'ready'
      and n.origin = 'batch'
      and n.body is not null and n.body <> ''
      and (t.publish_date is null or t.publish_date <= $1::date)
    order by n.created_at asc, n.normalized_question asc`,
  [kstToday()],
)

/**
 * 머리말.
 *
 * **틀릴 수 있다는 말을 맨 위에 둔다.** 이 글은 대부분 모델이 썼고, 전수
 * 대조에서 열 편 중 셋에 면접관이 되물을 서술이 있었다
 * (`code/docs/audit/2026-08-07-fact-check-full.md`). 그것을 안 적고 내놓으면
 * 읽는 사람을 속이는 것이다.
 */
function header(category: string, n: number): string {
  return [
    `# ${category}`,
    '',
    `질문 ${n}개. [서비스에서 보기](${SITE_URL}/questions#${categoryAnchor(category)})`,
    '',
    '> 이 글은 대부분 AI가 썼다. 전수 대조에서 **열 편 중 셋**에 면접관이 되물을',
    '> 서술이 있었다. 고쳐야 할 것을 [`code/docs/audit/2026-08-07-hard-errors.md`]',
    '> (../../code/docs/audit/2026-08-07-hard-errors.md)에 모아 두었다.',
    '> 틀린 곳을 찾으면 이슈로 알려 주면 고친다.',
    '',
    '> 도식은 서비스에서 그림으로 그려진다. 여기서는 GitHub이 그릴 수 있는',
    '> 표와 목록으로 옮겼다.',
    '',
    /* 인용 블록과 첫 제목이 붙어 있으면 읽을 때 한 덩어리로 보인다 */
    '',
  ].join('\n')
}

mkdirSync(DIR, { recursive: true })

/*
 * 지난번 파일을 먼저 지운다.
 *
 * 분야가 통째로 비거나 이름이 바뀌면 옛 파일이 그대로 남는다. 그러면 목록에는
 * 없는데 파일은 있는 상태가 되고, 레포를 보는 사람은 그것도 현재 내용으로 읽는다.
 */
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
  rmSync(`${DIR}/${f}`)
}

let written = 0
const index: string[] = []

for (const category of CATEGORIES) {
  const mine = rows.filter((r) => r.category === category)
  if (mine.length === 0) continue

  const body = mine
    .map(
      (r) =>
        `## ${r.question}\n\n` +
        `${toGithubMarkdown(r.body)}\n\n` +
        `[이 질문 파고들기 →](${SITE_URL}/q/${r.id})\n`,
    )
    .join('\n---\n\n')

  writeFileSync(`${DIR}/${fileOf(category)}`, `${header(category, mine.length)}${body}`)
  index.push(`- [${category}](${fileOf(category)}) — ${mine.length}개`)
  written += 1
}

writeFileSync(
  `${DIR}/README.md`,
  [
    '# 해설 전문',
    '',
    `질문 ${rows.length}개를 분야 ${written}개로 나눠 담았다. 서비스에서 보이는 것과 같은 글이고`,
    'GitHub이 그릴 수 있게 도식만 표와 목록으로 옮겼다.',
    '',
    ...index,
    '',
    '제목만 훑으려면 [`../questions.md`](../questions.md)가 링크 목록이다.',
    '',
    '> 이 파일들은 `code/scripts/dump-explanations.ts`가 만든다. 손으로 고치면 다음',
    '> 실행에 덮인다.',
    '',
  ].join('\n'),
)

console.log(`해설 ${rows.length}개 → ${written}개 파일 (${DIR})`)
process.exit(0)
