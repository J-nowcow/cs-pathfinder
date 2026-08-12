'use client'

import { useMemo, useState } from 'react'
import { ALL_ENTRIES, filterEntries, groupByInitial, groupAnchor } from '@/lib/glossary/catalog'

/**
 * 사전 목록 — 찾기와 훑기.
 *
 * 25개일 때는 통짜 목록으로 됐다. 75개가 되면서 두 가지가 무너졌다.
 * 찾는 사람은 화면을 여러 번 넘겨야 하고, 훑는 사람은 어디쯤 왔는지
 * 모른다. 그래서 검색과 초성 인덱스를 같이 둔다 — 목적이 서로 다르다.
 *
 * **거르는 일은 브라우저에서 한다.** 75개는 전부 첫 응답에 실려 오므로
 * 서버에 다시 물을 이유가 없고, 글자를 칠 때마다 왕복이 생기면 오히려
 * 느려진다.
 *
 * 셸(제목·안내문)은 서버에 두고 여기만 클라이언트다. 검색 상태가 필요한
 * 것은 목록뿐이라 그 경계에서 자른다.
 */
export function GlossaryList() {
  const [query, setQuery] = useState('')

  /* 글자마다 75개를 두 번 도는 일이라 값은 싸다. 그래도 입력 중 매 렌더마다 할 일은 아니다 */
  const groups = useMemo(() => groupByInitial(filterEntries(ALL_ENTRIES, query)), [query])
  const found = groups.reduce((n, g) => n + g.entries.length, 0)
  const searching = query.trim().length > 0

  return (
    <>
      <div className="mt-6">
        <div className="relative">
          <input
            type="search"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          /*
           * 뜻으로도 찾힌다는 것을 여기서 알린다. 이름을 알면 본문 링크로
           * 오지, 사전을 뒤지지 않는다 — 검색하는 사람은 대개 이름을 모른다.
           */
            placeholder="용어나 뜻으로 찾기"
            aria-label="용어 검색"
            className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 pr-14 text-[15px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="용어 검색 지우기"
              className="absolute inset-y-0 right-0 min-w-11 px-3 text-[12px] text-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              지우기
            </button>
          )}
        </div>

        {/*
          찾은 개수를 말한다.

          `role="status"`라서 화면 낭독기가 목록이 줄어든 것을 읽어 준다.
          안 그러면 글자를 쳐도 아무 일이 없는 것처럼 들린다.
        */}
        {searching && (
          <p role="status" className="mt-2 text-[13px] text-faint">
            {found > 0 ? `${found}개 찾았습니다.` : '찾는 용어가 없습니다.'}
          </p>
        )}
      </div>

      {/*
        초성으로 건너뛰기.

        **있는 칸만 세운다.** 비어 있는 자음을 세우면 눌러도 아무 데도 안
        간다. 검색으로 걸러진 뒤에도 같은 계산을 다시 태우므로, 결과에 없는
        초성은 저절로 사라진다.

        `flex-wrap`이라 폰에서 두 줄이 된다. 가로 스크롤로 밀어 두면 뒤쪽
        칸이 화면 밖에 숨는데, 인덱스는 **한눈에 보여야** 쓸모가 있다.
      */}
      {groups.length > 1 && (
        <nav aria-label="초성으로 건너뛰기" className="mt-4 flex flex-wrap gap-0.5">
          {groups.map((g) => (
            <a
              key={g.initial}
              href={`#${encodeURIComponent(groupAnchor(g.initial))}`}
              /* 헤더와 같은 규칙 — 보이는 크기는 그대로 두고 누르는 자리를 44px로 */
              className="grid min-h-11 w-8 place-items-center rounded-lg text-[13px] text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              {g.initial}
            </a>
          ))}
        </nav>
      )}

      {groups.map((g) => (
        <section key={g.initial} className="mt-8">
          <h2
            id={groupAnchor(g.initial)}
            /* scroll-mt는 붙박이 머리글이 앵커를 가리는 것을 막는다 */
            className="scroll-mt-20 border-b border-line pb-2 text-[13px] font-medium text-faint"
          >
            {g.initial}
          </h2>
          <dl>
            {g.entries.map((e) => (
              /*
               * id가 본문 링크의 과녁이다. Prose가 `#${encodeURIComponent(term)}`로
               * 보내고 브라우저가 풀어서 이 id와 맞춘다. **글자 그대로 두어야
               * 한다** — 모양을 바꾸면 본문 전체의 용어 링크가 한꺼번에 죽는다.
               */
              <div key={e.term} id={e.term} className="scroll-mt-20 border-b border-line py-4">
                <dt className="text-[16px] font-bold">
                  {e.term}
                  {/*
                    영문 병기 — 면접에서 영어로 나오는 용어를 한글 표기와
                    잇는다. 표시일 뿐 정렬·인덱스·앵커는 term 그대로다.
                  */}
                  {e.english && (
                    <span className="ml-2 text-[13px] font-normal text-faint">{e.english}</span>
                  )}
                </dt>
                <dd className="mt-1 text-[15px] leading-[1.75] text-muted">{e.short}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  )
}
