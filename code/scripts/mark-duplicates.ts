import { loadEnvLocal } from '../src/lib/load-env'

/**
 * B6 — 중복 질문을 등가로 기록한다. **지우지 않는다.**
 *
 * 임베딩 0.90+ 쌍 34개를 Claude가 하나씩 판정했다(2026-08-09).
 * 중복 17군집·잉여 18노드. 나머지 15쌍+는 "다르지만 관련"이라
 * 등가가 아니라 `semantic_relation` 몫이다(M2).
 *
 * 왜 안 지우나 -- `qnode_equivalence`의 설계 그대로다. 잘못 이었으면
 * `active`만 내리면 되고, 옛 주소(`/q/번호`)도 계속 산다. 지우면 둘 다
 * 죽는다. 이 표가 생긴 지 이틀 만에 처음으로 실제 데이터를 받는다.
 *
 * 남길 쪽(canonical) 규칙, 위에서부터:
 *   1. 판(tree) 루트인 쪽        -- 이번 34쌍에는 없었다
 *   2. 연결(qedge·관계) 많은 쪽  -- 대부분 여기서 갈렸다
 *   3. 번호 낮은 쪽              -- 옛 링크가 더 오래 살았다
 *
 * 실행:
 *   npm run mark:duplicates            -- 무엇을 할지 보여만 준다
 *   npm run mark:duplicates -- --apply -- 실제로 기록한다
 */
loadEnvLocal()

/**
 * [정본, 잉여, 판정 근거].
 *
 * 번호로 적는다. id는 DB마다 다르지만 번호는 파일·주소·서비스가 같이 쓴다.
 */
const CLUSTERS: Array<{ keep: number; fold: number[]; why: string }> = [
  { keep: 168, fold: [266], why: '조사 하나 차이. 관계 4>3' },
  { keep: 195, fold: [263], why: '표기(세그멘/세그먼)만. 관계 6>4' },
  {
    keep: 157,
    fold: [213, 217],
    why: '해시 충돌 해결 3형제 -- 발생 시/생기면/발생했을 때. 관계 8 동률이라 낮은 번호',
  },
  { keep: 166, fold: [176], why: '주소공간 나누는 이유. 관계 6>4' },
  { keep: 208, fold: [227], why: '읽기=조회. 관계 동률, 낮은 번호' },
  { keep: 136, fold: [326], why: '수정 메서드 없이 UPDATE. 관계 1>0' },
  { keep: 159, fold: [190], why: '인접 행렬 vs 리스트 선택. 관계 1>0' },
  { keep: 275, fold: [317], why: 'B-tree 디스크. 관계 0 동률, 낮은 번호' },
  { keep: 165, fold: [192], why: '커널 모드 진입=전환 이유. 관계 동률, 낮은 번호' },
  { keep: 251, fold: [260], why: 'RDB=SQL DB. 같은 선택 기준 답. 관계 동률, 낮은 번호' },
  { keep: 158, fold: [245], why: 'BST 사용 이유 -- "일반 이진트리 대신"이 명시냐 암묵이냐만 다르다' },
  { keep: 156, fold: [231], why: '스택/큐 사용 상황. 관계 5>4' },
  { keep: 4, fold: [234], why: '컨텍스트 스위칭 비용 왜/어디서 -- 같은 답(audit도 같은 판정). 관계 3>1' },
  { keep: 178, fold: [33], why: '가상 메모리 이유. 관계 11>7' },
  { keep: 224, fold: [238], why: '쿠키/세션 구분 -- 저장 위치·상태 유지, 같은 답. 관계 4>3' },
  { keep: 8, fold: [69], why: 'equals/hashCode 규약 -- 같은 답(HashMap 동작). 유일하게 간선 있는 쪽' },
  { keep: 248, fold: [191], why: 'Thread-Safe 방법. 관계 4>0' },
]

/**
 * 중복이 **아니라고** 판정한 것도 남긴다. 다음 사람이 같은 쌍을 다시
 * 판정하지 않게. 이들은 M2에서 semantic_relation으로 이어야 한다.
 *
 *   #213군 vs #206(두 방식의 차이) vs #342(HashMap 구현) -- 나열/비교/특정구현
 *   #189(차이) vs #156(상황)  -- 정의와 응용
 *   #243(구분) vs #21(선택)   -- 정의와 응용
 *   #233 vs #27               -- HTTPS 차이 vs 보장·한계
 *   #167 vs #229              -- 스레드 풀 vs 커넥션 풀 (풀 패턴 공유)
 *   #44 vs #43                -- 차이 vs 정의
 *   #210 vs #196              -- 블로킹/논블로킹 vs 동기/비동기 축
 *   #272 vs #285              -- 컨테이너/VM vs 이미지/컨테이너
 */

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }
  const apply = process.argv.includes('--apply')

  const { getDb } = await import('../src/lib/db/client')
  const { linkEquivalent } = await import('../src/lib/expand/nodes')
  const db = await getDb()

  const nums = CLUSTERS.flatMap((c) => [c.keep, ...c.fold])
  const rows = await db.query<{ number: number; id: string; q: string }>(
    `select number, id, normalized_question as q from qnode where number = any($1)`,
    [nums],
  )
  const byNum = new Map(rows.map((r) => [r.number, r]))

  const missing = nums.filter((n) => !byNum.has(n))
  if (missing.length > 0) {
    /* 번호가 사라졌으면 판정이 낡은 것이다. 조용히 건너뛰지 않는다 */
    console.error(`번호를 못 찾았다: ${missing.join(', ')} — 판정을 다시 해야 한다`)
    process.exit(1)
  }

  let planned = 0
  for (const c of CLUSTERS) {
    const keep = byNum.get(c.keep)!
    for (const f of c.fold) {
      const fold = byNum.get(f)!
      planned += 1
      console.log(`#${f} → #${c.keep}  (${c.why})`)
      console.log(`   접힘: ${fold.q}`)
      console.log(`   정본: ${keep.q}`)
      if (apply) {
        await linkEquivalent(fold.id, keep.id, 'claude', undefined, keep.id)
      }
    }
  }

  if (apply) {
    const cnt = await db.query<{ c: number }>(
      `select count(*)::int c from qnode_equivalence where active`,
    )
    console.log(`\n기록됨. qnode_equivalence active ${cnt[0].c}행`)
  } else {
    console.log(`\n${planned}건. 실제로 기록하려면 --apply`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
