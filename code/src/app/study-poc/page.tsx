import type { Metadata } from 'next'
import { StudyLessonContent } from '@/components/study-poc/StudyLessonContent'
import './study-poc.css'

export const metadata: Metadata = {
  title: 'DB 연결부터 트랜잭션·락·대기까지',
  description: '연결과 풀을 익히고 트랜잭션·행 잠금·연결 대기를 조건별로 살펴봅니다.',
  robots: { index: false, follow: false },
}

export default function StudyPocPage() {
  return <StudyLessonContent />
}
