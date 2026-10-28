import { learningMetadata } from '@/lib/seo/learning'
import { LearningSeo } from '@/components/library/LearningSeo'
import Link from 'next/link'
import { LibraryShell } from '@/components/library/LibraryShell'
import { pmpCourse, pmpLessonHref } from '@/lib/pmp/course'
export const metadata = learningMetadata('/learn/pmp/terms')
export default function Terms() {
  return (
    <LibraryShell
      eyebrow="PMP · 용어집"
      title="PMP 용어집"
      description="한 줄 뜻을 확인하고, 연결된 수업에서 맥락을 함께 읽습니다."
    >
      <LearningSeo path="/learn/pmp/terms" />
      <dl className="pmp-glossary">
        {pmpCourse.glossary.map((g) => (
          <div key={g.en}>
            <dt>
              {g.en} <span>{g.ko}</span>
            </dt>
            <dd>
              <p>{g.body}</p>
              <div>
                {g.nodes.map((id) => (
                  <Link key={id} href={pmpLessonHref(id)}>
                    {pmpCourse.nodes.find((n) => n.id === id)?.title} →
                  </Link>
                ))}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </LibraryShell>
  )
}
