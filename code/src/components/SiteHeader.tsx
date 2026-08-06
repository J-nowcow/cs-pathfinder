'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 화면 맨 위의 길잡이.
 *
 * 없을 때는 홈에 무엇이 있는지 알 방법이 없었다. 지도와 목록으로 가는 길이
 * 홈 중간과 아래에만 있어서, 질문 화면(`/q/...`)에 들어간 사람은 홈으로
 * 돌아가지 않는 한 그 둘을 찾을 수 없었다.
 *
 * 세 개만 둔다. 이 서비스가 하는 일이 셋이라서다 — 오늘 질문을 읽고, 전체
 * 목록을 훑고, 지도로 본다. 더 넣으면 고르는 일이 생긴다.
 *
 * 지도(`/map`)에는 안 붙는다. 그쪽은 전체 화면을 쓰는 화면이고 자기 헤더가
 * 이미 있다.
 */
const LINKS = [
  { href: '/', label: '오늘의 질문' },
  { href: '/questions', label: '질문 목록' },
  { href: '/map', label: '지도' },
]

const REPO = 'https://github.com/J-nowcow/cs-pathfinder'
const CONTACT = 'wkdgusdn0321@naver.com'

/**
 * 바깥으로 나가는 두 곳.
 *
 * 글자 대신 그림으로 둔다. 폰 390px에서 안쪽 링크 셋만으로도 자리가 빠듯해서
 * 글자를 더 붙이면 줄이 넘친다. 대신 `aria-label`로 이름을 남긴다 — 화면
 * 낭독기에는 그림이 안 보인다.
 *
 * **별을 대신 눌러줄 수는 없다.** 남의 계정으로 하는 일이고 그런 주소도 없다.
 * 저장소로 보내고 거기서 누르게 한다.
 */
function OutLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  /*
    `mailto:`에는 새 창을 열지 않는다.

    메일 앱을 띄우는 주소라 새 탭을 열어도 그 탭은 곧바로 빈 화면으로 남는다.
    브라우저에 따라 빈 탭이 그대로 떠 있어서 사람이 직접 닫아야 한다.
  */
  const newTab = !href.startsWith('mailto:')

  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      // noopener가 없으면 열린 창이 window.opener로 이 페이지를 조작할 수 있다
      rel={newTab ? 'noopener noreferrer' : undefined}
      aria-label={label}
      title={label}
      className="-my-1.5 grid h-11 w-9 place-items-center rounded-lg text-muted transition-colors hover:text-ink"
    >
      {children}
    </a>
  )
}

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      {/*
        `flex-nowrap`이 있어야 한 줄이다.

        아이콘 둘을 넣었더니 폰 390px에서 두 줄로 접혔다 — "오늘의 질 / 문"처럼
        낱말이 갈라졌다. 넘침은 0이었지만 줄바꿈으로 피한 것이라 숫자만 봐서는
        안 보였다. 화면을 찍어야 알 수 있는 종류다.
      */}
      <nav className="mx-auto flex max-w-3xl flex-nowrap items-center gap-0.5 whitespace-nowrap px-5 py-3 sm:gap-1 sm:px-8">
        <Link href="/" className="mr-auto text-[14px] font-bold tracking-[-0.01em]">
          CS 길라잡이
        </Link>

        {LINKS.map((l) => {
          /*
           * 지금 있는 곳을 표시한다.
           *
           * 홈은 정확히 같을 때만 켠다. `startsWith`로 하면 '/'가 모든 주소에
           * 걸려 어디에 있든 홈이 켜진 것처럼 보인다.
           */
          const here = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={here ? 'page' : undefined}
              /*
                보이는 크기는 그대로 두고 누르는 자리만 키운다.

                폰에서 재보니 높이가 32px이었다. 손끝이 닿는 자리로는 작다 —
                옆 항목이 눌린다. `py`를 키우고 같은 만큼 `-my`로 당기면 글자
                위치와 헤더 높이는 그대로인 채 판정 영역만 44px가 된다.
              */
              className={`-my-1.5 rounded-lg px-1.5 py-3 text-[12.5px] transition-colors sm:px-2.5 sm:text-[13px] ${
                here ? 'font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          )
        })}

        {/* 안쪽 길과 바깥 길을 선으로 가른다. 섞이면 어디로 나가는지 안 보인다 */}
        <span aria-hidden className="mx-1 h-4 w-px bg-line" />

        <OutLink href={REPO} label="GitHub에서 보기 (별을 눌러주세요)">
          <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </OutLink>

        {/*
          문의는 메일로 받는다.

          처음에는 GitHub 이슈로 걸었다. 기록이 남고 주소가 안 새서 좋지만
          **GitHub 계정이 없으면 아예 못 쓴다.** 이 서비스를 읽는 사람이 전부
          개발자 계정을 가졌다고 볼 수 없다.

          `mailto:`는 주소가 HTML에 그대로 들어가 수집 봇에 긁힌다. 그 대가를
          알고 고른 것이다 — 문의하려는 사람이 문턱에서 돌아서는 쪽이 더 나쁘다.

          제목을 미리 채워 둔다. 어디서 온 메일인지 받는 쪽이 바로 안다.
        */}
        <OutLink
          href={`mailto:${CONTACT}?subject=${encodeURIComponent('[CS 길라잡이] 문의')}`}
          label="문의하기 (메일)"
        >
          <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden>
            {/* 봉투. 말풍선을 쓰면 채팅으로 읽혀서 메일이라는 것이 안 보인다 */}
            <path d="M2 3.5h12c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1H2c-.55 0-1-.45-1-1v-7c0-.55.45-1 1-1Zm.6 1.25L8 8.36l5.4-3.61H2.6ZM13.75 6.1 8.35 9.7a.63.63 0 0 1-.7 0L2.25 6.1v5.15h11.5V6.1Z" />
          </svg>
        </OutLink>
      </nav>
    </header>
  )
}
