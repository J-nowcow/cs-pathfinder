import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadCatalog, renderCatalog } from '../src/lib/db/catalog'
import { ensureSeeded } from '../src/lib/db/bootstrap'
import { SITE_URL } from '../src/lib/site'

/**
 * 질문 목록을 레포에 떠 놓는다.
 *
 * 서비스는 Vercel에 있고 목록은 화면에서 본다. 레포만 보러 온 사람에게는 이
 * 서비스가 무엇을 담고 있는지 안 보인다. 주제어 시드가 파일로 있긴 하지만
 * 그건 "언젠가 질문을 만들 대기열"이지 질문이 아니다.
 *
 * 발행 워크플로가 매일 돌린다. 내용이 그대로면 파일을 건드리지 않는다 —
 * 안 그러면 바뀐 게 없는 날에도 커밋이 하나씩 쌓인다.
 *
 * 실행: npm run docs:questions
 */
/*
 * 질문은 코드 바깥에 쌓인다.
 *
 * 이 스크립트는 `code/`에서 도는데 결과물은 레포 루트의 `cs/`로 나간다.
 * 문제 모음은 이 앱의 산출물이지 소스가 아니라서다 — 레포를 처음 여는
 * 사람이 코드를 헤집지 않고도 무엇이 담겨 있는지 볼 수 있어야 한다.
 */
const OUT = resolve(process.cwd(), '../cs/questions.md')

/*
 * 읽기 전에 시드를 확인한다.
 *
 * `DATABASE_URL`이 없으면 PGlite가 이 프로세스 안에서만 사는 빈 DB로 뜬다.
 * 앱은 부팅할 때 `ensureSeeded`를 부르는데 이 스크립트는 안 불러서, 손으로
 * 돌리면 늘 "질문 0개"가 나왔다. 파일이 비는 게 아니라 **0개짜리 목록으로
 * 덮였다** — 실제로 한 번 그렇게 나갔다.
 *
 * 실제 DB가 붙어 있으면 이미 있는 것을 건드리지 않고 그대로 넘어간다.
 */
await ensureSeeded()

const catalog = await loadCatalog()
const next = renderCatalog(catalog, SITE_URL)

const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
if (prev === next) {
  console.log(`변화 없음 — 질문 ${catalog.entries.length}개`)
  process.exit(0)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, next)
console.log(`cs/questions.md 갱신 — 질문 ${catalog.entries.length}개 · 카테고리 ${catalog.byCategory.length}개`)
process.exit(0)
