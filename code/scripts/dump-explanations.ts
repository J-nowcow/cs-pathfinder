import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync, readFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
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

/** 분야 폴더 이름. 분야 이름에 공백과 `·`가 있어 그대로는 못 쓴다 */
const dirOf = (category: string) => categoryAnchor(category).replace(/^c-/, '')

/**
 * 질문 하나에 파일 하나.
 *
 * 전에는 분야마다 한 파일이라 `네트워크.md` 하나에 30편이 29KB로 들어 있었다.
 * GitHub에서 그건 세 가지로 손해다.
 *
 * - **찾을 수가 없다.** 코드 검색은 파일 단위로 결과를 주는데 30편이 한
 *   파일이면 어느 질문에서 걸린 것인지 안 보인다
 * - **가리킬 수가 없다.** 이슈나 PR에서 특정 질문을 지목할 주소가 없다.
 *   한글 앵커는 깨지기 쉽다
 * - **고치기가 무섭다.** 오타 하나에 29KB 파일로 PR을 열어야 한다
 *
 * 번호를 세 자리로 채운다. 안 채우면 파일 목록이 `1, 10, 100, 2`로 선다.
 * 질문 번호는 이미 주소(`/q/3`)와 같은 번호라 파일·링크·서비스가 한 번호로
 * 꿰인다.
 */
function fileOf(number: number, question: string): string {
  const slug = question
    .replace(/[?!.,'"`()[\]{}<>:;/\\|*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '')
  return `${String(number).padStart(3, '0')}-${slug}.md`
}

/**
 * 대조에서 지적이 나왔고 **아직 안 고친 편.**
 *
 * 처음에는 지적 목록(`hard-errors.md`)의 80편 전부에 표시를 달았다. 그때는
 * 사람이 아직 안 본 상태라 그게 맞았다.
 *
 * 지금은 그 80편을 하나씩 판정해 **77편을 고쳤다**(`docs/audit/fixes/`).
 * 고친 편에까지 "지적이 나왔다"를 달아 두면 거짓이다 — 읽는 사람은 지금 보는
 * 글이 아직 틀린 줄 안다.
 *
 * 그래서 교정안에서 `판정: 고침`인 편은 표시를 뺀다. `판정: 반려`인 편만
 * 남기되 문구를 바꾼다 — 지적은 있었지만 검토해서 그대로 두기로 한 것이다.
 */
function reviewedIds(): { rejected: Set<string> } {
  const dir = resolve(process.cwd(), 'docs/audit/fixes')
  const rejected = new Set<string>()
  if (!existsSync(dir)) return { rejected }

  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(`${dir}/${f}`, 'utf8')
    let id = ''
    for (const line of text.split('\n')) {
      const head = /^##\s+([0-9a-f-]{36})/.exec(line)
      if (head) { id = head[1]; continue }
      if (/^판정:\s*반려/.test(line) && id) rejected.add(id)
    }
  }
  return { rejected }
}

const flagged = reviewedIds().rejected

await ensureSeeded()

const db = await getDb()
const rows = await db.query<{
  id: string
  number: number
  question: string
  category: string
  body: string
}>(
  `select n.id,
          n.number,
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
 * **틀릴 수 있다는 말을 맨 위에 둔다.** 이 글은 대부분 모델이 썼고 전수 대조에서
 * 열 편 중 셋에 면접관이 되물을 서술이 있었다
 * (`code/docs/audit/2026-08-07-fact-check-full.md`). 그것을 안 적고 내놓으면
 * 읽는 사람을 속이는 것이다.
 *
 * 다만 "열 편 중 셋"이라고만 적으면 어느 셋인지 모른다. 지적이 나온 편에는
 * 제목 아래 표시를 달았으므로, 여기서는 **표시가 없으면 지적이 없었다는 뜻**임을
 * 알린다. 그래야 표시의 값어치가 생긴다.
 */
function header(category: string, n: number, flaggedHere: number): string {
  return [
    `# ${category}`,
    '',
    `질문 ${n}개 · 검토 후 유지 ${flaggedHere}개. ` +
      `[서비스에서 보기](${SITE_URL}/questions#${categoryAnchor(category)})`,
    '',
    '> 이 글은 대부분 AI가 썼다. 전수 대조에서 나온 지적 80편을 하나씩 판정해',
    '> **77편을 고쳤다**([교정 기록](../../../code/docs/audit/fixes/)). 검토 후 그대로',
    '> 두기로 한 편에만 제목 아래 한 줄을 달았다.',
    '> 틀린 곳을 찾으면 이슈로 알려 주면 고친다.',
    '',
    '> 질문 하나에 파일 하나다. 제목을 눌러 들어가면 해설 전문이 있다.',
    '',
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
if (existsSync(DIR)) rmSync(DIR, { recursive: true })
mkdirSync(DIR, { recursive: true })

let written = 0
const index: string[] = []

let files = 0

for (const category of CATEGORIES) {
  const mine = rows.filter((r) => r.category === category)
  if (mine.length === 0) continue

  const dir = `${DIR}/${dirOf(category)}`
  mkdirSync(dir, { recursive: true })

  const listed: string[] = []

  for (const r of mine) {
    /*
     * **"틀렸다"고 안 쓴다.** 지적한 것도 모델이고 사람이 아직 안 봤다.
     * 확정처럼 쓰면 멀쩡한 글에 없는 흠을 만든다.
     */
    const warn = flagged.has(r.id)
      ? '> 이 해설은 교차 대조에서 지적이 나왔으나 **검토 후 그대로 두기로 했다.** ' +
        '판단 근거는 [교정 기록](../../../code/docs/audit/fixes/)에 있다.\n\n'
      : ''

    const name = fileOf(r.number, r.question)
    writeFileSync(
      `${dir}/${name}`,
      [
        `# ${r.question}`,
        '',
        `\`#${r.number}\` · ${category}`,
        '',
        warn + toGithubMarkdown(r.body),
        '',
        '---',
        '',
        `**[꼬리를 물고 더 파고들기 →](${SITE_URL}/q/${r.number})** · ` +
          `[${category} 목록](README.md) · [전체 목록](../README.md)`,
        '',
        '> 이 글은 대부분 AI가 썼다. 틀린 곳을 찾으면 이슈로 알려 주면 고친다.',
        '> 도식은 서비스에서 그림으로 그려진다. 여기서는 GitHub이 그릴 수 있는 표와 목록으로 옮겼다.',
        '',
      ].join('\n'),
    )
    listed.push(
      `- [\`#${r.number}\` ${r.question}](${name})` +
        (flagged.has(r.id) ? ' — 검토 후 유지' : ''),
    )
    files += 1
  }

  const flaggedHere = mine.filter((r) => flagged.has(r.id)).length
  writeFileSync(`${dir}/README.md`, `${header(category, mine.length, flaggedHere)}${listed.join('\n')}\n`)
  index.push(
    `- [${category}](${dirOf(category)}/) — ${mine.length}개` +
      (flaggedHere > 0 ? ` (검토 후 유지 ${flaggedHere})` : ''),
  )
  written += 1
}

writeFileSync(
  `${DIR}/README.md`,
  [
    '# 해설 전문',
    '',
    `질문 ${rows.length}개. **질문 하나에 파일 하나다.**`,
    '서비스에서 보이는 것과 같은 글이고 GitHub이 그릴 수 있게 도식만 표와 목록으로 옮겼다.',
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

const marked = rows.filter((r) => flagged.has(r.id)).length
console.log(`해설 ${rows.length}개 → 파일 ${files}개 · 분야 ${written}개 · 검토 후 유지 표시 ${marked}개 (${DIR})`)
process.exit(0)
