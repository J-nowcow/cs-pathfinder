'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/tree/categories'
import type { BoardTree } from '@/lib/db/trees'
import type { SortMode } from '@/lib/tree/cursor'
import { TreeCard, TreeCardSkeleton } from '@/components/TreeCard'

/**
 * 공유된 트리 게시판.
 *
 * 설계 §7은 "인기 / 최신 / 카테고리 10개"를 한 줄의 탭으로 잡았다. 여기서는 두 줄로
 * 나눴다. 정렬과 필터는 서로 배타적이지 않은데, 한 줄에 섞으면 카테고리를 누르는
 * 순간 정렬 탭이 꺼진 것처럼 보인다. 실제로는 정렬이 그대로 걸려 있어 화면이 거짓말을 한다.
 *
 * 가로 스크롤이 필요한 건 항목이 많은 카테고리 줄이고, 거기에만 걸었다.
 *
 * 첫 페이지는 서버가 그려서 넘긴다. 홈에 들어오자마자 스켈레톤부터 보는 건
 * 없어도 될 대기이고, 게시판 내용이 검색 엔진에도 잡혀야 한다.
 */

const SORTS: Array<{ value: SortMode; label: string }> = [
  { value: 'recent', label: '최신' },
  { value: 'popular', label: '인기' },
]

type Props = {
  initial: { trees: BoardTree[]; nextCursor: string | null }
}

export function Board({ initial }: Props) {
  const [sort, setSort] = useState<SortMode>('popular')
  const [category, setCategory] = useState<string | null>(null)
  const [trees, setTrees] = useState(initial.trees)
  const [cursor, setCursor] = useState(initial.nextCursor)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  // 첫 렌더는 서버가 준 것을 그대로 쓴다. 같은 것을 한 번 더 받아올 이유가 없다
  const primed = useRef(true)

  // 탭을 빠르게 옮기면 먼저 보낸 요청이 나중에 도착해 이전 탭 내용을 덮는다.
  // 마지막 요청만 화면에 반영한다.
  const latest = useRef(0)

  const fetchPage = useCallback(
    async (nextSort: SortMode, nextCategory: string | null, nextCursor: string | null) => {
      const ticket = ++latest.current
      setLoading(true)
      setFailed(false)

      const params = new URLSearchParams({ sort: nextSort })
      if (nextCategory) params.set('category', nextCategory)
      if (nextCursor) params.set('cursor', nextCursor)

      try {
        const res = await fetch(`/api/trees?${params}`)
        if (!res.ok) throw new Error('board failed')
        const body = (await res.json()) as Props['initial']
        if (ticket !== latest.current) return

        setTrees((prev) => (nextCursor ? [...prev, ...body.trees] : body.trees))
        setCursor(body.nextCursor)
      } catch {
        if (ticket === latest.current) setFailed(true)
      } finally {
        if (ticket === latest.current) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (primed.current) {
      primed.current = false
      return
    }
    void fetchPage(sort, category, null)
  }, [sort, category, fetchPage])

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      active
        ? 'bg-accent text-on-accent'
        : 'border border-line bg-raised text-muted hover:border-faint hover:text-ink'
    }`

  return (
    <section aria-labelledby="board-heading">
      <h2 id="board-heading" className="mb-4 text-[13px] font-medium text-faint">
        사람들이 판 트리
      </h2>

      <div className="flex gap-1.5">
        {SORTS.map((s) => (
          <button key={s.value} type="button" onClick={() => setSort(s.value)} className={chip(sort === s.value)}>
            {s.label}
          </button>
        ))}
      </div>

      {/* 카테고리가 10개라 폰에서 한 줄에 안 들어간다. 접거나 더보기로 감추면
          뒤쪽 분류는 아무도 못 찾는다. 가로로 미는 편이 낫다 */}
      <div className="scroll-x -mx-5 mt-2.5 sm:mx-0">
        <div className="flex w-max gap-1.5 px-5 sm:px-0">
          <button type="button" onClick={() => setCategory(null)} className={chip(category === null)}>
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} className={chip(category === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {loading && trees.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2].map((i) => (
              <TreeCardSkeleton key={i} />
            ))}
          </div>
        ) : failed ? (
          <div className="rounded-lg border border-warn/30 bg-warn-soft px-6 py-10 text-center">
            <p className="text-[15px] text-ink">게시판을 못 불러왔어요.</p>
            <button
              type="button"
              onClick={() => void fetchPage(sort, category, null)}
              className="mt-4 rounded-md border border-line bg-raised px-4 py-2 text-[13px] font-medium text-ink hover:border-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              다시 시도
            </button>
          </div>
        ) : trees.length === 0 ? (
          <Empty category={category} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {trees.map((t) => (
                <TreeCard key={t.id} tree={t} />
              ))}
            </div>

            {cursor && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void fetchPage(sort, category, cursor)}
                  className="rounded-lg border border-line bg-raised px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {loading ? '불러오는 중' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

/**
 * 빈 게시판.
 *
 * 설계 §7이 빈 상태에 오늘의 질문 유도를 붙이라고 했다. 아무것도 없는 화면에서
 * 나가면 다시 안 온다. 카테고리를 좁혀서 빈 것과 통째로 빈 것은 할 말이 다르다.
 */
function Empty({ category }: { category: string | null }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
      {category ? (
        <>
          <p className="text-[15px] text-muted">{category} 쪽은 아직 판 사람이 없어요.</p>
          <p className="mt-2 text-[13px] text-faint">
            여기는 사람이 공유한 트리만 걸려요. 질문 자체를 찾는 거라면{' '}
            <Link href="/questions" className="text-accent hover:underline">
              카테고리별 질문
            </Link>
            에 있어요.
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] text-muted">아직 공유된 트리가 없어요.</p>
          <p className="mt-2 text-[13px] text-faint">
            오늘 치 질문을 파고 공유하면 여기가 첫 자리예요.
          </p>
        </>
      )}

      <Link
        href="#today"
        className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        오늘 치 질문 보러 가기
        <span aria-hidden>↑</span>
      </Link>
    </div>
  )
}
