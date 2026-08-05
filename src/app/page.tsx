import { ensureSeeded } from '@/lib/db/bootstrap'
import { listRoots } from '@/lib/db/roots'
import { RootCard } from '@/components/RootCard'

// PGlite가 인메모리라 매 요청 실제 DB를 읽는다. 정적 생성 대상이 아니다.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  await ensureSeeded()
  const roots = await listRoots()

  const [hero, ...rest] = roots

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <header className="mb-10 sm:mb-14">
        <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-accent">CS 질문 트리</h1>
        <p className="mt-3 max-w-lg text-[15px] leading-[1.7] text-muted">
          질문 하나에서 꼬리질문을 파고든다. 판 자국은 지도로 남는다.
        </p>
      </header>

      {roots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] text-muted">아직 발행된 질문이 없습니다.</p>
          <p className="mt-2 text-[13px] text-faint">
            서버를 다시 시작하면 예시 질문이 시드됩니다.
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
