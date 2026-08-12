import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { getDb } from '@/lib/db/client'
import { kstToday } from '@/lib/daily/date'
import { MePanel } from '@/components/MePanel'
import { AuthCard } from '@/components/AuthCard'
import { ResumeQuestionMaker } from '@/components/ResumeQuestionMaker'
import type { Candidate } from '@/lib/streak/suggest'

/**
 * 내 기록.
 *
 * **계정이 없어도 누적은 보여줄 수 있다.** 무엇을 봤는지는 이미 브라우저에
 * 남아 있고(`journey`), 언제 봤는지는 이번에 따로 적기 시작했다(`streak`).
 * 로그인을 기다릴 이유가 없다.
 *
 * 서버가 하는 일은 **고를 후보 목록을 넘기는 것**뿐이다. 무엇을 팠는지는
 * 서버가 모르므로 거르는 일은 화면에서 한다.
 *
 * 목록을 통째로 넘기는 것이 아깝지만, 질문 하나가 제목과 번호뿐이라 300개라도
 * 20KB 안쪽이다. 추천을 서버에서 하려면 이 사람이 무엇을 봤는지 서버가 알아야
 * 하고, 그건 계정 없이 하고 싶지 않은 일이다.
 */
export const metadata: Metadata = {
  title: '마이페이지',
  description: '내 경험에서 맞춤 질문을 만들고 학습 기록을 확인합니다.',
}

export const dynamic = 'force-dynamic'

export default async function MePage() {
  await ensureSeeded()
  const db = await getDb()

  /*
   * 목록·지도와 같은 기준으로 고른다 -- 파일에 담겼고(`batch`) 발행일이 지난 것.
   * 여기만 다른 기준을 쓰면 추천을 눌렀는데 목록에는 없는 질문이 나온다.
   */
  const rows = await db.query<Candidate>(
    `select n.id, n.number, n.normalized_question as question, n.primary_category as category
       from qnode n
       left join tree t
              on t.root_node_id = n.id
             and t.kind = 'daily'
      where n.status = 'ready'
        and n.origin = 'batch'
        and n.body <> ''
        and n.number is not null
        and (t.publish_date is null or t.publish_date <= $1::date)
      order by n.number asc`,
    [kstToday()],
  )

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">마이페이지</h1>
      <p className="mt-2 text-muted">
        내 경험에서 질문을 만들고, 지금까지의 학습 기록을 이어 보세요.
      </p>

      <div className="mt-8">
        <ResumeQuestionMaker />
      </div>

      <section id="account" className="mt-10 scroll-mt-24" aria-labelledby="account-title">
        <h2 id="account-title" className="mb-3 text-lg font-semibold">계정</h2>
        <AuthCard />
      </section>

      <div className="mt-10 border-t border-line pt-10">
        <MePanel all={rows} />
      </div>

      <p className="mt-10 text-sm text-muted">
        지금까지 올라온 질문은 {rows.length}개입니다.{' '}
        <Link href="/questions">질문 목록</Link>에서 직접 골라도 됩니다. 무엇을 저장하는지는{' '}
        <Link href="/privacy">개인정보처리방침</Link>에 적어 두었습니다.
      </p>
    </main>
  )
}
