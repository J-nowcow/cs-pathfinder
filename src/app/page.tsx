import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { RootCard } from '@/components/RootCard'
import { HeroBackdrop } from '@/components/HeroBackdrop'

// PGlite가 인메모리라 매 요청 실제 DB를 읽는다. 정적 생성 대상이 아니다.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  await ensureSeeded()
  const roots = await listRoots()

  const [hero, ...rest] = roots

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
      </header>

      {roots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 올라온 질문이 없어요.</p>
          <p className="mt-2 text-[13px] text-faint">
            서버를 다시 띄우면 예시 질문이 들어갑니다.
          </p>
        </div>
      ) : (
        <>
          <RootCard root={hero} hero />

          {rest.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 text-[13px] font-medium text-faint">
                다른 질문 {rest.length}개
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {rest.map((r) => (
                  <RootCard key={r.id} root={r} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
