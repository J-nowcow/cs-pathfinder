import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { CATEGORIES, categoryAnchor } from '@/lib/tree/categories'
import { socialMeta } from '@/lib/site'
import { TAGS, TAG_NAMES } from '../../../../data/tags'
import { LEVELS, LEVEL_NAMES } from '../../../../data/levels'
import {
  MAX_CATALOG_QUERY,
  catalogTagCounts,
  matchesCatalogQuery,
  normalizeCatalogQuery,
} from '@/lib/catalog/search'

// 매 요청 실제 DB를 읽는다. 발행이 하나 늘면 여기도 같이 늘어야 한다
export const dynamic = 'force-dynamic'

export const metadata: Metadata = socialMeta({
  title: '질문 목록',
  description: '지금까지 올라온 CS 질문을 검색하고 분야·태그·난이도로 골라 봅니다.',
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
export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; level?: string; q?: string }>
}) {
  await ensureSeeded()
  const roots = await listRoots()

  /*
   * 태그·난이도 필터는 주소로 건다(`?tag=동시성&level=심화`).
   *
   * 서버 컴포넌트 그대로라 JS가 안 늘고, 필터된 목록이 곧 공유 가능한
   * 주소가 된다. 통제 어휘 밖의 값은 조용히 무시한다 — 주소는 크롤러와
   * 옛 링크가 온갖 것을 들고 오는 자리다. 두 축은 AND다 — "동시성이면서
   * 심화"를 고르는 것이 조합의 뜻이다.
   */
  const { tag, level, q } = await searchParams
  const activeTag = tag && TAG_NAMES.has(tag) ? tag : null
  const activeLevel = level && LEVEL_NAMES.has(level) ? level : null
  const query = normalizeCatalogQuery(q)
  const searchMatches = roots.filter((r) => matchesCatalogQuery(r, query))
  const filtered = searchMatches.filter(
    (r) =>
      (!activeTag || r.tags.includes(activeTag)) &&
      (!activeLevel || r.level === activeLevel),
  )

  /** 지금 고른 필터를 유지한 채 한 축만 바꾼 주소 */
  const href = (t: string | null, l: string | null, search = query) => {
    const q = new URLSearchParams()
    if (search) q.set('q', search)
    if (t) q.set('tag', t)
    if (l) q.set('level', l)
    const s = q.toString()
    return s ? `/questions?${s}` : '/questions'
  }

  /* 개수 0인 태그는 필터 줄에 안 세운다. 눌러 봐야 빈 화면이다 */
  const tagCounts = catalogTagCounts(searchMatches)

  // CATEGORIES 순서를 따른다. 개수순으로 세우면 발행 하나에 순서가 흔들려서
  // 어제 봤던 자리에 오늘 다른 게 있다
  const grouped = CATEGORIES.map((category) => ({
    category,
    items: filtered.filter((r) => r.category === category),
  })).filter((g) => g.items.length > 0)

  /* 보이는 크기는 유지하고 가상 요소로 위아래 판정 영역만 넓힌다. */
  const filterChip = "relative rounded-full border px-3 py-1.5 text-[13px] transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"

  return (
    <main className="mx-auto max-w-3xl px-5 pb-4 pt-10 sm:px-8 sm:pt-16">
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
        className="-my-[14px] py-[14px] text-[13px] text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ← CS 길라잡이
      </Link>

      <h1 className="mt-6 text-[26px] font-extrabold leading-[1.35] tracking-[-0.02em] sm:text-[30px]">
        질문 목록
      </h1>
      <p className="mt-3 text-[15px] leading-[1.72] text-muted">
        {query || activeTag || activeLevel ? (
          <>
            {query && <strong className="text-ink">&lsquo;{query}&rsquo;</strong>}
            {query && (activeTag || activeLevel) && ' · '}
            {activeTag && <strong className="text-ink">{activeTag}</strong>}
            {activeTag && activeLevel && ' · '}
            {activeLevel && <strong className="text-ink">{activeLevel}</strong>} 질문{' '}
            {filtered.length}개입니다.
          </>
        ) : (
          <>지금까지 올라온 질문 {roots.length}개. 궁금한 쪽부터 파고들면 됩니다.</>
        )}
      </p>

      <form action="/questions" method="get" className="mt-5 flex gap-2" role="search">
        {activeTag && <input type="hidden" name="tag" value={activeTag} />}
        {activeLevel && <input type="hidden" name="level" value={activeLevel} />}
        <label htmlFor="question-search" className="sr-only">
          질문 검색
        </label>
        <input
          id="question-search"
          type="search"
          name="q"
          defaultValue={query}
          maxLength={MAX_CATALOG_QUERY}
          placeholder="질문이나 기술 키워드로 찾기"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-lg bg-accent px-4 text-[14px] font-medium text-on-accent hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          검색
        </button>
        {query && (
          <Link
            href={href(activeTag, activeLevel, '')}
            className="inline-flex min-h-11 items-center rounded-md px-2 text-[13px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            지우기
          </Link>
        )}
      </form>

      {/*
        태그 필터. 분야(아래 sticky 목차)와 다른 축이다 — 분야는 소속,
        태그는 주제. "운영체제이면서 동시성"을 분야 목차는 못 가르고
        여기가 가른다. 개수 0인 태그는 안 세운다.
      */}
      <nav aria-label="태그" className="mt-5 flex flex-wrap gap-2">
        <Link
          href={href(null, activeLevel)}
          aria-current={!activeTag ? 'true' : undefined}
          className={`${filterChip} ${
            activeTag
              ? 'border-line text-muted hover:border-accent hover:text-ink'
              : 'border-accent bg-accent-soft text-ink'
          }`}
        >
          전체 {searchMatches.length}
        </Link>
        {TAGS.filter((t) => (tagCounts.get(t.name) ?? 0) > 0).map((t) => (
          <Link
            key={t.name}
            href={href(activeTag === t.name ? null : t.name, activeLevel)}
            title={t.scope}
            aria-current={activeTag === t.name ? 'true' : undefined}
            className={`${filterChip} ${
              activeTag === t.name
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-line text-muted hover:border-accent hover:text-ink'
            }`}
          >
            {t.name} {tagCounts.get(t.name)}
          </Link>
        ))}
      </nav>

      {/*
        난이도 줄. 태그와 별줄로 두는 이유 — 한 줄에 섞으면 "동시성"과
        "심화"가 같은 축처럼 읽힌다. 둘은 AND로 조합되는 다른 축이다.
        같은 태그를 다시 누르면 풀리고, 축을 바꿔도 다른 축 선택은 유지된다.
      */}
      <nav aria-label="난이도" className="mt-2 flex flex-wrap gap-2">
        {LEVELS.map((l) => (
          <Link
            key={l.name}
            href={href(activeTag, activeLevel === l.name ? null : l.name)}
            title={l.rubric}
            aria-current={activeLevel === l.name ? 'true' : undefined}
            className={`${filterChip} ${
              activeLevel === l.name
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-line text-muted hover:border-accent hover:text-ink'
            }`}
          >
            {l.name}
          </Link>
        ))}
      </nav>

      {/*
        목차를 위에 두고 **따라다니게** 한다.

        카테고리가 열 개라 폰에서는 스크롤이 길다. 재보니 249행 × 49px로
        14,906px, 폰에서 19.6화면이다. 목차가 맨 위에 고정돼 있으면 다른
        카테고리로 가려고 그 19화면을 되감아야 한다.

        `sticky`면 되감기가 사라진다. 어디에 있든 손 닿는 곳에 목차가 있다.
        스크롤 총량은 그대로지만 사용자가 겪는 비용은 그 되감기였다.

        헤더가 이미 위에 붙어 있으므로 그 아래에 선다(top-14). 배경을 깔지
        않으면 아래 글이 비쳐 읽힌다.

        폰에서는 한 줄로 옆으로 넘긴다. 열 개를 줄바꿈하면 목차가 화면 절반을
        덮은 채 따라다닌다. 넓은 화면에서만 다시 여러 줄을 허용한다.
      */}
      {grouped.length > 0 && (
        <nav
          aria-label="분야별 질문 바로가기"
          className="sticky top-14 z-10 -mx-5 mt-8 flex flex-nowrap gap-2 overflow-x-auto bg-surface/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:flex-wrap sm:overflow-visible sm:px-8"
        >
          {grouped.map((g) => (
            <a
              key={g.category}
              href={`#${categoryAnchor(g.category)}`}
              className={`${filterChip} shrink-0 border-line text-muted hover:border-accent hover:text-ink`}
            >
              {g.category} {g.items.length}
            </a>
          ))}
        </nav>
      )}

      {grouped.map((g) => (
        /* 머리글과 붙박이 목차 높이만큼 내려야 누른 분야 제목이 그 뒤에 숨지 않는다. */
        <section key={g.category} id={categoryAnchor(g.category)} className="mt-12 scroll-mt-32">
          <h2 className="mb-4 flex items-baseline gap-2 border-b border-line pb-2">
            <span className="text-[17px] font-bold tracking-[-0.01em]">{g.category}</span>
            <span className="text-[13px] text-faint">{g.items.length}개</span>
          </h2>

          {/*
            목차라서 제목만 세운다.
            카드로 그리면 발췌까지 실려 한 줄이 300px가 되고, 마흔여덟 개면
            폰에서 열여섯 화면이 넘는다. 접어봐야 카테고리당 하나씩만 접혀서
            줄지도 않는다. 여기서 하는 일은 훑기지 읽기가 아니다.

            넓은 화면에서는 두 줄로 세운다. 재보니 데스크톱에서 본문이 768px인데
            한 줄에 28자만 들어가 좌우 672px가 놀고 있었다. 폰은 한 줄 그대로다 —
            350px를 반으로 가르면 열두 자라 제목이 세 줄로 접혀 오히려 길어진다.
          */}
          <ul className="border-t border-line sm:grid sm:grid-cols-2 sm:gap-x-8">
            {g.items.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                <Link
                  href={`/q/${r.id}`}
                  className="group flex items-center gap-3 rounded-md py-3 transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <p className="text-[15px] text-muted">
            {query || activeTag || activeLevel ? '조건에 맞는 질문이 없습니다.' : '아직 올라온 질문이 없습니다.'}
          </p>
          {(query || activeTag || activeLevel) && (
            <Link href="/questions" className="mt-4 inline-flex min-h-11 items-center rounded-md text-[13px] font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              검색과 필터 초기화
            </Link>
          )}
        </div>
      )}
    </main>
  )
}
