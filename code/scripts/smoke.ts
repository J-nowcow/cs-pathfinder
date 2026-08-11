/**
 * 배포 뒤 프로덕션을 한 번에 훑는다.
 *
 * 원형은 C7 익명 실측(2026-08-10 01:30)이다. 공개 화면·API를 무인증으로
 * 하나씩 눌러 200을 확인하고, 401은 CRON 내부 API 하나뿐인 것을 봤다.
 * `auth-data-decision.md`가 그 목록을 **익명 회귀 가드의 기준선**으로
 * 박아 뒀다 — 로그인을 붙인 뒤 같은 목록을 같은 방식으로 다시 재서
 * 하나라도 401이나 리다이렉트로 바뀌면 되돌린다는 계약이다.
 *
 * 손으로 재는 기준선은 재지 않게 된다. 그래서 명령 하나로 만든다.
 *
 * **HTTPS만 쓴다.** DB에 붙지 않는다 — 사내망처럼 5432가 막힌 곳에서도
 * 돌아야 하고, 스모크가 봐야 하는 것은 "배포된 것이 밖에서 어떻게
 * 보이는가"이지 데이터의 내부 상태가 아니다.
 *
 * 각 항목이 잡는 회귀:
 *
 * 1. **공개 표면 200** — 익명 회귀 가드 본체. 로그인·미들웨어·인증 훅을
 *    건드린 배포가 공개 화면을 조용히 401이나 로그인 리다이렉트로
 *    바꾸는 것을 잡는다. README의 "가입 없이"가 계약이다.
 * 2. **인증 게이트 401** — 반대 방향의 사고. 개인 기록(여정·잔디)을
 *    무인증에 열어 버린 배포를 잡는다. 1번만 있으면 "다 열면 통과"라
 *    가드가 아니라 압력이 된다.
 * 3. **CRON 401** — `/api/catalog`는 CRON_SECRET으로 잠겨 있다. 이게
 *    열리면 발행 워크플로의 열쇠가 무의미해진다.
 * 4. **카톡 스킬 규격** — 오픈빌더는 200이 아니거나 규격이 어긋나면
 *    사용자에게 "스킬 실패"를 보여준다. 라우트가 언제나 200을 내도록
 *    짜여 있으니, 상태코드만 보면 안 되고 본문 모양까지 봐야 한다.
 *    quickReplies 2개는 바로가기 버튼이 사라진 것을 잡는다.
 * 5. **콘텐츠 신호** — 렌더가 200이어도 내용이 빌 수 있다. `/questions`의
 *    필터 줄(난이도·태그)은 목록 화면이 실제로 그려졌다는 표시다.
 *    홈의 "지도가 남습니다"는 합니다체 회귀 감지용이다 — 문구가 바뀌면
 *    누군가 톤을 손댔다는 뜻이니 사람이 봐야 한다.
 * 6. **관련 질문** — `/api/node/{id}`의 `related`가 배열인지 본다. 빈
 *    배열은 통과다. 여기서 보는 것은 추천의 품질이 아니라 필드가
 *    배포됐는가다.
 *
 * 실행: npm run smoke
 *       npm run smoke -- --base https://<프리뷰>.vercel.app
 */

const DEFAULT_BASE = 'https://cs-pathfinder.vercel.app'

/** 콜드 스타트가 있는 라우트가 있어 넉넉히 준다. 그래도 매달리진 않게 */
const TIMEOUT_MS = 10_000

type Result = { name: string; ok: boolean; detail: string }

const results: Result[] = []

function parseBase(argv: string[]): string {
  const i = argv.indexOf('--base')
  if (i === -1) return DEFAULT_BASE
  const v = argv[i + 1]
  if (!v || v.startsWith('--')) {
    console.error('--base 뒤에 주소가 없다.')
    process.exit(2)
  }
  return v.replace(/\/+$/, '')
}

const BASE = parseBase(process.argv.slice(2))

/**
 * 타임아웃이 붙은 fetch. 죽은 배포를 만나면 응답이 안 오는 게 아니라
 * 영영 안 온다 — 그때 스모크가 같이 매달리면 CI가 멈춘다.
 */
async function req(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal, redirect: 'manual' })
  } catch (e) {
    /* 네트워크 예외도 검사 실패다. 던져서 위에서 FAIL로 받게 한다 */
    const why = e instanceof Error ? e.message : String(e)
    throw new Error(`요청 실패: ${why}`)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 검사 하나. 통과하면 한 줄 요약을 돌려주고, 실패는 던진다.
 * 던진 것은 전부 FAIL로 받는다 — 예외로 스크립트가 끝나는 경로를 없앤다.
 */
async function check(name: string, fn: () => Promise<string>): Promise<void> {
  let result: Result
  try {
    result = { name, ok: true, detail: await fn() }
  } catch (e) {
    result = { name, ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
  results.push(result)
  const tag = result.ok ? 'PASS' : 'FAIL'
  console.log(`${tag}  ${name.padEnd(34)}${result.detail}`)
}

function expectStatus(res: Response, want: number): void {
  if (res.status !== want) throw new Error(`${res.status} (기대 ${want})`)
}

/** 본문을 JSON으로. 규격 검사에서 파싱 실패와 모양 불일치를 같이 다룬다 */
async function asJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`JSON이 아니다: ${text.slice(0, 80)}`)
  }
}

/* 공개 화면. 무인증 200이 계약이다 */
const PUBLIC_PAGES = ['/', '/questions', '/map', '/me', '/glossary', '/terms', '/privacy']

async function main(): Promise<void> {
  console.log(`\n=== 프로덕션 스모크 — ${BASE} ===\n`)

  console.log('--- 1. 익명 공개 표면 (200) ---')
  for (const path of PUBLIC_PAGES) {
    await check(`GET ${path}`, async () => {
      const res = await req(path)
      expectStatus(res, 200)
      return '200'
    })
  }

  /*
   * 노드 조회는 루트 목록에서 아이디를 받아 온다. 아이디를 여기 박으면
   * 재시드 한 번에 스모크가 통째로 거짓 실패한다.
   */
  let nodeId: string | null = null
  await check('GET /api/roots', async () => {
    const res = await req('/api/roots')
    expectStatus(res, 200)
    const body = await asJson(res)
    const roots = body.roots
    if (!Array.isArray(roots) || roots.length === 0) throw new Error('roots가 비었다')
    const first = roots[0] as { id?: unknown }
    if (typeof first.id !== 'string') throw new Error('첫 노드에 id가 없다')
    nodeId = first.id
    return `200 · ${roots.length}개`
  })

  await check('GET /api/node/{id}', async () => {
    if (!nodeId) throw new Error('루트 조회가 실패해 아이디를 못 얻었다')
    const res = await req(`/api/node/${nodeId}`)
    expectStatus(res, 200)
    const body = await asJson(res)
    if (typeof body.question !== 'string') throw new Error('question이 없다')
    return '200'
  })

  console.log('\n--- 2. 인증 게이트 (401) ---')
  await check('GET /api/journey', async () => {
    const res = await req('/api/journey')
    expectStatus(res, 401)
    return '401'
  })

  /*
   * 빈 body 대신 스키마를 통과하는 최소 본문을 보낸다. 빈 body는 zod가
   * 400으로 먼저 쳐내서 인증 게이트가 도는지를 못 본다 — 400이 나와도
   * 게이트가 열려 있는지 닫혀 있는지 알 수 없다.
   */
  await check('POST /api/journey/merge', async () => {
    const res = await req('/api/journey/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ occurrences: [], current_id: null }),
    })
    expectStatus(res, 401)
    return '401'
  })

  await check('POST /api/streak/merge', async () => {
    const res = await req('/api/streak/merge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: {} }),
    })
    expectStatus(res, 401)
    return '401'
  })

  console.log('\n--- 3. CRON 보호 (401) ---')
  await check('GET /api/catalog', async () => {
    const res = await req('/api/catalog')
    expectStatus(res, 401)
    return '401'
  })

  console.log('\n--- 4. 카카오 스킬 규격 ---')
  await check('POST /api/kakao/skill', async () => {
    const res = await req('/api/kakao/skill', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userRequest: { utterance: '오늘의 질문' } }),
    })
    expectStatus(res, 200)
    const body = await asJson(res)
    if (body.version !== '2.0') throw new Error(`version=${String(body.version)} (기대 2.0)`)

    const template = body.template as { outputs?: unknown; quickReplies?: unknown } | undefined
    const outputs = template?.outputs
    if (!Array.isArray(outputs) || outputs.length === 0) throw new Error('outputs가 비었다')
    const text = (outputs[0] as { simpleText?: { text?: unknown } }).simpleText?.text
    if (typeof text !== 'string' || text.length === 0) throw new Error('simpleText가 없다')

    const quick = template?.quickReplies
    if (!Array.isArray(quick)) throw new Error('quickReplies가 없다')
    if (quick.length !== 2) throw new Error(`quickReplies ${quick.length}개 (기대 2)`)

    return `200 · ${text.length}자 · 바로가기 2개`
  })

  /*
   * 노드 챗 배선. 성공 호출은 안 쏜다 — 스모크가 돌 때마다 모델을 부르고
   * 익명 쿼터를 깎으면 감시가 비용이 된다. 모양이 어긋난 body에 400을
   * 돌려주는 것으로 라우트가 배포되어 zod가 지키고 있음을 확인한다.
   */
  await check('POST /api/chat (스키마 가드)', async () => {
    const res = await req('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ node_id: 'not-a-uuid', text: '' }),
    })
    expectStatus(res, 400)
    return '400 (invalid_body)'
  })

  console.log('\n--- 5. 콘텐츠 신호 ---')
  await check('/questions 필터 줄', async () => {
    const res = await req('/questions')
    expectStatus(res, 200)
    const html = await res.text()
    const missing = ['난이도', '태그'].filter((w) => !html.includes(w))
    if (missing.length > 0) throw new Error(`빠짐: ${missing.join(', ')}`)
    return '난이도·태그 있음'
  })

  await check('/ 문구 (합니다체 회귀)', async () => {
    const res = await req('/')
    expectStatus(res, 200)
    const html = await res.text()
    if (!html.includes('지도가 남습니다')) throw new Error('"지도가 남습니다"가 없다')
    return '있음'
  })

  console.log('\n--- 6. 관련 질문 ---')
  await check('/api/node/{id} related', async () => {
    if (!nodeId) throw new Error('루트 조회가 실패해 아이디를 못 얻었다')
    const res = await req(`/api/node/${nodeId}`)
    expectStatus(res, 200)
    const body = await asJson(res)
    if (!Array.isArray(body.related)) throw new Error(`related가 배열이 아니다 (${typeof body.related})`)
    return `배열 · ${body.related.length}개`
  })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n=== ${results.length - failed.length}/${results.length} 통과 ===`)
  if (failed.length > 0) {
    console.log('\n실패:')
    for (const f of failed) console.log(`  · ${f.name} — ${f.detail}`)
    console.log('')
    process.exit(1)
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
