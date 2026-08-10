import type { Metadata, Viewport } from 'next'
import { siteUrl } from '@/lib/site'
import './globals.css'

/*
 * 이름은 `CS 길라잡이`다.
 *
 * 전에는 서비스가 하는 일을 그대로 제목에 썼다(`꼬리에 꼬리를 무는 CS 공부`).
 * 설명으로는 좋지만 이름 노릇을 못 한다 — 카톡에 붙었을 때 한 줄이 다 차고,
 * 사람이 입에 올려 부를 수가 없다. 설명은 아래 DESCRIPTION이 이미 한다.
 */
const TITLE = 'CS 길라잡이'
const DESCRIPTION = '하루에 질문 하나. 어디로 파고들지는 직접 고르면 됩니다. 판 만큼 지도가 그려집니다.'

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
  /*
   * 읽기 도구가 주소만 넣어도 피드를 찾게 한다. 이 줄이 없으면 사용자가
   * `/rss.xml`을 직접 알고 쳐야 한다 — 대부분 그러지 않는다.
   */
  alternates: { types: { 'application/rss+xml': '/rss.xml' } },
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
  /*
   * 폰 브라우저의 주소창 색.
   *
   * 지금까지 아무 값도 안 줘서 사이트는 어두운데 주소창만 흰 띠로 남았다.
   * `globals.css`가 `prefers-color-scheme`로 갈리므로 여기도 둘로 준다 —
   * 하나만 주면 반대 테마에서 오히려 더 튄다.
   *
   * 값은 `--surface`와 같아야 한다. 다르면 화면 위쪽에 경계선이 생긴다.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f6' },
    { media: '(prefers-color-scheme: dark)', color: '#101317' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
