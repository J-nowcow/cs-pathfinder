import Link from 'next/link'

/**
 * 홈의 주인공.
 *
 * 설계 §7이 "오늘의 질문이 주인공이다"라고 잡은 자리다. 히어로 바로 아래에서
 * 한 화면을 크게 차지한다.
 *
 * 발행이 하루 밀리면 가장 최근 것이 대신 온다. 그때 "오늘의 질문"이라고 부르면
 * 거짓말이 되므로 머리말을 바꾼다. 화면이 사실과 어긋나기 시작하면 나머지 숫자도
 * 못 믿게 된다.
 */
export type TodayFeature = {
  nodeId: string
  question: string
  category: string
  excerpt: string
  /** 오늘(KST) 발행분이면 true */
  isToday: boolean
  /** 매일 발행분이면 트리 주소가 있다. 아직 발행이 안 붙었으면 null */
  treeSlug: string | null
}

export function TodayCard({ feature }: { feature: TodayFeature }) {
  return (
    <section id="today" aria-labelledby="today-heading" className="scroll-mt-6">
      <p id="today-heading" className="mb-3 text-[13px] font-medium text-faint">
        {feature.isToday ? '오늘의 질문' : '가장 최근 질문'}
      </p>

      <Link
        href={`/q/${feature.nodeId}`}
        className="group block rounded-xl border border-line bg-raised p-6 transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-8"
      >
        <span className="text-[12px] font-medium text-faint">{feature.category}</span>

        <h2 className="mt-2.5 text-[26px] font-semibold leading-[1.32] tracking-[-0.022em] text-ink group-hover:text-accent sm:text-[32px]">
          {feature.question}
        </h2>

        <p className="mt-3.5 text-[15px] leading-[1.72] text-muted">{feature.excerpt}</p>

        <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent">
          질문 읽기
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </Link>

      {feature.treeSlug && (
        <p className="mt-2.5 text-right text-[13px]">
          <Link
            href={`/t/${feature.treeSlug}`}
            /*
              혼자 서 있는 줄이라 위아래로 늘려도 겹칠 것이 없다. 폰에서
              재보니 16px이었다 — 손끝으로는 못 누른다. 보이는 글자는 그대로
              두고 판정 영역만 44px로 만든다.
            */
            className="-my-[14px] inline-block py-[14px] text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            이 질문의 지도 보기 →
          </Link>
        </p>
      )}
    </section>
  )
}
