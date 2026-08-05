import Link from 'next/link'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { RootCard } from '@/components/RootCard'
import { HeroBackdrop } from '@/components/HeroBackdrop'

// PGlite가 인메모리라 매 요청 실제 DB를 읽는다. 정적 생성 대상이 아니다.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  await ensureSeeded()
  const roots = await listRoots()

  const [hero] = roots

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <header className="relative mb-10 overflow-hidden sm:mb-14">
        <HeroBackdrop />
        <h1 className="relative text-[30px] font-extrabold leading-[1.32] tracking-[-0.025em] sm:text-[34px]">
          꼬리에 꼬리를 무는
          <br />
          CS 공부
        </h1>
        <p className="relative mt-4 max-w-lg text-[15px] leading-[1.72] text-muted">
          하루에 질문 하나. 어디로 파고들지는 직접 고르면 돼요.
          <br />
          판 만큼 지도가 그려지고요.
        </p>

        {/* 매일 발행은 계획 3이다. 그때까지는 첫 루트가 "오늘 치" 자리를 맡는다 */}
        {hero && (
          <Link
            href={`/q/${hero.id}`}
            className="relative mt-7 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            오늘 치 질문
            <span aria-hidden>→</span>
          </Link>
        )}
      </header>

      {roots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 올라온 질문이 없어요.</p>
          <p className="mt-2 text-[13px] text-faint">서버를 다시 켜면 예시 질문이 채워져요.</p>
        </div>
      ) : (
        // 히어로 CTA가 이미 첫 질문으로 보낸다. 바로 아래 같은 질문을 큰 카드로 또 놓으면
        // 같은 것을 두 번 권하는 꼴이라 목록으로 균일하게 잇는다.
        <section>
          <h2 className="mb-4 text-[13px] font-medium text-faint">질문 {roots.length}개</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {roots.map((r) => (
              <RootCard key={r.id} root={r} />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
