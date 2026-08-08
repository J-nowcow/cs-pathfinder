import { readFileSync } from 'node:fs'
import { patchDataFiles } from './lib/patch-data'

/**
 * 사실 검증에서 나온 교정을 정적 파일에 한꺼번에 넣는다.
 *
 * 245편을 훑는 일이라 교정이 수십 건씩 나온다. 매번 손으로 치환문을 짜면
 * **한 건이 조용히 빗나가도 모른다.** 실제로 그랬다 -- 34편을 고쳤는데 넷이
 * 되돌아가 있었고 배포 뒤에야 알았다.
 *
 * 그래서 결과를 건별로 찍고 **하나라도 못 찾으면 종료 코드를 1로 낸다.**
 * 관문에서 걸리게 하려는 것이다.
 *
 * 입력: [{ "before": "...", "after": "..." }, ...] 꼴의 JSON 파일
 * 실행: node_modules/.bin/tsx scripts/apply-corrections.ts <json경로>
 */
type Correction = { before: string; after: string; note?: string }

const path = process.argv[2]
if (!path) {
  console.error('쓰기: apply-corrections.ts <json경로>')
  process.exit(2)
}

const list: Correction[] = JSON.parse(readFileSync(path, 'utf8'))
let ok = 0
const failed: string[] = []

for (const c of list) {
  const r = patchDataFiles(c.before, c.after)
  const head = c.before.slice(0, 34).replace(/\n/g, ' ')
  if (r.ok) {
    ok += 1
    console.log(`  적용 ${r.file.replace('data/', '')} · ${head}…`)
  } else {
    failed.push(head)
    console.log(`  실패(${r.reason}) · ${head}…`)
  }
}

console.log(`\n${ok}/${list.length} 적용`)
if (failed.length) {
  console.error(`못 찾은 것 ${failed.length}건 -- 인용이 파일과 다르다`)
  process.exit(1)
}
process.exit(0)
