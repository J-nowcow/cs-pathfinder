import Link from 'next/link'

/**
 * 없는 질문.
 *
 * 링크가 죽는 경로가 실제로 있다. 발행분을 다시 뽑으면 옛 루트 노드가 사라지고,
 * 키 없는 배포가 남긴 가짜 해설을 지울 때도 노드가 사라진다. 그때 그 주소를
 * 들고 있던 사람이 여기로 온다.
 *
 * 막다른 길로 두지 않는다. 처음 온 사람이면 여기가 첫 화면인데 나갈 문이 없으면
 * 그대로 나간다.
 */
export default function QuestionNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-5 py-20 sm:px-8">
      <h1 className="text-[24px] font-semibold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
        없는 질문이에요
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-[1.72] text-muted">
        주소가 잘려서 왔거나 지워진 질문인 것 같아요. 오늘 치 질문부터 파보셔도 좋고요.
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
