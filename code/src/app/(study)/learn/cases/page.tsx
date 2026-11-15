import Link from 'next/link'
import type { Metadata } from 'next'
import { StudyDesk } from '@/components/library/StudyDesk'
import { translations, CASE_ID } from '@/lib/cases/content'

export const metadata: Metadata = {
  title: '사례로 판단 연습',
  description: '공개 사례의 근거를 읽고 개발자·프로젝트 PM·제품 PM의 판단을 비교하며 연습합니다.',
  alternates: { canonical: '/learn/cases' },
}

export default function CasesPage() {
  return <StudyDesk section="cases" document reading>
    <header className="desk-document-heading">
      <p className="study-meta">개발 · 프로젝트 · 제품</p>
      <h1>같은 사실, 다른 역할의 판단</h1>
      <p>공개된 사례에서 근거를 찾고 내 판단을 설명해 보세요. 설명을 읽은 뒤 조건이 달라진 과제로 이어집니다.</p>
    </header>
    <section>
      <p className="study-meta">01 · GitHub 장애 사례 · 한국어 / English</p>
      <h2><Link href={`/learn/cases/${CASE_ID}`}>{translations.ko.title} →</Link></h2>
      <p>문제없이 돌던 데이터베이스 변경 작업에 사용자 요청이 겹쳤습니다. 무엇을 확인하고 언제 멈춰야 할까요?</p>
      <p>개발자: 관측과 가설 · 프로젝트 PM: 중단·재개 조건 · 제품 PM: 사용자 영향과 회복</p>
    </section>
  </StudyDesk>
}
