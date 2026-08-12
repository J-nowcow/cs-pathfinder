'use client'

import Link from 'next/link'
import type { PublicRelated } from '@/lib/api/expand-client'

/**
 * 관련 질문.
 *
 * 해설을 다 읽은 사람에게 다음 자리를 준다. 추천 꼬리질문(`Suggestions`)과
 * 다른 일을 한다 — 저쪽은 **더 깊이** 파는 단추라 누르면 새 노드를 만들고
 * 할당량을 깎는다. 이쪽은 **옆으로** 옮기는 링크라 이미 있는 글로 갈 뿐이다.
 * 그래서 단추가 아니라 링크로 그린다. 새 창으로 열든 주소를 복사하든
 * 브라우저가 링크에 해 주는 것을 그대로 받는다.
 *
 * 목록이 비면 제목까지 통째로 안 그린다. 관계도 임베딩도 없는 노드가 있고,
 * 제목만 남은 섹션은 고장으로 읽힌다.
 */
export function RelatedList({
  items,
  readIds,
  hydrated,
}: {
  items: PublicRelated[]
  /** 이미 판 노드의 id. 여정에서 온다 */
  readIds: Set<string>
  /**
   * 저장된 여정이 복원됐나.
   *
   * **복원 전에는 본 표시를 달지 않는다.** 그 전의 여정은 지금 보고 있는
   * 질문 하나뿐이라 이미 판 것도 "안 읽은 질문"으로 나온다. 사실과 다른 화면을
   * 한 틱 보여주는 것이고, 서버가 만든 HTML과도 어긋난다.
   */
  hydrated: boolean
}) {
  if (items.length === 0) return null

  return (
    <section className="pt-2">
      <h2 className="mb-3 text-[13px] font-medium text-muted">관련 질문</h2>

      <ul className="space-y-2">
        {items.map((item) => {
          const read = hydrated && readIds.has(item.id)

          return (
            <li key={item.id}>
              <Link
                href={`/q/${item.number}`}
                className="block rounded-lg border border-line bg-raised px-4 py-3.5 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 text-[15px] leading-[1.55] text-ink">
                    {item.question}
                  </span>
                  {read && (
                    <span className="mt-[3px] shrink-0 rounded-full border border-line px-1.5 py-0.5 text-[11px] text-faint">
                      본 질문
                    </span>
                  )}
                </span>

                <span className="mt-1 block text-[13px] text-muted">{item.category}</span>

                {/* 왜 이어졌는지. 벡터로 데려온 줄에는 없다 */}
                {item.reason && (
                  <span className="mt-1 block text-[12px] leading-[1.5] text-faint">
                    {item.reason}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
