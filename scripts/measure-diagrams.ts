import { loadEnvLocal } from '../src/lib/load-env'

loadEnvLocal()

import { generateNodeContent } from '../src/lib/llm/generate'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * 해설에 도식이 실제로 들어가는지 잰다.
 *
 * 프롬프트만 고치고 넘어가면 모델이 따르는지 알 수 없다. 실호출로 확인한다.
 *
 * 두 가지를 본다.
 * - 도식이 붙는 비율. 안 붙으면 통짜 글로 돌아간 것이다
 * - 기호가 새는 비율. 파서가 못 알아본 울타리는 화면에 `:::`로 보인다.
 *   도식을 못 그린 것보다 이쪽이 나쁘다
 *
 * 실행: npm run measure:diagrams
 */
const CASES = [
  { q: 'HTTPS 핸드셰이크는 어떤 순서로 진행되는가?', scope: 'network', parent: 'HTTPS는 무엇을 보장하는가?' },
  { q: 'TCP와 UDP는 무엇을 기준으로 고르는가?', scope: 'tcp', parent: '전송 계층은 무슨 일을 하는가?' },
  { q: 'JVM 메모리는 어떤 영역으로 나뉘는가?', scope: 'jvm', parent: 'JVM은 메모리를 어떻게 쓰는가?' },
  { q: 'OAuth 2.0 인가 코드 흐름은 어떻게 도는가?', scope: 'security', parent: 'OAuth는 무엇을 푸는가?' },
  { q: '캐시 계층은 어떤 순서로 조회되는가?', scope: 'redis', parent: '캐시는 어디에 두는가?' },
  { q: '프로세스와 스레드는 무엇이 다른가?', scope: 'os', parent: '운영체제는 실행 단위를 어떻게 나누는가?' },
]

async function main() {
  const runs = Number(process.argv[2] ?? 1)
  let withDiagram = 0
  let leaked = 0
  let total = 0
  const kinds = new Map<string, number>()

  for (let r = 0; r < runs; r += 1) {
    for (const c of CASES) {
      total += 1
      try {
        const out = await generateNodeContent({
          question: c.q,
          identityScope: c.scope,
          parentQuestion: c.parent,
        })
        const blocks = parseBlocks(out.body)
        const diagrams = blocks.filter((b) => b.type !== 'paragraph')
        for (const d of diagrams) kinds.set(d.type, (kinds.get(d.type) ?? 0) + 1)

        // 파서를 통과한 뒤에도 기호가 남아 있으면 화면에 보인다
        const leak = blocks.some(
          (b) => b.type === 'paragraph' && (b.text.includes(':::') || b.text.includes('```')),
        )
        if (diagrams.length > 0) withDiagram += 1
        if (leak) leaked += 1

        process.stdout.write(leak ? '!' : diagrams.length > 0 ? '·' : '_')
      } catch {
        process.stdout.write('x')
      }
    }
  }

  process.stdout.write('\n\n(· 도식 있음  _ 통짜 글  ! 기호 샘  x 실패)\n\n')
  console.log(`도식이 붙은 해설  ${withDiagram}/${total}`)
  console.log(`기호가 샌 해설    ${leaked}/${total}   (0이어야 한다)`)
  console.log(`종류별  ${[...kinds].map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
