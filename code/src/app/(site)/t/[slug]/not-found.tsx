import Link from 'next/link'

/**
 * 없는 공유 링크.
 *
 * 카톡에서 주소가 잘려 오거나 오타가 섞이는 일이 흔하다. 여기서 막다른 길을 만들면
 * 처음 온 사람이 그대로 나간다. 홈으로 잇는 문을 반드시 둔다.
 */
export default function TreeNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-5 py-20 sm:px-8">
      <h1 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
        없는 링크입니다
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.72] text-muted">
        주소가 잘려서 왔거나 지워진 트리인 것 같습니다. 대신 오늘 치 질문부터 파보셔도 좋습니다.
      </p>

      <div className="mt-7">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          홈으로
          <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  )
}
