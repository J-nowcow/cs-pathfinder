import { describe, it, expect } from 'vitest'
import { socialMeta, SITE_NAME } from '@/lib/site'

/**
 * 공유 태그 한 벌.
 *
 * `title`을 안 내놓고 있었다. openGraph와 twitter만 채워서, 이걸 쓰는 화면은
 * 전부 브라우저 제목이 루트 기본값으로 떨어졌다 — `/questions`도 `/map`도
 * 탭 이름이 똑같이 `CS 길라잡이`였다. 탭을 여러 개 띄우면 구별이 안 된다.
 *
 * 이름을 바꿨을 때 네 곳에 옛 이름이 남은 것도 여기서 시작됐다. 페이지마다
 * 제목을 손으로 적고 있었다.
 */
describe('socialMeta', () => {
  it('브라우저 제목을 내놓는다', () => {
    expect(socialMeta({ title: '질문 지도', description: 'd' }).title).toBe('질문 지도')
  })

  /*
   * 루트의 `template`(`%s · 이름`)은 브라우저 제목에만 먹는다. 공유 카드에는
   * 안 붙어서, 카톡에 올렸을 때 어디서 온 링크인지가 안 보인다.
   */
  it('공유 카드 제목에는 서비스 이름을 직접 붙인다', () => {
    const m = socialMeta({ title: '질문 지도', description: 'd' })
    expect(m.openGraph.title).toBe(`질문 지도 · ${SITE_NAME}`)
    expect(m.twitter.title).toBe(`질문 지도 · ${SITE_NAME}`)
  })

  /* 페이지마다 이미지를 손으로 넣다가 두 번 빠뜨린 자리다 */
  it('공유 이미지를 늘 넣는다', () => {
    const m = socialMeta({ title: 't', description: 'd' })
    expect(m.openGraph.images.length).toBe(1)
    expect(m.twitter.images.length).toBe(1)
  })
})

/**
 * 옛 이름이 남지 않았는지.
 *
 * 이름을 `꼬꼬무 CS` → `CS 길라잡이`로 바꿨는데 리터럴 `꼬꼬무`는 0건인데도
 * 풀네임 `꼬리에 꼬리를 무는 CS 공부`가 네 곳에 남아 있었다. 검색어를 하나만
 * 잡으면 이렇게 샌다.
 */
describe('옛 이름', () => {
  it('서비스 이름은 한 곳에서만 온다', () => {
    expect(SITE_NAME).toBe('CS 길라잡이')
  })
})
