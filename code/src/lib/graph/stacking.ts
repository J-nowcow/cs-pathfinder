/**
 * 손으로 그린 겹이 React Flow 위에 오게 하는 값.
 *
 * 이 값이 모자라면 **점을 눌러도 아무 일이 안 일어난다.** 화면에는 점이
 * 멀쩡히 보이고 커서도 바뀌므로 눈으로는 정상이다. 실제로 그 좌표에서
 * `document.elementFromPoint`를 찍어야 드러난다 — 잡히는 것이 우리 버튼이
 * 아니라 `.react-flow__pane`이다. 클릭이 전부 팬(드래그) 레이어에 먹힌다.
 *
 * 겹은 DOM에서 렌더러보다 **뒤에** 있는데도 진다. 위치를 잡은 형제끼리는
 * DOM 순서보다 z-index가 먼저라, `z-index: auto`는 양수를 못 이긴다.
 */

/** React Flow가 `.react-flow__renderer`에 박는 값. 라이브러리 스타일시트에 있다 */
export const REACT_FLOW_RENDERER_Z = 4
/** `.react-flow__controls`에 박는 값 */
export const REACT_FLOW_CONTROLS_Z = 5

/**
 * 우리 겹의 z-index.
 *
 * 컨트롤(5)보다도 위다. 그래도 컨트롤은 계속 눌린다 — 이 겹 자체는
 * `pointer-events-none`이라 클릭을 통과시키고, 점과 카드만 `auto`로 받는다.
 */
export const MAP_OVERLAY_Z = 10
