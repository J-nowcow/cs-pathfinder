import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { CATEGORIES } from '@/lib/tree/categories'
import { socialMeta } from '@/lib/site'

// 매 요청 실제 DB를 읽는다. 발행이 하나 늘면 여기도 같이 늘어야 한다
export const dynamic = 'force-dynamic'

export const metadata: Metadata = socialMeta({
  title: '카테고리별 질문 — 꼬리에 꼬리를 무는 CS 공부',
  description: '지금까지 올라온 CS 질문을 카테고리로 묶어서 본다.',
})

/**
 * 카테고리별 질문 모아보기.
 *
 * 홈의 "지난 질문"은 올라온 순서대로 늘어놓는다. 무엇이 있는지 훑기에는 맞지만
 * "DB 쪽만 보고 싶다"에는 안 맞는다. 게시판에 카테고리 필터가 있긴 한데 그쪽은
 * 사람이 공유한 트리만 담아서, 카테고리를 고르면 위에는 질문이 보이는데 여기는
 * 비었다고 나온다. 같은 화면이 두 가지 다른 말을 한다.
 *
 * 그래서 질문 전체를 카테고리로 묶는 자리를 따로 뒀다. 필터가 아니라 목차다.
 */
export default async function QuestionsPage() {
  await ensureSeeded()
  const roots = await listRoots()

  // CATEGORIES 순서를 따른다. 개수순으로 세우면 발행 하나에 순서가 흔들려서
  // 어제 봤던 자리에 오늘 다른 게 있다
  const grouped = CATEGORIES.map((category) => ({
    category,
    items: roots.filter((r) => r.category === category),
  })).filter((g) => g.items.length > 0)

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <Link href="/" className="text-[13px] text-faint hover:text-ink">
        ← 꼬리에 꼬리를 무는 CS 공부
      </Link>

      <h1 className="mt-6 text-[26px] font-extrabold leading-[1.35] tracking-[-0.02em] sm:text-[30px]">
        카테고리별 질문
      </h1>
      <p className="mt-3 text-[15px] leading-[1.72] text-muted">
        지금까지 올라온 질문 {roots.length}개. 궁금한 쪽부터 파고들면 돼요.
      </p>

      {/*
        목차를 위에 둔다. 카테고리가 열 개라 폰에서는 스크롤이 길다.
        앵커 링크라 자바스크립트가 필요 없다.
      */}
      <nav className="mt-8 flex flex-wrap gap-2">
        {grouped.map((g) => (
          <a
            key={g.category}
            href={`#${slugOf(g.category)}`}
            className="rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-ink"
          >
            {g.category} {g.items.length}
          </a>
        ))}
      </nav>

      {grouped.map((g) => (
        <section key={g.category} id={slugOf(g.category)} className="mt-12 scroll-mt-6">
          <h2 className="mb-4 flex items-baseline gap-2 border-b border-line pb-2">
            <span className="text-[17px] font-bold tracking-[-0.01em]">{g.category}</span>
            <span className="text-[13px] text-faint">{g.items.length}개</span>
          </h2>

          {/*
            목차라서 제목만 세운다.
            카드로 그리면 발췌까지 실려 한 줄이 300px가 되고, 마흔여덟 개면
            폰에서 열여섯 화면이 넘는다. 접어봐야 카테고리당 하나씩만 접혀서
            줄지도 않는다. 여기서 하는 일은 훑기지 읽기가 아니다.
          */}
          <ul className="divide-y divide-line border-y border-line">
            {g.items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/q/${r.id}`}
                  className="group flex items-center gap-3 py-3 transition-colors hover:text-accent"
                >
                  <span className="flex-1 text-[15px] leading-[1.6]">{r.question}</span>
                  <span
                    aria-hidden
                    className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {grouped.length === 0 && (
        <div className="mt-12 rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 올라온 질문이 없어요.</p>
        </div>
      )}
    </main>
  )
}

/**
 * 앵커용 id.
 *
 * 카테고리 이름에 공백과 가운뎃점이 있어서 그대로 쓰면 CSS 선택자와 URL 양쪽에서
 * 깨진다. 한글은 그대로 둔다 — 브라우저가 인코딩해 주고, 링크를 눌러본 사람이
 * 주소창에서 어디인지 알아볼 수 있다.
 */
function slugOf(category: string): string {
  return `c-${category.replace(/\s*·\s*/g, '-').replace(/\s+/g, '-')}`
}
