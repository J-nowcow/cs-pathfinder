import type { Metadata } from 'next'
import { GlossaryList } from '@/components/GlossaryList'

/**
 * 용어 사전.
 *
 * **그래프와 별개로 선다.** 용어를 질문 노드로 만들면 그래프가 정의로
 * 오염된다 — 꼬리질문은 정의가 아니라 한 층 더 깊은 새 질문이다.
 * 본문 속 용어의 첫 등장이 여기(`#용어`)로 링크된다.
 *
 * 목록은 `data/glossary.ts`가 원본이다. 등재 기준(빈도 실측 3편 이상)과
 * 뺀 것의 이유도 그 파일에 있다.
 *
 * 이 파일은 셸만 그린다. 검색·초성 인덱스는 상태가 필요해서
 * `GlossaryList`가 클라이언트로 맡는다 — 제목과 안내문까지 클라이언트로
 * 넘길 이유가 없다.
 */
export const metadata: Metadata = {
  title: '용어 사전',
  description: '해설에 자주 나오는 CS 용어를 한 문장씩 풀었습니다.',
}

export default function GlossaryPage() {
  return (
    <main className="mx-auto max-w-[680px] px-5 py-10">
      <h1 className="text-[24px] font-bold leading-[1.35]">용어 사전</h1>
      <p className="mt-3 text-[15px] leading-[1.75] text-muted">
        해설에 자주 나오는 용어를 한 문장씩 풀었습니다. 해설 본문에서 점선이 밑에 깔린 용어를
        누르면 여기로 옵니다.
      </p>

      <GlossaryList />

      <p className="mt-10 text-[13px] text-faint">
        본문 335편에서 3편 이상 등장한 용어만 실었습니다. 빠졌거나 틀린 것은 GitHub 이슈로
        알려 주시기 바랍니다.
      </p>
    </main>
  )
}
