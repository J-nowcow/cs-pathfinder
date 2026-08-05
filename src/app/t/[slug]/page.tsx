import Link from 'next/link'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import type { Metadata } from 'next'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadTreeBySlug, bumpTreeViews } from '@/lib/db/trees'
import { isValidSlug } from '@/lib/tree/slug'
import { OG_IMAGE_PATH } from '@/lib/site'
import { SharedTree } from '@/components/SharedTree'

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
  if (!tree) return { title: '없는 링크예요' }

  const description = tree.summary || `${tree.category} 질문 ${tree.nodes.length}개`

  // 이미지를 직접 넣어야 한다. generateMetadata가 openGraph를 반환하면 Next가
  // 파일 규약(app/opengraph-image.png)을 합쳐주지 않아서, 안 넣으면 하필
  // 공유 링크에만 썸네일이 빠진다. 절대 주소는 metadataBase가 펴준다
  const images = [OG_IMAGE_PATH]

  return {
    title: tree.title,
    description,
    openGraph: {
      title: tree.title,
      description,
      type: 'article',
      locale: 'ko_KR',
      images,
    },
    twitter: { card: 'summary_large_image', title: tree.title, description, images },
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

  const rootNodeId = tree.nodes.find((n) => n.parentOccurrenceId === null)?.nodeId ?? tree.rootNodeId

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-5 sm:px-8 sm:pt-8">
      <Link
        href="/"
        className="text-[13px] font-medium text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← 꼬리에 꼬리를 무는 CS 공부
      </Link>

      <header className="mt-6">
        <span className="text-[12px] font-medium text-faint">{tree.category}</span>
        <h1 className="mt-2 text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[30px] sm:leading-[1.32]">
          {tree.title}
        </h1>
        <p className="mt-2.5 font-mono text-[11px] text-faint">
          질문 {tree.nodes.length}개 · 조회 {tree.views}
        </p>
      </header>

      <div className="mt-8">
        <SharedTree nodes={tree.nodes} />
      </div>

      {/* 방문자가 구경만 하고 나가면 이 페이지는 스크린샷과 같다.
          누군가 판 자리에서 바로 이어 팔 수 있어야 유입이 사용으로 바뀐다 */}
      <section className="mt-12 rounded-lg border border-line bg-raised p-6 sm:p-7">
        <h2 className="text-[17px] font-semibold leading-[1.45] tracking-[-0.015em] text-ink">
          여기서부터는 직접 파보실래요?
        </h2>
        <p className="mt-2 text-[14px] leading-[1.7] text-muted">
          같은 질문에서 출발해도 어디로 갈지는 매번 달라요. 판 만큼 지도가 따로 그려지고요.
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href={`/q/${rootNodeId}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
