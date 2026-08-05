import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * 어느 곳에도 없는 주소.
 *
 * 이게 없으면 Next 기본 화면이 뜬다. 검은 글씨 몇 줄에 나갈 문이 없고 서비스와
 * 아무 관계없이 생겼다. 봇이 주소를 훑다가 오기도 하지만 사람도 온다 — 카톡에서
 * 주소가 잘리는 일이 흔하다.
 *
 * 접미는 layout의 title template이 붙인다.
 */
export const metadata: Metadata = {
  title: '없는 주소예요',
}

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-5 py-20 sm:px-8">
      <h1 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
        없는 주소예요
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.72] text-muted">
        주소가 잘려서 왔을 수도 있어요. 하루에 질문 하나씩 올라오니까 오늘 치부터 보셔도 좋고요.
      </p>

      <div className="mt-7">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          오늘 치 질문 보기
          <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  )
}
