import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadTreeBySlug, bumpTreeViews } from '@/lib/db/trees'
import { isValidSlug } from '@/lib/tree/slug'
import { socialMeta } from '@/lib/site'
import { SharedTree } from '@/components/SharedTree'
import { VoteButton } from '@/components/VoteButton'
import { hasVoted } from '@/lib/db/votes'
import { VOTER_COOKIE, isVoterId, voterKey } from '@/lib/vote/identity'

/**
 * 공유 트리 상세.
 *
 * 이 페이지가 이 서비스의 유입구다. 카톡에 붙은 링크를 처음 보는 사람이 열고,
 * 여기서 자기 탐험을 시작할지 정한다. 그래서 두 가지가 중요하다.
 * 미리보기에 뜨는 OG 태그, 그리고 아래로 이어지는 진입점.
 *
 * 개인 데이터가 없다. 공개 캐시 대상이지만(§10) 조회수를 세려면 매 요청 실행돼야 한다.
 */
export const dynamic = 'force-dynamic'

async function load(slugParam: string) {
  // 형식이 틀린 건 존재할 수 없는 slug다. 봇이 주소를 훑을 때 DB까지 가지 않게 막는다
  if (!isValidSlug(slugParam)) return null
  await ensureSeeded()
  return loadTreeBySlug(slugParam)
}

/**
 * OG 태그는 장식이 아니라 유입 경로다.
 *
 * 카톡 미리보기에 제목과 요약이 안 뜨면 링크가 회색 상자로 보이고 아무도 안 누른다.
 * 요약은 공유한 사람이 실제로 판 경로라 무엇을 여는 링크인지가 한 줄에 드러난다.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tree = await load(slug)

  // 접미는 layout의 title template이 붙인다. 여기서 또 붙이면 두 번 나온다
  if (!tree) return { title: '없는 링크입니다' }

  const description = tree.summary || `${tree.category} 질문 ${tree.nodes.length}개`

  return {
    // title은 socialMeta가 준다. 여기서 또 적으면 두 곳이 갈릴 자리가 생긴다
    description,
    ...socialMeta({ title: tree.title, description, type: 'article' }),
  }
}

export default async function SharedTreePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tree = await load(slug)
  if (!tree) notFound()

  // 조회수는 응답을 보낸 뒤에 올린다. 화면을 그리는 길목에 쓰기를 끼우면
  // DB가 느린 날 그만큼 첫 화면이 늦어진다.
  //
  // 봇과 미리보기 크롤러도 세어진다. 인증이 없어 사람과 구분할 방법이 지금은 없고,
  // 조회수는 정렬에 쓰지 않아(인기 탭은 upvotes 기준) 부풀어도 순서를 흔들지 않는다.
  after(() => bumpTreeViews(slug))

  // 식별자가 없으면 아직 아무것도 안 누른 사람이다. 여기서 발급하지 않는다 —
  // 서버 컴포넌트는 쿠키를 못 쓰고, 안 누를 사람에게까지 식별자를 심을 이유도 없다.
  // 처음 누르는 순간 라우트 핸들러가 발급한다.
  const cookieId = (await cookies()).get(VOTER_COOKIE)?.value
  const voted = isVoterId(cookieId) ? await hasVoted(slug, voterKey(cookieId)) : false

  const rootNodeId = tree.nodes.find((n) => n.parentOccurrenceId === null)?.nodeId ?? tree.rootNodeId

  return (
    <main className="mx-auto max-w-3xl px-5 pb-4 pt-5 sm:px-8 sm:pt-8">
      {/*
        누르는 자리를 손끝 크기로 키운다.

        폰 390px에서 16px이었다. 이 화면에서 본문 영역의 유일한 출구인데
        가장 얇은 판정 영역이다. 위로는 아무것도 없고 아래로 413px이 비어 있어
        판정만 늘려도 겹칠 것이 없다.

        `py`를 키우고 같은 만큼 `-my`로 당기면 줄 높이는 안 변한다 —
        질문 화면의 `← 질문 목록`과 게시판 칩에 쓴 것과 같은 방식이다.
      */}
      <Link
        href="/"
        className="-my-[14px] py-[14px] text-[13px] font-medium text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← CS 길라잡이
      </Link>

      <header className="mt-6">
        <span className="text-[12px] font-medium text-faint">{tree.category}</span>
        <h1 className="mt-2 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[30px] sm:leading-[1.32]">
          {tree.title}
        </h1>
        <p className="mt-2.5 font-mono text-[11px] text-faint">
          질문 {tree.nodes.length}개 · 조회 {tree.views}
        </p>

        <div className="mt-4">
          <VoteButton slug={tree.slug} initialCount={tree.upvotes} initialVoted={voted} />
        </div>
      </header>

      <div className="mt-8">
        <SharedTree nodes={tree.nodes} />
      </div>

      {/* 방문자가 구경만 하고 나가면 이 페이지는 스크린샷과 같다.
          누군가 판 자리에서 바로 이어 팔 수 있어야 유입이 사용으로 바뀐다 */}
      <section className="mt-12 rounded-lg border border-line bg-raised p-6 sm:p-7">
        <h2 className="text-[17px] font-semibold leading-[1.45] tracking-[-0.015em] text-ink">
          여기서부터는 직접 파보시겠습니까?
        </h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-muted">
          같은 질문에서 출발해도 어디로 갈지는 매번 다릅니다. 파고든 만큼 지도가 따로 그려집니다.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href={`/q/${rootNodeId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            나도 여기서 파보기
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-line bg-raised px-5 py-3 text-[15px] font-medium text-ink transition-colors hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            다른 질문 보기
          </Link>
        </div>
      </section>
    </main>
  )
}
