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
      eyebrow="ONE PLACE · YOUR NEXT STEP"
      title="흩어진 공부, 이어서 한 걸음."
      description="현재 사이트·현재 브라우저에 있는 CS·PMP·Jira·기술사 기록을 모아 봅니다. 각 분야의 원래 진도를 보존하며, 로그인 계정 통합이나 기기 간 자동 동기화가 새로 생기는 것은 아닙니다."
    >
      <LibraryProgress />
    </LibraryShell>
  )
}
