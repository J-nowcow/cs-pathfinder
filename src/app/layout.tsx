import type { Metadata, Viewport } from 'next'
import { siteUrl } from '@/lib/site'
import './globals.css'

const TITLE = '꼬리에 꼬리를 무는 CS 공부'
const DESCRIPTION = '하루에 질문 하나. 어디로 파고들지는 직접 고르면 돼요. 판 만큼 지도가 그려지고요.'

/**
 * OG 태그는 장식이 아니라 유입 경로다.
 *
 * 이 서비스는 카톡방에서 출발했고 공유가 핵심 기능이라, 링크를 붙였을 때
 * 제목·설명이 안 뜨면 아무도 안 누른다. Streamlit을 배제한 결정적 이유가 이거였다.
 */
export const metadata: Metadata = {
  // 상대 경로로 쓴 OG 이미지를 절대 주소로 펴는 기준. 없으면 Next가 추론하는데
  // 프로덕션에서 배포마다 바뀌는 임시 주소가 박힌다(lib/site.ts)
  metadataBase: siteUrl(),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
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
