import type { Metadata } from 'next'
import { StudyDesk } from '@/components/library/StudyDesk'
import classifications from '../../../../learning-content/engineer/classification-reviews.json'
import { LibraryProgress } from '@/components/library/LibraryProgress'
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: '모든 학습 기록',
  description:
    'CS·PMP·Jira·정보관리기술사의 이어보기와 복습을 한곳에서 확인합니다.',
}
export default function ProgressPage() {
  return (
    <StudyDesk>
      <LibraryProgress
        questionTitles={Object.fromEntries(
          classifications.reviews.map((q) => [q.id, q.core.join(' · ')]),
        )}
      />
    </StudyDesk>
  )
}
