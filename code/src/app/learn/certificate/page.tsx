import { learningMetadata } from '@/lib/seo/learning'
import { LearningSeo } from '@/components/library/LearningSeo'
import { CertificateSyllabus } from '@/components/certificate/CertificateSyllabus'
import { LibraryShell } from '@/components/library/LibraryShell'
import { CertificateBackup } from '@/components/certificate/CertificateBackup'
import { CertificateTable } from '@/components/certificate/CertificateTable'
import { certificate as c } from '@/lib/certificate/course'
export const metadata = learningMetadata('/learn/certificate')
export default function CertificatePage() {
  return (
    <LibraryShell
      eyebrow="정보처리기사 · 이론"
      title="정보처리기사 이론·출제기준 목차"
      description={c.intro}
    >
      <LearningSeo path="/learn/certificate" />
      <CertificateSyllabus />
      <section className="pmp-lesson">
        <h2>DB·SQL 공통 예제 데이터</h2>
        <p>
          모든 값은 학습을 위해 만든 예시예요. 실제 회원이나 대출 데이터가
          아니에요. DB·SQL 수업은 아래 초기 상태에서 시작해요. 테스트 수업의
          대출 기간·입력 계약은 각 수업에서 따로 정한 가상 규칙이에요. 주소
          수업은 문서 예제용 블록으로 만든 가상 열람실을 사용해요.
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
