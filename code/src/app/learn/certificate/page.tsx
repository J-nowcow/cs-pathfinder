import Link from 'next/link'
import { LibraryShell } from '@/components/library/LibraryShell'
import { CertificateBackup } from '@/components/certificate/CertificateBackup'
import { CertificateTable } from '@/components/certificate/CertificateTable'
import { certificate as c, certificateHref } from '@/lib/certificate/course'
export const metadata = {
  title: '정보처리기사 이론 · DB·SQL',
  description:
    '독립적인 도서관 예제로 배우는 관계 모델·정규화·SQL. 기출과 복원 코드는 포함하지 않습니다.',
}
export default function CertificatePage() {
  return (
    <LibraryShell
      eyebrow="정보처리기사 · 이론"
      title="표를 읽고, 데이터의 규칙을 이해하는 공부."
      description={c.intro}
    >
      <section className="pmp-catalog-intro">
        <p className="study-meta">
          {c.scope} · {c.lessons.length}수업
        </p>
        <Link className="desk-primary" href={certificateHref(c.lessons[0].id)}>
          첫 수업 읽기 →
        </Link>
      </section>
      <section className="pmp-chapter-list" aria-label="정처기 이론 목차">
        {c.lessons.map((n, i) => (
          <section key={n.id}>
            <p className="study-meta">
              {String(i + 1).padStart(2, '0')} · DB·SQL
            </p>
            <h2>
              <Link href={certificateHref(n.id)}>{n.title} →</Link>
            </h2>
            <p>{n.question}</p>
          </section>
        ))}
      </section>
      <section className="pmp-lesson">
        <h2>수업을 잇는 작은 도서관</h2>
        <p>
          모든 값은 학습을 위해 만든 예시예요. 실제 회원이나 대출 데이터가
          아니에요. SQL 예제는 수업마다 이 초기 상태에서 시작해요.
        </p>
        <CertificateTable caption="books · 책 4권" {...c.books} />
        <CertificateTable caption="loans · 대출 이력 3건" {...c.loans} />
        <p>
          서가 표 shelves에는 DB와 SW가 있어요. 쪽수와 서가코드의 NULL은 아직
          값이 없음을 표시해요.
        </p>
      </section>
      <CertificateBackup />
      <details className="desk-utility">
        <summary>자료의 범위와 출처</summary>
        <p>{c.origin.policy}</p>
        <ul>
          {c.limits.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          정보관리기술사 답안 자료와 구분한 정보처리기사 이론이에요. 각 수업
          아래에서 참고한 1차 자료를 확인할 수 있어요.
        </p>
      </details>
    </LibraryShell>
  )
}
