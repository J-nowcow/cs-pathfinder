import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { loadCatalog, renderCatalog } from '../src/lib/db/catalog'
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
const OUT = resolve(process.cwd(), 'docs/questions.md')

const catalog = await loadCatalog()
const next = renderCatalog(catalog, SITE_URL)

const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
if (prev === next) {
  console.log(`변화 없음 — 질문 ${catalog.entries.length}개`)
  process.exit(0)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, next)
console.log(`docs/questions.md 갱신 — 질문 ${catalog.entries.length}개 · 카테고리 ${catalog.byCategory.length}개`)
process.exit(0)
