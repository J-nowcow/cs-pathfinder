import { loadEnvLocal } from '../src/lib/load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parseBlocks } from '../src/lib/markdown/blocks'

/**
 * `:::stack`으로 잘못 쓰인 도식 몇 편을 제자리로 보낸다.
 *
 * `retag`와 다르다. 저것은 울타리 **이름만** 바꾸고, 이것은 **칸과 순서까지**
 * 바꾼다. 그래서 한 편씩 앞뒤를 손으로 적어 두고, **원문이 글자 하나까지
 * 맞을 때만** 쓴다. 안 맞으면 멈춘다 -- 본문이 그새 달라졌다는 뜻이고,
 * 그때 밀어붙이면 남의 수정을 덮는다.
 *
 * 운영 DB와 `data/generated-nodes.ts` 양쪽에 같이 넣는다. 한쪽만 고치면
 * 다음 부트스트랩에서 되돌아간다.
 *
 * 실행: npm run fix:stack          (미리보기)
 *       npm run fix:stack -- --apply
 */
loadEnvLocal()

type Fix = { number: number; why: string; before: string; after: string }

/*
 * 주소 공간 둘.
 *
 * `MemoryDiagram`은 **맨 위가 높은 주소**다. 그리고 빈 공간 점선은
 * `아래로` 바로 밑에 `위로`가 올 때만 생긴다(`Diagram.tsx`의 `facing`).
 * 저장된 순서 `코드 / 데이터 / 힙 / 스택`은 정확히 거꾸로라, 그대로 이름만
 * 바꾸면 코드가 높은 주소에 앉는다. **순서를 뒤집어야 맞다.**
 *
 * 스택이 아래로, 힙이 위로 자라고 그 사이가 비어 있다는 것이 이 그림의
 * 존재 이유다. 계층으로 그리면 그 사실이 통째로 사라진다.
 */
const FIXES: Fix[] = [
  {
    number: 166,
    why: '주소 공간. 위가 높은 주소이므로 순서를 뒤집고 자라는 방향을 붙인다',
    before: `:::stack
코드 | 프로그램 실행 파일의 기계어
데이터 | 전역 변수, 정적 변수
힙 | 런타임에 할당되는 동적 메모리
스택 | 지역 변수, 함수 호출 정보
:::`,
    after: `:::memory
스택 | 지역 변수, 함수 호출 정보 | 아래로
힙 | 런타임에 할당되는 동적 메모리 | 위로
데이터 | 전역 변수, 정적 변수
코드 | 프로그램 실행 파일의 기계어
:::`,
  },
  {
    number: 176,
    why: '같은 주소 공간. #166과 거의 같은 질문이다 (중복 정리 대상)',
    before: `:::stack
코드 | 정적 데이터
데이터 | 전역 변수, 정적 변수
힙 | 동적 할당 영역
스택 | 지역 변수, 함수 호출 정보
:::`,
    after: `:::memory
스택 | 지역 변수, 함수 호출 정보 | 아래로
힙 | 동적 할당 영역 | 위로
데이터 | 전역 변수, 정적 변수
코드 | 프로그램 실행 파일의 기계어
:::`,
  },
  /*
   * 이건 고장이다.
   *
   * 머리줄과 구분줄까지는 표인데 그 아래 네 줄에 파이프가 없다. `parseTable`이
   * 칸 수가 안 맞아 실패하고, `parseStack`이 구분줄만 버린 뒤 층으로 그린다.
   * 그래서 화면에 `2xx는 성공적인 처리`가 **설명 없는 층 이름**으로 나간다.
   *
   * 맨 마크다운 표로 되돌린다. 나머지 136편이 전부 그 모양이다.
   */
  {
    number: 179,
    why: '표인데 아래 네 줄에 파이프가 빠져 층으로 그려지고 있다',
    before: `:::stack
상태 코드 | 분류
--- | ---
1xx | 정보 제공
2xx는 성공적인 처리
3xx는 리다이렉션
4xx는 클라이언트 요청 오류
5xx는 서버 내부 오류
:::`,
    after: `| 상태 코드 | 분류 |
| --- | --- |
| 1xx | 정보 제공 |
| 2xx | 성공적인 처리 |
| 3xx | 리다이렉션 |
| 4xx | 클라이언트 요청 오류 |
| 5xx | 서버 내부 오류 |`,
  },
]

const GEN = 'data/generated-nodes.ts'
const BACKUP = 'docs/audit/_bodies-before-stack-fix.json'

/** 소스 파일에는 본문이 한 줄짜리 JSON 문자열로 들어 있다 */
function escaped(s: string): string {
  return s.replace(/\n/g, '\\n')
}

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.error('DATABASE_URL이 없다.')
    process.exit(1)
  }

  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
  const gen = readFileSync(GEN, 'utf8')

  const ok: Array<{ fix: Fix; id: string; question: string; body: string; next: string }> = []

  for (const fix of FIXES) {
    const r = await pool.query<{ id: string; question: string; body: string }>(
      `select id, normalized_question as question, coalesce(body,'') as body
         from qnode where number = $1`,
      [fix.number],
    )
    if (r.rows.length === 0) {
      console.error(`#${fix.number} 없다.`)
      process.exit(1)
    }
    const row = r.rows[0]

    const hits = row.body.split(fix.before).length - 1
    if (hits !== 1) {
      console.error(`#${fix.number} 원문이 ${hits}번 맞았다. 1이어야 한다. 중단.`)
      process.exit(1)
    }
    const next = row.body.replace(fix.before, fix.after)

    /* 바꾼 뒤 정말 그 종류로 읽히는지 파서에 물어본다 */
    const kinds = parseBlocks(next).map((b) => b.type)
    const want = fix.after.startsWith(':::memory') ? 'memory' : 'table'
    if (!kinds.includes(want as never)) {
      console.error(`#${fix.number} 바꿔도 ${want}로 안 읽힌다: ${kinds.join(',')}. 중단.`)
      process.exit(1)
    }

    console.log(`#${fix.number} ${row.question}`)
    console.log(`  ${fix.why}`)
    console.log(`  ${kinds.join(' · ')}`)
    ok.push({ fix, ...row, next })
  }

  if (!apply) {
    console.log('\n미리보기다. 실제로 쓰려면 --apply')
    await pool.end()
    return
  }

  mkdirSync('docs/audit', { recursive: true })
  let backup: Record<string, { question: string; body: string }> = {}
  try {
    backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  } catch {
    /* 처음이면 없다 */
  }

  let nextGen = gen
  for (const o of ok) {
    if (!backup[o.id]) backup[o.id] = { question: o.question, body: o.body }
    await pool.query(`update qnode set body = $1 where id = $2`, [o.next, o.id])

    /* 소스 파일에도 같이. 없으면 조용히 지나간다 -- 일일 발행분은 DB에만 있다 */
    const from = escaped(o.fix.before)
    if (nextGen.includes(from)) {
      nextGen = nextGen.replace(from, escaped(o.fix.after))
    } else {
      console.log(`  #${o.fix.number} 소스 파일에는 없다 (DB 전용)`)
    }
  }

  writeFileSync(BACKUP, JSON.stringify(backup, null, 2))
  if (nextGen !== gen) writeFileSync(GEN, nextGen)

  console.log(`\n${ok.length}편 적용. 되돌리려면 ${BACKUP}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
