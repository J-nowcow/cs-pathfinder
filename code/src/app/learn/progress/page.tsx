import type { Metadata } from 'next'
import { LibraryShell } from '@/components/library/LibraryShell'
import { LibraryProgress } from '@/components/library/LibraryProgress'
export const metadata: Metadata = {
  title: '모든 학습 기록',
  description:
    'CS·PMP·Jira·정보관리기술사의 이어보기와 복습을 한곳에서 확인합니다.',
}
export default function ProgressPage() {
  return (
    <LibraryShell
      eyebrow="학습 기록"
      title="이어서 공부하기"
      description="마지막으로 공부한 내용과 복습 날짜를 확인합니다. 이 화면은 현재 브라우저에 저장된 기록을 보여줍니다."
    >
      <LibraryProgress />
    </LibraryShell>
  )
}
