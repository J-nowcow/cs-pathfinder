import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots, countRoots } from '@/lib/db/roots'
import { listTrees, BOARD_PAGE_SIZE } from '@/lib/db/trees'
import { getTodayTree } from '@/lib/daily/today'
import { RootCard } from '@/components/RootCard'
import { HeroBackdrop } from '@/components/HeroBackdrop'
import { TodayCard, type TodayFeature } from '@/components/TodayCard'
import Link from 'next/link'
import { Board } from '@/components/Board'

// PGlite가 인메모리라 매 요청 실제 DB를 읽는다. 정적 생성 대상이 아니다.
export const dynamic = 'force-dynamic'

/**
 * 홈.
 *
 * 위에서부터 히어로, 오늘의 질문, 게시판이다. 설계 §7의 순서 그대로다.
 *
 * 히어로에 있던 "오늘 치 질문" 버튼은 뺐다. 바로 아래 주인공 카드가 같은 자리로
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

  const [{ feature, roots }, board, total] = await Promise.all([
    loadFeature(),
    listTrees({ sort: 'popular', limit: BOARD_PAGE_SIZE }),
    countRoots(),
  ])

  // 주인공 카드가 이미 맡은 질문은 목록에서 뺀다. 같은 화면에 두 번 나오면
  // 목록이 아니라 중복으로 읽힌다
  const rest = roots.filter((r) => r.id !== feature?.nodeId)

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <header className="relative mb-10 overflow-hidden sm:mb-12">
        <HeroBackdrop />
        <h1 className="relative text-[30px] font-extrabold leading-[1.32] tracking-[-0.025em] sm:text-[34px]">
          꼬리에 꼬리를 무는
          <br />
          CS 공부
        </h1>
        <p className="relative mt-4 max-w-lg text-[15px] leading-[1.72] text-muted">
          하루에 질문 하나. 어디로 파고들지는 직접 고르면 돼요.
          <br />
          판 만큼 지도가 그려지고요.
        </p>
      </header>

      {feature ? (
        <TodayCard feature={feature} />
      ) : (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 올라온 질문이 없어요.</p>
          <p className="mt-2 text-[13px] text-faint">서버를 다시 켜면 예시 질문이 채워져요.</p>
        </div>
      )}


      <section className="mt-14">
        <Board initial={board} />
      </section>

      {rest.length > 0 && (
        <section className="mt-14">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-medium text-faint">지난 질문 {total}개</h2>
            <Link href="/questions" className="text-[13px] text-accent hover:underline">
              카테고리별로 보기 →
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
              className="mt-3 block rounded-lg border border-line px-4 py-3 text-center text-[13px] text-muted transition-colors hover:border-accent hover:text-ink"
            >
              나머지 {total - FIRST_PAINT}개 보기 →
            </Link>
          )}
        </section>
      )}
    </main>
  )
}
