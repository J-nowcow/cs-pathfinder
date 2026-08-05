import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { publishDaily, countUnconsumedSeeds } from '../src/lib/daily/publish'
import { getTodayTree } from '../src/lib/daily/today'
import { resolveCaller } from '../src/lib/llm/resolve'
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
async function main() {
  const date = process.argv[2] ?? kstToday()
  const usingStub = resolveCaller() !== undefined

  console.log(`발행일 ${date} (KST)`)
  console.log(`모델   ${usingStub ? '개발 스텁 (API 키 없음)' : '실제 Gemini'}`)
  console.log(`시드   남음 ${await countUnconsumedSeeds()}개\n`)

  const out = await publishDaily({ date, call: resolveCaller() })

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
