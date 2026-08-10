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

  /*
    누르는 자리를 손끝 크기로 키운다.

    폰에서 재보니 높이가 34px이었다. 칩이 열세 개 붙어 있는 줄이라 옆 칩이
    눌리기 쉽다. 다만 `py`를 키우는 방식은 못 쓴다 — 칩은 배경이 칠해져
    있어 패딩이 그대로 시각 높이가 되고, "전체"처럼 짧은 라벨은 폭 54에
    높이 44라 알약이 아니라 원형 덩어리로 보였다.

    그래서 보이는 알약(~32px)은 그대로 두고, 투명한 유사요소로 판정
    영역만 위아래 6px씩 넓혀 44px를 채운다 — 헤더 아이콘·초성 인덱스의
    "보이는 크기는 그대로, 누르는 자리만 크게"와 같은 규칙이다.

    가로로 늘어선 줄이라 이 방식이 안전하다. 세로로 쌓인 푸터 링크에는 못
    쓴다. 거기서는 위아래 항목의 판정 영역이 서로 겹친다.
  */
  const chip = (active: boolean) =>
    `relative shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
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

      {/*
        카테고리가 10개다. 접거나 더보기로 감추면 뒤쪽 분류는 아무도 못 찾는다.

        **넓은 화면에서는 줄을 바꿔 전부 보여준다.** 전에는 어느 폭에서든
        가로로 밀게 해뒀는데, 1280px에서 재보니 칩 줄이 1062px인데 담는 자리가
        704px이라 **358px이 잘려 있었다**(프론트엔드·인프라 · 보안·모바일 셋).
        `.scroll-x`가 스크롤바를 감추므로 더 있다는 표시가 아무것도 없었다.
        좌우로 288px씩 비어 있는 화면에서 셋을 숨기고 있던 셈이다.

        질문 목록 화면은 원래 줄을 바꿔 다 보여준다. 그쪽에 맞춘다.

        폰에서는 가로로 민다. 줄을 바꾸면 칩만 세 줄이 되어 정작 트리 카드가
        화면 밖으로 밀린다. 대신 오른쪽 끝을 흐리게 해서 더 있다고 알린다.
      */}
      <div className="scroll-x relative -mx-5 mt-2.5 sm:mx-0 sm:overflow-visible">
        <div
          aria-hidden
          className="pointer-events-none sticky right-0 top-0 float-right h-8 w-10 bg-gradient-to-l from-surface to-transparent sm:hidden"
        />
        <div className="flex w-max gap-1.5 px-5 sm:w-auto sm:flex-wrap sm:gap-y-2 sm:px-0">
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
            <p className="text-[15px] text-ink">게시판을 불러오지 못했습니다.</p>
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
          <p className="text-[15px] text-muted">{category} 쪽은 아직 판 사람이 없습니다.</p>
          <p className="mt-2 text-[13px] text-faint">
            여기는 사람이 공유한 트리만 걸립니다. 질문 자체를 찾는 것이라면{' '}
            <Link href="/questions" className="text-accent hover:underline">
              카테고리별 질문
            </Link>
            에 있습니다.
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] text-muted">아직 공유된 트리가 없습니다.</p>
          <p className="mt-2 text-[13px] text-faint">
            오늘 치 질문을 파고 공유하면 여기가 첫 자리입니다.
          </p>
        </>
      )}

      <Link
        href="#today"
        /* 혼자 서 있는 줄이라 위아래로 늘려도 겹칠 것이 없다. 20px → 44px */
        className="mt-[9px] inline-flex items-center gap-1.5 py-[13px] text-[13px] font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        오늘 치 질문 보러 가기
        <span aria-hidden>↑</span>
      </Link>
    </div>
  )
}
