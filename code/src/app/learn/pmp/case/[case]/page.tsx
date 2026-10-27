import { notFound } from 'next/navigation'
import Link from 'next/link'
import { LibraryShell } from '@/components/library/LibraryShell'
import { PmpPractice } from '@/components/pmp/PmpPractice'
import { pmpCourse, nativePmpHtml } from '@/lib/pmp/course'
export function generateStaticParams() {
  return pmpCourse.cases.map((c) => ({ case: c.id }))
}
export default async function PmpCase({
  params,
}: {
  params: Promise<{ case: string }>
}) {
  const { case: id } = await params,
    c = pmpCourse.cases.find((c) => c.id === id)
  if (!c) notFound()
  return (
    <LibraryShell
      reading
      eyebrow="PMP · 연결 사례"
      title={c.title}
      description={c.context}
    >
      <div className="pmp-lesson">
        {c.questions.map((q) => (
          <PmpPractice key={q.id} id={q.id} />
        ))}
        <details className="pmp-original">
          <summary>사례 해설 펼치기</summary>
          <div
            className="pmp-supplement"
            dangerouslySetInnerHTML={{ __html: nativePmpHtml(c.debrief) }}
          />
        </details>
      </div>
      <Link href="/learn/pmp">PMP 목차로 →</Link>
    </LibraryShell>
  )
}
