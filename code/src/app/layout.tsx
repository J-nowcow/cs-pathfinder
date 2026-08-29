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
const DESCRIPTION =
  '오늘의 CS 면접 질문에서 시작해 막힌 개념과 꼬리질문을 이어서 공부하는 취준생용 학습 지도.'

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
  /*
   * Search Console 소유권 인증. 값은 콘솔이 발급한다 — 코드에 박으면
   * 저장소가 공개라 상관은 없지만, 프로젝트 밖 값이라 env로 받는다.
   * env가 없으면 태그 자체가 안 나간다.
   */
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
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
   * 여기 media 조건은 **시스템 선호**만 볼 수 있어서, 사용자가 헤더에서 고른
   * 테마와는 어긋날 수 있다. 그래서 토글이 meta[name=theme-color]를 직접
   * 갱신한다(`ThemeToggle`). 여기 값은 그 전까지의 첫 화면용이다.
   *
   * 값은 `--surface`와 같아야 한다. 다르면 화면 위쪽에 경계선이 생긴다.
   */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#191512' },
  ],
}

/*
 * 그리기 전에 테마를 박는다.
 *
 * `globals.css`가 `data-theme`으로 갈리므로 이 속성이 없으면 시스템 다크
 * 사용자에게도 라이트가 나간다. 그래서 첫 픽셀보다 먼저 동기로 돌아야 한다.
 *
 * body의 첫 자식에 둔다. App Router에서 `<head>`를 직접 여는 것은 권장되지
 * 않고, 여기서는 파서가 만나는 즉시 동기로 돌기만 하면 되므로 이 자리가
 * 목적에 맞다.
 *
 * 저장값이 없으면 그때 시스템 선호를 읽는다. 즉 기본은 여전히 시스템을 따르고,
 * 사용자가 고른 뒤에만 그 선택이 이긴다.
 */
const THEME_BOOT = `(function(){try{var s=localStorage.getItem('csqt.theme');var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * 아래 부트 스크립트가 하이드레이션 전에 data-theme을 박는다. 리액트가
     * 서버에서 그린 <html>에는 그 속성이 없어 불일치로 잡히므로, 이 요소에
     * 한해 경고를 끈다. 끄지 않으면 매 방문마다 복구 불가 오류가 남는다.
     */
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}
      </body>
    </html>
  )
}
