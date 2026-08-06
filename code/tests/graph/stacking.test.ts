import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MAP_OVERLAY_Z,
  REACT_FLOW_RENDERER_Z,
  REACT_FLOW_CONTROLS_Z,
} from '@/lib/graph/stacking'

/**
 * 지도에서 점을 눌렀을 때 실제로 눌리는가.
 *
 * 이 값이 모자라면 클릭이 전부 `.react-flow__pane`에 먹혀 아무 일도 안
 * 일어난다. **화면으로는 멀쩡해 보인다** — 점이 보이고 커서도 바뀐다.
 * 그래서 한 번 고쳤다고 착각하고 넘어갔던 자리다(시트에 본문을 붙이는
 * 작업을 했는데, 시트가 열리지 않으니 탈 일이 없었다).
 *
 * 쌓임 순서는 브라우저가 계산하는 것이라 happy-dom에서 재현되지 않는다.
 * 그래서 여기서는 **불변식만** 지킨다. 진짜 확인은 브라우저에서
 * `document.elementFromPoint(점 중앙)`이 우리 버튼을 돌려주는지 보는 것이다.
 */
describe('지도 겹 쌓임', () => {
  it('React Flow 렌더러보다 위다', () => {
    expect(MAP_OVERLAY_Z).toBeGreaterThan(REACT_FLOW_RENDERER_Z)
  })

  /*
   * 컨트롤보다도 위여야 한다. 아래로 내리면 컨트롤이 덮은 자리의 점이
   * 다시 안 눌린다. 겹 자체는 pointer-events-none이라 컨트롤은 계속 눌린다.
   */
  it('React Flow 컨트롤보다 위다', () => {
    expect(MAP_OVERLAY_Z).toBeGreaterThan(REACT_FLOW_CONTROLS_Z)
  })

  /*
   * 값만 있고 안 쓰면 소용이 없다. 겹에 실제로 걸려 있는지 본다.
   *
   * 소스를 읽는 시험이라 무르다. 그래도 이 결함이 정확히 "클래스 하나가
   * 빠진 것"이었고 다른 어떤 시험으로도 안 잡혔다.
   */
  it('GraphMap의 겹에 실제로 걸려 있다', () => {
    const src = readFileSync(new URL('../../src/components/GraphMap.tsx', import.meta.url), 'utf8')
    const overlay = src.match(/className="pointer-events-none absolute inset-0[^"]*"[\s\S]{0,120}/)
    expect(overlay).not.toBeNull()
    expect(overlay![0]).toContain('MAP_OVERLAY_Z')
  })
})
