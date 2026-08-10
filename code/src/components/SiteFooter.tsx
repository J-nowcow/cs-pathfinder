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
/*
 * 여기 링크는 손끝 기준(44px)보다 작다. 폰에서 재보니 16px이다.
 *
 * 키우려다 되돌렸다. 세로로 촘촘히 쌓인 목록이라 판정 영역만 늘리면 위아래가
 * **서로 겹쳐** 엉뚱한 링크가 눌린다. 겹치지 않으려면 줄 간격을 16px 이상으로
 * 벌려야 하는데, 이 푸터는 이미 폰에서 407px(화면의 53%)라 더 키울 수 없다.
 *
 * 그래서 그대로 둔다. WCAG AA 최소치(24px)는 넘고, 부차적인 길잡이라 헤더의
 * 주 항목만큼 자주 눌리지 않는다. 푸터를 줄이는 작업과 함께 다시 볼 자리다.
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
              <li>
                <Link href="/me" className="text-[13px] text-muted hover:text-ink">
                  내가 판 자리
                </Link>
              </li>
              {/*
                구독은 **돌아올 이유**다. 매일 하나씩 올라오는데 알림도 메일도
                없어 사용자 기억에만 기대고 있었다. 카카오톡 채널은 사업자
                등록이 앞에 있어 아직 못 연다. RSS는 지금 열 수 있다.
              */}
              <li>
                <a href="/rss.xml" className="text-[13px] text-muted hover:text-ink">
                  RSS 구독
                </a>
              </li>
              {/*
                개인정보처리방침은 찾을 수 있어야 뜻이 있다. 만들어 두고 아무
                데서도 안 걸어 두면 없는 것과 같다. 바닥글이 모든 화면에 붙으므로
                여기가 그 자리다.
              */}
              <li>
                <Link href="/glossary" className="text-[13px] text-muted hover:text-ink">
                  용어 사전
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[13px] text-muted hover:text-ink">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[13px] text-muted hover:text-ink">
                  개인정보처리방침
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
          하루에 질문 하나. 파고든 만큼 지도가 남습니다.
        </p>
      </div>
    </footer>
  )
}
