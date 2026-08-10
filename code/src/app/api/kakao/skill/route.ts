import { ensureSeeded } from '@/lib/db/bootstrap'
import { getDb } from '@/lib/db/client'
import { getTodayTree } from '@/lib/daily/today'
import { embedQuestions } from '@/lib/embed/gemini'

/**
 * 카카오톡 채널 질의응답 봇의 스킬 서버 (오픈빌더가 여기를 부른다).
 *
 * 응답형이다 — 채널 친구가 봇에게 말을 걸면 카카오가 이 라우트를 호출하고,
 * 우리는 카카오 2.0 규격 JSON으로 답한다. 먼저 보내는 푸시(알림톡)는
 * 사업자 영역이라 여기 없다.
 *
 * **언제나 200으로 답한다.** 오픈빌더는 200이 아니면 "스킬 실패" 오류
 * 블록을 사용자에게 보여준다. 임베딩이 죽어도, 발화가 비어도, 실패를
 * 말로 전한다.
 *
 * 인증이 없다 — 오픈빌더 스킬 호출에는 서명이 없다. 반환하는 것이 전부
 * 공개 데이터(발행된 질문·해설)라 위험이 낮고, 임베딩 호출이 유일한
 * 비용이라 발화 길이를 자른다.
 */
export const dynamic = 'force-dynamic'

const SITE = 'https://cs-pathfinder.vercel.app'

/**
 * 검색 채택 문턱. 매칭(0.85)은 "같은 질문"의 기준이고 여기는 "관련
 * 질문"이면 충분하다. gemini 분포(중앙값 0.722)에서 0.55 밑은 사실상
 * 무관한 쌍이다 — 낮춰도 엉뚱한 답만 늘어난다.
 */
const SEARCH_MIN_SIMILARITY = 0.55
const SEARCH_TOP_K = 3

function kakaoText(text: string): Response {
  return new Response(
    JSON.stringify({
      version: '2.0',
      template: {
        // simpleText는 1000자 제한 — 넘치면 카카오가 거부한다
        outputs: [{ simpleText: { text: text.slice(0, 990) } }],
        /*
         * 모든 응답 아래에 붙는 바로가기 버튼. 누르면 그 문구를 발화로
         * 보내고, 폴백 블록이 이 스킬로 돌려보낸다 — 오픈빌더에 발화
         * 블록을 따로 만들 필요가 없다.
         */
        quickReplies: [
          { label: '오늘의 질문', action: 'message', messageText: '오늘의 질문' },
          { label: '질문 목록 보기', action: 'message', messageText: '질문 목록' },
        ],
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

export async function POST(request: Request): Promise<Response> {
  await ensureSeeded()

  let utterance = ''
  try {
    const body = (await request.json()) as { userRequest?: { utterance?: string } }
    utterance = (body.userRequest?.utterance ?? '').trim().slice(0, 200)
  } catch {
    /* 빈 발화로 진행 — 아래 도움말이 답한다 */
  }

  if (!utterance || utterance === '도움말') {
    return kakaoText(
      `CS 길라잡이 봇입니다.\n"오늘의 질문"이라고 보내면 오늘 발행된 질문을, CS 궁금증을 보내면 비슷한 질문의 해설을 찾아 드립니다.\n\n전체 질문 목록: ${SITE}/questions`,
    )
  }

  // 바로가기 버튼("질문 목록 보기")이 보내는 발화 — 라벨과 찍히는 말이 같아야 어색하지 않다
  if (utterance === '질문 목록') {
    return kakaoText(
      `전체 질문 목록입니다.\n${SITE}/questions\n\n분야·태그·난이도로 걸러볼 수 있습니다.`,
    )
  }

  if (utterance.includes('오늘')) {
    return todayAnswer()
  }
  return searchAnswer(utterance)
}

async function todayAnswer(): Promise<Response> {
  const tree = await getTodayTree()
  if (!tree) {
    return kakaoText(`오늘의 질문이 아직 발행되지 않았습니다.\n${SITE} 에서 지난 질문을 볼 수 있습니다.`)
  }
  const label = tree.isToday ? '오늘의 질문' : '가장 최근 질문'
  return kakaoText(
    `${label} — ${tree.root.question}\n\n${firstParagraph(tree.root.body)}\n\n이어서 파기: ${SITE}/q/${tree.root.number}`,
  )
}

async function searchAnswer(utterance: string): Promise<Response> {
  let vec: number[]
  try {
    ;[vec] = await embedQuestions([utterance])
  } catch {
    /* 한도(429)든 키 부재든 — 봇이 죽는 것보다 안내가 낫다 */
    return kakaoText(`지금은 검색이 어렵습니다. 잠시 뒤 다시 시도해 주세요.\n${SITE} 에서 직접 찾아볼 수도 있습니다.`)
  }

  const db = await getDb()
  let rows: Array<{ number: number; question: string; body: string; sim: number }> = []
  try {
    rows = await db.query<{ number: number; question: string; body: string; sim: number }>(
      /* 차원은 쿼리 벡터 길이에서 — 저장된 임베딩과 같은 모델이 만든 값이다 */
      `select n.number, n.normalized_question as question, n.body,
              1 - (n.embedding::vector(${vec.length}) <=> $1::vector(${vec.length})) as sim
         from qnode n
        where n.status = 'ready'
          and n.number is not null
          and n.embedding is not null
          and 1 - (n.embedding::vector(${vec.length}) <=> $1::vector(${vec.length})) >= $2
        order by n.embedding::vector(${vec.length}) <=> $1::vector(${vec.length})
        limit ${SEARCH_TOP_K}`,
      [`[${vec.join(',')}]`, SEARCH_MIN_SIMILARITY],
    )
  } catch {
    /* 벡터 확장이 없는 환경 — 검색 없이 안내 */
  }

  if (rows.length === 0) {
    return kakaoText(
      `비슷한 질문을 찾지 못했습니다.\n${SITE}/questions 에서 전체 목록을 볼 수 있습니다.`,
    )
  }

  const [top, ...rest] = rows
  const lines = [
    `가장 가까운 질문 — ${top.question}`,
    '',
    firstParagraph(top.body),
    '',
    `자세히: ${SITE}/q/${top.number}`,
  ]
  if (rest.length > 0) {
    lines.push('', '이것도 비슷합니다:')
    for (const r of rest) lines.push(`· ${r.question} — ${SITE}/q/${r.number}`)
  }
  return kakaoText(lines.join('\n'))
}

/** 해설 첫 문단만. 도식 펜스(:::)는 봇에서 읽을 수 없으니 건너뛴다 */
function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim()
    if (t && !t.startsWith(':::')) return t.slice(0, 300)
  }
  return ''
}
