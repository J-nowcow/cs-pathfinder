/**
 * 게시판 탭이 되는 대분류.
 *
 * 설계 §4가 확정한 10개다. 네 개 레포(gyoogle·WeareSoft·ksundong·VSFe)의 최상위
 * 목차를 교차해 만장일치 축을 먼저 잡고, 겹치는 것을 접어 만들었다.
 *
 * 시드 데이터의 category 컬럼이 이 문자열을 그대로 쓴다. 가운뎃점 주위의 공백까지
 * 같아야 필터가 맞는다. 한쪽만 고치면 그 탭이 조용히 빈다.
 *
 * 순서는 면접 출제 빈도 추정치 순이다(§4 시드 배분). 모바일에서 가로 스크롤로
 * 밀리는 뒤쪽일수록 덜 눌리는 자리라, 자주 찾는 것이 앞에 있어야 한다.
 */
export const CATEGORIES = [
  '데이터베이스',
  '네트워크',
  '언어 · 런타임',
  '운영체제',
  '자료구조 · 알고리즘',
  '프레임워크',
  '아키텍처 · 분산시스템',
  '프론트엔드',
  '인프라 · 보안',
  '모바일',
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * 주소에서 받은 카테고리를 거른다.
 *
 * 목록에 없는 값은 null로 떨어뜨려 필터 없는 전체 목록을 준다. 오타 하나에
 * 빈 게시판을 보여주느니 전체를 보여주는 편이 낫고, 임의 문자열이 그대로
 * 질의로 들어가는 것도 막는다.
 */
/**
 * 앵커용 id.
 *
 * 카테고리 이름에 공백과 가운뎃점이 있어서 그대로 쓰면 CSS 선택자와 URL 양쪽에서
 * 깨진다. 한글은 그대로 둔다 — 브라우저가 인코딩해 주고, 링크를 눌러본 사람이
 * 주소창에서 어디인지 알아볼 수 있다.
 *
 * 목록 화면이 이 id를 붙이고 푸터가 이 id로 보낸다. 두 곳이 각자 만들면 한쪽만
 * 바뀌었을 때 링크가 조용히 아무 데도 안 가게 된다.
 */
export function categoryAnchor(category: string): string {
  return `c-${category.replace(/\s*·\s*/g, '-').replace(/\s+/g, '-')}`
}

export function asCategory(value: string | null | undefined): Category | null {
  if (!value) return null
  return (CATEGORIES as readonly string[]).includes(value) ? (value as Category) : null
}
