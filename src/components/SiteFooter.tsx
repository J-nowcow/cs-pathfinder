import Link from 'next/link'
import { CATEGORIES, categoryAnchor } from '@/lib/tree/categories'

/**
 * 아래쪽 사이트맵.
 *
 * 헤더는 셋만 담는다. 거기 다 넣으면 폰에서 줄이 넘치고, 매 화면 위에 붙어
 * 있는 자리라 길어질수록 본문을 밀어낸다. 대신 다 읽고 내려온 사람에게는
 * 갈 곳을 넓게 보여준다.
 *
 * 카테고리를 여기 펼치는 이유는 그것이 이 서비스에서 제일 굵은 갈래이기
 * 때문이다. "네트워크만 보고 싶다"가 흔한 요구인데 지금은 목록 화면에 들어가야
 * 보인다.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-[1fr_2fr]">
          <nav aria-label="주요 화면">
            <h2 className="text-[12px] font-medium text-faint">둘러보기</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/" className="text-[13px] text-muted hover:text-ink">
                  오늘의 질문
                </Link>
              </li>
              <li>
                <Link href="/questions" className="text-[13px] text-muted hover:text-ink">
                  질문 목록
                </Link>
              </li>
              <li>
                <Link href="/map" className="text-[13px] text-muted hover:text-ink">
                  질문 지도
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="분야">
            <h2 className="text-[12px] font-medium text-faint">분야</h2>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  {/*
                    목록 화면의 해당 자리로 바로 보낸다. `#` 뒤는 그 화면이
                    카테고리마다 붙여 둔 제목의 id다.
                  */}
                  <Link
                    href={`/questions#${categoryAnchor(c)}`}
                    className="text-[13px] text-muted hover:text-ink"
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 text-[12px] text-faint">
          하루에 질문 하나. 파고든 만큼 지도가 남아요.
        </p>
      </div>
    </footer>
  )
}
