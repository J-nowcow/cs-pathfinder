/**
 * 히어로 배경 그래프.
 *
 * 카피는 "지도가 남는다"를 말하지 않는다. 히어로 부제에 정보를 셋 넣으면
 * 하나도 안 읽히기 때문이다. 그 몫을 이 배경이 진다.
 *
 * 장식이 아니라 설명이라서 노드와 엣지 모양이 실제 여정 트리를 닮아야 한다.
 * 왼쪽 뿌리 하나에서 오른쪽으로 갈라지며 뻗는다.
 */
const NODES = [
  { x: 18, y: 62, r: 4.5 },
  { x: 78, y: 40, r: 3.5 },
  { x: 82, y: 92, r: 3.5 },
  { x: 146, y: 22, r: 3 },
  { x: 152, y: 62, r: 3 },
  { x: 150, y: 112, r: 3 },
  { x: 214, y: 44, r: 2.5 },
  { x: 220, y: 86, r: 2.5 },
  { x: 226, y: 132, r: 2.5 },
  { x: 286, y: 28, r: 2 },
  { x: 292, y: 66, r: 2 },
  { x: 298, y: 108, r: 2 },
  { x: 358, y: 50, r: 1.8 },
  { x: 364, y: 92, r: 1.8 },
]

const EDGES: Array<[number, number]> = [
  [0, 1], [0, 2],
  [1, 3], [1, 4],
  [2, 5],
  [3, 6], [4, 7], [5, 8],
  [6, 9], [7, 10], [8, 11],
  [9, 12], [10, 13],
]

export function HeroBackdrop() {
  return (
    <svg
      viewBox="0 0 400 160"
      aria-hidden
      className="pointer-events-none absolute right-0 top-0 h-[160px] w-[400px] max-w-full"
    >
      {/*
        선과 점만 흐리게 깐다. 예전에는 svg 전체에 opacity를 걸었는데,
        그러면 아래 두더지까지 같이 흐려진다.
      */}
      <g className="opacity-[0.16]">
        {EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={NODES[a].x}
            y1={NODES[a].y}
            x2={NODES[b].x}
            y2={NODES[b].y}
            stroke="currentColor"
            strokeWidth={1}
          />
        ))}
        {NODES.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="currentColor" />
        ))}
      </g>

      {/*
        두더지를 뿌리 노드(18,62) 자리에 앉힌다.
        "여기서 파서 오른쪽으로 뻗었다"가 되어 배경이 설명하는 바가 또렷해진다.
        같은 좌표계 안이라 화면이 줄어도 그래프와 같이 줄고 어긋나지 않는다.

        **좁은 화면에서는 안 그린다.** svg가 줄면서 뿌리가 제목 쪽으로 밀려
        "오늘 질문부터"의 첫 글자를 덮었다. 폰에서 두더지는 오늘의 학습 카드가
        맡는다 — 거기는 가릴 글자가 없다.
      */}
      <image
        href="/mascot/mole-digging.png"
        x={-14}
        y={28}
        width={68}
        height={68}
        className="hidden sm:block"
      />
    </svg>
  )
}
