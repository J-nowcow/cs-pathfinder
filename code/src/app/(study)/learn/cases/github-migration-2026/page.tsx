import type { Metadata } from 'next'
import { StudyDesk } from '@/components/library/StudyDesk'
import { CaseLesson } from '@/components/cases/CaseLesson'
import '@/app/case-learning.css'

export const metadata: Metadata = {
  title: '잘 돌던 작업을 멈춰야 할 때 — GitHub 사례',
  description: '공개 장애 사례의 근거로 판단을 구성하고 새로운 조건에 적용하는 학습 과제. 한국어·영어와 세 역할을 지원합니다.',
  alternates: { canonical: '/learn/cases/github-migration-2026' },
}

export default function MigrationCasePage() {
  return <StudyDesk section="cases" document reading><CaseLesson /></StudyDesk>
}
