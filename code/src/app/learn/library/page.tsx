import type { Metadata } from 'next'
import { StudyDesk } from '@/components/library/StudyDesk'
import { LibraryProgress } from '@/components/library/LibraryProgress'
import classifications from '../../../../learning-content/engineer/classification-reviews.json'

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: '내 서재 · 이어서 읽기',
  description: '읽던 자료와 작성 중인 답안을 이어 보고 복습할 내용을 확인합니다.',
}

export default function LibraryPage() {
  return (
    <StudyDesk section="library">
      <p className="desk-library-intro">읽던 자료와 내 기록을 이어 보세요.</p>
      <LibraryProgress
        mode="shelf"
        questionTitles={Object.fromEntries(
          classifications.reviews.map((q) => [q.id, q.core.join(' · ')]),
        )}
      />
    </StudyDesk>
  )
}
