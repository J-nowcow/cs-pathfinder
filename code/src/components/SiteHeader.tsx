'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ContactMenu } from '@/components/ContactMenu'
import { AuthMenu } from '@/components/AuthMenu'

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
  /*
   * 학습 기록은 **돌아올 이유**다. 오늘의 질문은 매일 새로 오지만 어제까지
   * 쌓인 것은 여기서만 보인다. 머리글에 없으면 아무도 못 찾는다.
   */
  { href: '/me', label: '학습 기록' },
]

/**
 * 폰에서는 빼는 안쪽 길.
 *
 * 용어 사전은 **본문에서 먼저 만난다** — 해설 속 점선 밑줄을 누르면 그
 * 항목으로 바로 온다. 머리글 링크는 그 길을 이미 지난 사람이 목록째
 * 보려 할 때 쓰는 두 번째 길이다. 폰에서는 자리가 없어 바닥글에만 두고
 * (`SiteFooter`가 이미 걸고 있다) sm 위에서만 세운다.
 *
 * 자리가 없다는 것은 재서 안 것이다. 390px에서 이 줄은 350px을 쓸 수
 * 있는데 항목들이 366px을 달라고 한다 — 넣을 자리가 모자란 정도가
 * 아니라 이미 넘쳐 있었다.
 */
const WIDE_LINKS = [{ href: '/glossary', label: '용어 사전' }]

const REPO = 'https://github.com/J-nowcow/cs-pathfinder'

/**
 * 바깥으로 나가는 곳.
 *
 * 글자 대신 그림으로 둔다. 폰 390px에서 안쪽 링크 셋만으로도 자리가 빠듯해서
 * 글자를 더 붙이면 줄이 넘친다. 대신 `aria-label`로 이름을 남긴다 — 화면
 * 낭독기에는 그림이 안 보인다.
 *
 * **별을 대신 눌러줄 수는 없다.** 남의 계정으로 하는 일이고 그런 주소도 없다.
 * 저장소로 보내고 거기서 누르게 한다.
 *
 * 폰에서는 감춘다(`hidden sm:grid`). 계정 아이콘이 들어오면서 자리를 하나
 * 내줘야 했는데, 둘 중 뒤로 물러설 것은 이쪽이다 — 로그인은 기록을 다른
 * 기기로 잇는 기능이고 저장소 링크는 권유다. 폰에서도 아주 사라지지는
 * 않는다. `문의`를 열면 첫 항목이 GitHub이다.
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
      className="-my-1.5 hidden h-11 w-9 place-items-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:grid"
    >
      {children}
    </a>
  )
}

export function SiteHeader() {
  const pathname = usePathname()

  /*
   * 지금 있는 곳을 표시한다.
   *
   * 홈은 정확히 같을 때만 켠다. `startsWith`로 하면 '/'가 모든 주소에
   * 걸려 어디에 있든 홈이 켜진 것처럼 보인다.
   */
  const isHere = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  /*
    보이는 크기는 그대로 두고 누르는 자리만 키운다.

    폰에서 재보니 높이가 32px이었다. 손끝이 닿는 자리로는 작다 — 옆 항목이
    눌린다. `py`를 키우고 같은 만큼 `-my`로 당기면 글자 위치와 헤더 높이는
    그대로인 채 판정 영역만 44px가 된다.

    좌우는 폰에서 `px-1`로 줄였다. 계정 아이콘이 들어오면서 6px이 모자랐는데
    줄일 수 있는 곳이 여기뿐이었다. **세로는 건드리지 않는다** — 44px 판정을
    만드는 것은 `py`와 `-my` 짝이고, 좌우는 옆 항목과 벌어지는 간격 문제다.
    글자 사이는 8px이 남아 폰에서 옆 것이 눌리지 않는다.
  */
  const linkClass = (here: boolean) =>
    `-my-2 rounded-lg px-1 py-[13px] text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-2.5 sm:text-[13px] ${
      here ? 'font-medium text-ink' : 'text-muted hover:text-ink'
    }`

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      {/*
        `flex-nowrap`이 있어야 한 줄이다.

        아이콘 둘을 넣었더니 폰 390px에서 두 줄로 접혔다 — "오늘의 질 / 문"처럼
        낱말이 갈라졌다. 넘침은 0이었지만 줄바꿈으로 피한 것이라 숫자만 봐서는
        안 보였다. 화면을 찍어야 알 수 있는 종류다.

        **폰에서는 칸 사이를 0으로 붙인다.** 계정 아이콘을 넣기 전에 재보니
        390px에서 쓸 수 있는 350px에 항목들이 366px을 달라고 하고 있었다.
        모자란 16px은 flex가 알아서 메우고 있었는데, 메우는 방식이 제일 덜
        버티는 칸을 줄이는 것이라 GitHub 아이콘이 36px에서 **17px로 눌려**
        있었다. 줄이 안 넘쳤으니 화면으로도 안 보이고 숫자로도 안 잡힌다.
        항목마다 붙은 `px`가 이미 사이를 벌리고 있어서 `gap`은 없어도 된다.
      */}
      <nav className="mx-auto flex max-w-3xl flex-nowrap items-center gap-0 whitespace-nowrap px-5 py-3 sm:gap-1 sm:px-8">
        <Link href="/" className="-my-3 mr-auto rounded-md py-3 text-[14px] font-bold tracking-[-0.01em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          CS 길라잡이
        </Link>

        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isHere(l.href) ? 'page' : undefined}
            className={linkClass(isHere(l.href))}
          >
            {l.label}
          </Link>
        ))}

        {WIDE_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isHere(l.href) ? 'page' : undefined}
            className={`hidden sm:block ${linkClass(isHere(l.href))}`}
          >
            {l.label}
          </Link>
        ))}

        {/* 안쪽 길과 바깥 길을 선으로 가른다. 섞이면 어디로 나가는지 안 보인다 */}
        <span aria-hidden className="mx-1 h-4 w-px bg-line" />

        <OutLink href={REPO} label="GitHub에서 보기 (별을 눌러주세요)">
          <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
        </OutLink>

        {/*
          문의는 글자로 둔다.

          봉투 그림이었을 때 "눌러도 안 먹는다"는 말이 나왔다. 링크는 멀쩡했다 —
          `mailto:`는 기본 메일 앱이 없으면 브라우저가 조용히 아무것도 안 한다.
          사용자에게는 고장으로 보인다.

          이제 누르면 두 갈래(GitHub 이슈 · 메일 주소)를 펼쳐 보인다. 그림으로는
          "누르면 무언가 열린다"가 안 읽혀서 글자로 바꿨다.
        */}
        <ContactMenu />

        {/*
          계정은 맨 끝이다.

          왼쪽부터 "무엇을 읽을까(안쪽 길) → 만든 사람에게(바깥 길) → 나"
          순서다. 로그인은 읽는 일과 상관이 없어서 안쪽 길에 섞으면 매번
          지나쳐 읽게 된다.
        */}
        <AuthMenu />
      </nav>
    </header>
  )
}
