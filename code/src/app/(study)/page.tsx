import { learningMetadata } from '@/lib/seo/learning'
import { LearningSeo } from '@/components/library/LearningSeo'
import type { Metadata } from 'next'
import Link from 'next/link'
import { StudyDesk } from '@/components/library/StudyDesk'
import { LearningAreas } from '@/components/LearningAreas'
import { OpenBookArt } from '@/components/library/BookArt'

export const metadata = learningMetadata('/')

export default function LearningPage() {
  return (
    <StudyDesk section="home" document>
      <LearningSeo path="/" />
      <section className="desk-home-intro" aria-labelledby="home-heading">
        <div>
          <p className="desk-kicker">PM 이론 · CS 이론 · 자격증 대비</p>
          <h1 id="home-heading">PM·CS 학습 길라잡이</h1>
          <p className="desk-home-lead">
            개념을 읽고 사례로 이해하고 직접 설명해 보세요.
            공부할 분야를 고르면 수업과 연습으로 이어집니다.
          </p>
          <div className="desk-home-actions">
            <a href="#desk-shelf-title" className="desk-primary">학습 분야 고르기 <span aria-hidden="true">↓</span></a>
            <Link href="/learn/library" prefetch={false}>내 서재 열기 <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <div className="desk-home-art"><OpenBookArt /></div>
      </section>
      <LearningAreas />
      <section className="desk-home-return" aria-labelledby="home-cases-heading">
        <div>
          <h2 id="home-cases-heading">같은 장애, 역할마다 다른 판단</h2>
          <p>GitHub 공개 사례를 읽고 개발자·프로젝트 PM·제품 PM의 관점으로 판단을 연습해 보세요.</p>
        </div>
        <Link href="/learn/cases" prefetch={false}>사례 연습 시작하기 →</Link>
      </section>
      <section className="desk-home-return" aria-labelledby="home-return-heading">
        <div>
          <h2 id="home-return-heading">읽던 자료는 내 서재에서</h2>
          <p>최근에 읽은 자료와 작성 중인 답안을 이어 보고 복습·백업을 열 수 있습니다.</p>
        </div>
        <Link href="/learn/library" prefetch={false}>내 서재로 가기 →</Link>
      </section>
    </StudyDesk>
  )
}
