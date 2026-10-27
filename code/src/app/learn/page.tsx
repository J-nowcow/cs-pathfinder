import type { Metadata } from 'next'
import { StudyDesk } from '@/components/library/StudyDesk'
import { LibraryProgress } from '@/components/library/LibraryProgress'
import classifications from '../../../learning-content/engineer/classification-reviews.json'

export const metadata: Metadata = {
  title: '내 서재 · PM 이론·CS 이론·자격증 대비',
  description:
    '읽던 자료를 이어 보고 PM 이론·CS 이론·자격증 대비 중 공부할 내용을 고릅니다.',
}

/** 학습 기록은 브라우저에서 읽고 자료 목록은 서버에서도 렌더링한다. */
export default function LearningPage() {
  return (
    <StudyDesk section="library">
      <LibraryProgress
        mode="shelf"
        questionTitles={Object.fromEntries(
          classifications.reviews.map((q) => [q.id, q.core.join(' · ')]),
        )}
      />
    </StudyDesk>
  )
}
