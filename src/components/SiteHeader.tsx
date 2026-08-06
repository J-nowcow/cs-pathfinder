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

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <nav className="mx-auto flex max-w-3xl items-center gap-1 px-5 py-3 sm:px-8">
        <Link href="/" className="mr-auto text-[14px] font-bold tracking-[-0.01em]">
          꼬꼬무 CS
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
              className={`rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                here ? 'font-medium text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {l.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
