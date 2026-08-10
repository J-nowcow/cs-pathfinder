import type { MetadataRoute } from 'next'

/**
 * 홈 화면에 추가할 수 있게 한다.
 *
 * 재방문 장치가 문자 그대로 0개였다. 첫 조각으로 홈에 "파던 자리로 돌아가는
 * 줄"을 놓았고(`ResumeLine`), 이것이 두 번째다. 둘 다 서버가 할 일이 없다.
 *
 * **아이콘이 없으면 manifest는 있으나 마나다.** 크롬은 192px 이상이 하나도
 * 없으면 설치를 권하지 않는다. 지금 있던 것은 favicon 48·apple-icon 180이라
 * 둘 다 못 미쳤다. `icon.svg`를 512로 그려 넣었다(`public/icons/`).
 *
 * `purpose`를 나눠 적는다.
 * - `any` — 아이콘을 준 모양 그대로 쓴다. 둥근 모서리가 살아 있다
 * - `maskable` — 안드로이드가 제 테마에 맞춰 원이나 사각형으로 **잘라낸다.**
 *   같은 그림을 주되 이 뜻으로도 쓰라고 알린다. 마크가 가운데 62%에만 있어서
 *   원으로 깎여도 안 잘린다
 *
 * `display: standalone` — 주소창 없이 앱처럼 뜬다. `fullscreen`은 안 쓴다.
 * 상태 표시줄까지 먹으면 시계와 배터리가 사라져 학습 중에 불편하다.
 *
 * 화면 방향은 안 고정한다. 도식이 가로에서 더 잘 보이는 것도 있다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CS 길라잡이',
    /* 홈 화면 아이콘 아래에 들어가는 이름. 길면 잘린다 */
    short_name: 'CS 길라잡이',
    description: '하루에 CS 면접 질문 하나. 궁금한 곳으로 파고들면 판 만큼 지도가 남습니다.',
    start_url: '/',
    display: 'standalone',
    /*
     * 뜨는 동안 보이는 색.
     *
     * **manifest는 값을 하나만 받는다.** 사이트는 `prefers-color-scheme`로
     * 밝고 어두운 두 벌을 쓰는데(`globals.css`) 여기에는 그 구분이 없다.
     * 미디어 질의를 받는 것은 주소창 쪽(`layout.tsx`의 `viewport.themeColor`)
     * 뿐이고 거기는 둘 다 넣었다.
     *
     * 그래서 **CSS의 기본값**인 밝은 쪽을 쓴다. 어두운 값은 미디어 질의 안에
     * 있으니 그쪽이 조건이고 이쪽이 기본이다. 아이콘 배경(`#0d1114`)과는
     * 다른 값이다 — 그건 마크가 어느 테마에서도 뜨게 하려고 따로 고른 색이다.
     */
    background_color: '#f3f5f6',
    theme_color: '#f3f5f6',
    lang: 'ko',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
