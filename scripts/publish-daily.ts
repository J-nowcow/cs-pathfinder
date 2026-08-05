import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { publishDaily, countUnconsumedSeeds } from '../src/lib/daily/publish'
import { getTodayTree } from '../src/lib/daily/today'
import { resolveCaller } from '../src/lib/llm/resolve'
import { callWithFallback, type StructuredCaller } from '../src/lib/llm/client'
import { kstToday } from '../src/lib/daily/date'

/**
 * 오늘의 질문을 손으로 발행한다.
 *
 * 평소에는 GitHub Actions가 `POST /api/publish-daily`를 부른다. 이 스크립트는
 * 배포 전 검증과 발행이 밀렸을 때의 복구용이다. 같은 publishDaily를 타므로
 * 하루 하나 보장도 그대로 적용된다.
 *
 * 실행: npm run publish:daily [YYYY-MM-DD]
 */

/**
 * 손발행은 서버리스 예산에 묶이지 않는다.
 *
 * 라우트용 dailyCaller는 시도 40초·전체 55초다. 함수가 죽기 전에 끝내려는
 * 값이라 여기서는 필요 없다. 한도가 마른 날 사슬 끝의 Gemma가 답하는 데
 * 25초 안팎이 걸리고 회차마다 크게 흔들려서, 그 예산을 그대로 물려받으면
 * 복구용 스크립트가 정작 복구가 필요한 날에 실패한다.
 */
const patientCaller: StructuredCaller = (a) =>
  callWithFallback(a, { attemptTimeoutMs: 150_000 })
async function main() {
  const date = process.argv[2] ?? kstToday()
  const usingStub = resolveCaller() !== undefined

  console.log(`발행일 ${date} (KST)`)
  console.log(`모델   ${usingStub ? '개발 스텁 (API 키 없음)' : '실제 Gemini'}`)
  console.log(`시드   남음 ${await countUnconsumedSeeds()}개\n`)

  const out = await publishDaily({ date, call: resolveCaller() ?? patientCaller })

  switch (out.kind) {
    case 'published':
      console.log('발행됨')
      console.log(`  시드    [${out.seed.category}] ${out.seed.term}`)
      break
    case 'already_published':
      console.log('이미 발행됨 — 새로 만들지 않았다')
      break
    case 'seed_exhausted':
      console.error('미소비 시드가 없다. topic_seed를 보충해야 한다.')
      process.exit(1)
      return
    case 'generation_failed':
      console.error(`생성 실패: ${out.detail}`)
      process.exit(1)
      return
  }

  const t = out.tree
  console.log(`  트리    ${t.id}`)
  console.log(`  slug    ${t.slug}`)
  console.log(`  분류    ${t.category}`)
  console.log(`  질문    ${t.root.question}`)
  console.log(`  노드    ${t.root.id}`)
  console.log(`  요약    ${t.summary}`)
  console.log(`  해설    ${t.root.body.length}자`)
  console.log('  꼬리질문')
  for (const s of t.root.suggestions) console.log(`    - ${s.text}`)

  // 화면이 실제로 부르는 경로도 같이 확인한다.
  const today = await getTodayTree(date)
  console.log(`\ngetTodayTree(${date}) → ${today?.slug ?? 'null'} (isToday=${today?.isToday})`)
  console.log(`시드   남음 ${await countUnconsumedSeeds()}개`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
