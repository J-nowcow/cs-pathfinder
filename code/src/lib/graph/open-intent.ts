/**
 * 지도에서 질문을 누를 때, 여기서 열 것인가 새 탭으로 보낼 것인가.
 *
 * 지도의 점과 카드는 `<button>`이었다. 누르면 아래에서 시트가 올라오고 해설이
 * 통째로 들어 있으니 화면상으로는 부족한 것이 없었다. 그런데 버튼이라서
 * 없어지는 것이 셋이다.
 *
 * - **새 탭으로 못 연다.** cmd·ctrl을 눌러도, 가운데 버튼으로 눌러도 그냥
 *   시트가 뜬다. 지도는 여러 개를 훑는 화면이라 "이건 나중에 볼게"가 자연스러운데
 *   그 길이 없다.
 * - **주소가 안 보인다.** 링크 위에 올리면 뜨는 그 주소가 안 뜬다.
 * - **크롤러가 못 따라간다.** `/questions`와 sitemap이 있어 고립은 아니지만
 *   지도에서 나가는 길은 끊겨 있다.
 *
 * `<a href="/q/…">`로 바꾸고 **평범한 클릭만 가로챈다.** 그러면 지금 동작은
 * 그대로고 위 셋이 생긴다.
 *
 * 브라우저가 새 탭·새 창으로 여는 조건을 그대로 흉내 낸다. 하나라도 빠뜨리면
 * 사용자가 기대한 동작이 조용히 안 먹는다.
 */
export type ClickIntent = {
  /** 0=왼쪽, 1=가운데(휠), 2=오른쪽 */
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/**
 * 브라우저에게 맡겨야 하는 클릭인가.
 *
 * `true`면 `preventDefault`를 부르지 않는다 — 브라우저가 새 탭·새 창·다운로드
 * 중 제 할 일을 한다.
 *
 * - 가운데 버튼: 새 탭 (맥·윈도 공통)
 * - cmd(맥)·ctrl(윈도): 새 탭
 * - shift: 새 창
 * - alt: 다운로드 (맥에서 option+클릭)
 *
 * 오른쪽 버튼은 애초에 `click` 이벤트를 안 만들지만, 다른 곳에서 이 함수를
 * 쓸 수도 있어 같이 넘긴다.
 */
export function wantsBrowserDefault(e: ClickIntent): boolean {
  if (e.button !== 0) return true
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}
