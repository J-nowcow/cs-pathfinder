import { ensureSeeded } from '@/lib/db/bootstrap'
import { webSiteJsonLd, serializeJsonLd } from '@/lib/seo/jsonld'
import { siteUrl } from '@/lib/site'
import { listRoots, countRoots, listRootsByQuestions } from '@/lib/db/roots'
import { listTrees, BOARD_PAGE_SIZE } from '@/lib/db/trees'
import { getTodayTree } from '@/lib/daily/today'
import { RootCard } from '@/components/RootCard'
import { HeroBackdrop } from '@/components/HeroBackdrop'
import { TodayCard, type TodayFeature } from '@/components/TodayCard'
import Link from 'next/link'
import { Board } from '@/components/Board'
import { ResumeLine } from '@/components/ResumeLine'
import { DailyLearningCard } from '@/components/DailyLearningCard'
import { BACKEND_INTERVIEW_30 } from '../../../data/learning-tracks'
import { resolveTrackQuestions } from '@/lib/learning/tracks'

// PGlite가 인메모리라 매 요청 실제 DB를 읽는다. 정적 생성 대상이 아니다.
export const dynamic = 'force-dynamic'

/**
 * 홈.
 *
 * 위에서부터 히어로, 오늘의 질문, 게시판이다. 설계 §7의 순서 그대로다.
 *
 * 히어로에 있던 "오늘의 질문" 버튼은 뺐다. 바로 아래 주인공 카드가 같은 자리로
 * 보내는데 버튼을 남기면 같은 것을 두 번 권하게 된다. 카드가 질문 문장과 해설 첫
 * 줄까지 보여주므로 버튼보다 나은 CTA이기도 하다.
 */

/**
 * 매일 발행이 아직 없을 때의 대비.
 *
 * getTodayTree는 발행분이 하나도 없으면 null을 준다. 그때 홈의 주인공 자리가
 * 비면 서비스가 통째로 비어 보이므로 예시 루트의 첫 질문이 그 자리를 맡는다.
 * `isToday: false`라 화면은 "가장 최근 질문"이라고 부른다. 없는 발행을 있는 척하지 않는다.
 */
async function loadFeature(): Promise<{ feature: TodayFeature | null; roots: Awaited<ReturnType<typeof listRoots>> }> {
  const [today, roots] = await Promise.all([getTodayTree(), listRoots({ limit: FIRST_PAINT + 1 })])

  if (today) {
    return {
      roots,
      feature: {
        nodeId: today.root.id,
        question: today.root.question,
        category: today.category,
        excerpt: today.root.body.split('\n\n')[0] ?? '',
        isToday: today.isToday,
        treeSlug: today.slug,
      },
    }
  }

  const [first] = roots
  if (!first) return { feature: null, roots }

  return {
    roots,
    feature: {
      nodeId: first.id,
      question: first.question,
      category: first.category,
      excerpt: first.excerpt,
      isToday: false,
      treeSlug: null,
    },
  }
}

/**
 * 지난 질문 중 처음에 펼쳐 보여줄 개수.
 *
 * 예시가 서른 개라 다 펼치면 폰에서 마흔 화면이 넘는다. 그 아래 게시판이
 * 있어서 안 접으면 게시판까지 내려가는 사람이 없다.
 */
const FIRST_PAINT = 12

export default async function HomePage() {
  await ensureSeeded()

  const [{ feature, roots }, board, total, trackRoots] = await Promise.all([
    loadFeature(),
    listTrees({ sort: 'popular', limit: BOARD_PAGE_SIZE }),
    countRoots(),
    listRootsByQuestions(BACKEND_INTERVIEW_30.questionKeys),
  ])
  const trackQuestions = resolveTrackQuestions(BACKEND_INTERVIEW_30, trackRoots)

  // 주인공 카드가 이미 맡은 질문은 목록에서 뺀다. 같은 화면에 두 번 나오면
  // 목록이 아니라 중복으로 읽힌다
  const rest = roots.filter((r) => r.id !== feature?.nodeId)

  const jsonLd = webSiteJsonLd({
    name: 'CS 길라잡이',
    url: siteUrl().origin,
    description: '하루에 질문 하나. 꼬리에 꼬리를 무는 CS 면접 공부.',
  })

  return (
    <main className="mx-auto max-w-3xl px-5 pb-4 pt-10 sm:px-8 sm:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="relative mb-10 overflow-hidden sm:mb-12">
        <HeroBackdrop />
        <h1 className="relative text-[30px] font-extrabold leading-[1.32] tracking-[-0.025em] sm:text-[34px]">
          CS 면접 공부,
          <br />
          오늘 질문부터
        </h1>
        <p className="relative mt-4 max-w-lg text-[15px] leading-[1.72] text-muted">
          먼저 답을 떠올려 보고, 막힌 개념은 용어와 꼬리질문으로 이어서 공부하세요.
          읽은 길은 내 질문 지도에 남습니다.
        </p>
        <nav aria-label="학습 시작 방법" className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <Link
            href="/glossary"
            className="-my-2 inline-flex min-h-11 items-center rounded-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            키워드로 질문 찾기 →
          </Link>
          <Link
            href="/me#resume-questions"
            className="-my-2 inline-flex min-h-11 items-center rounded-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            레쥬메에서 질문 만들기 →
          </Link>
        </nav>
      </header>

      {/*
        파던 자리로 돌아가는 줄. 두 칸 넘게 판 사람에게만 보인다.
        `localStorage`를 읽으므로 붙은 뒤에 나타난다 — 그래서 오늘 카드 위에
        둔다. 아래에 두면 나중에 끼어들며 카드를 밀어낸다.
      */}
      <ResumeLine />

      <DailyLearningCard track={BACKEND_INTERVIEW_30} questions={trackQuestions} />

      {feature ? (
        <div className="mt-12">
          <TodayCard feature={feature} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 올라온 질문이 없습니다.</p>
          <p className="mt-2 text-[13px] text-faint">질문을 준비하고 있습니다. 잠시 후 다시 열어 주세요.</p>
        </div>
      )}


      <section className="mt-14">
        <Board initial={board} />
      </section>

      {rest.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-medium text-faint">지난 질문 {total}개</h2>
            {/* 폰에서 20px이었다. 보이는 글자는 그대로 두고 누르는 자리만 44px로 */}
            <Link
              href="/questions"
              className="-my-[13px] inline-block rounded-md py-[13px] text-[13px] text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              질문 목록 보기 →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {rest.slice(0, FIRST_PAINT).map((r) => (
              <RootCard key={r.id} root={r} />
            ))}
          </div>

          {/*
            나머지는 여기 안 싣는다.

            접어두기만 했을 때는 249개가 전부 문서에 남아 홈이 447KB였다.
            유입이 카톡 링크라 첫 방문 대부분이 폰인데, 오늘 질문 하나 보려고
            그만큼을 받는다.

            전체 목록은 /questions가 맡는다. 홈은 최근 열두 개까지만 보여주고
            나머지는 그쪽으로 보낸다.
          */}
          {total > FIRST_PAINT && (
            <Link
              href="/questions"
              className="mt-3 block rounded-lg border border-line px-4 py-3 text-center text-[13px] text-muted transition-colors hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              나머지 {total - FIRST_PAINT}개 보기 →
            </Link>
          )}
        </section>
      )}
    </main>
  )
}
