import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CS 질문 트리',
  description: 'CS 면접 질문을 하나 받고 꼬리질문을 무한히 파고든다. 파고든 관계가 지도로 남는다.',
}

// 모바일이 기준이다. 카톡 링크를 타고 들어오니 첫 방문은 대부분 폰이다.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
