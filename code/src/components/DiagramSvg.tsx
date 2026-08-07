import type { FlowStep, TreeNode } from '@/lib/markdown/blocks'

/**
 * 진짜 그림으로 그리는 시안.
 *
 * 지금 도식은 전부 **박스와 목록**이다. 순서는 번호 붙은 줄, 상태는 중첩 목록,
 * 트리는 들여쓰기. 뜻은 통하는데 "그림"은 아니라서, 몇 편 열어본 사람이
 * "죄다 표뿐"이라고 느낀다. 실제로 레포 파일 기준 표 188 · 목록 71 · 그림 0이다.
 *
 * **금지된 것은 SVG가 아니라 SVG 문자열을 `innerHTML`로 넣는 경로다.** 여기는
 * JSX로 요소를 만든다. 마크업을 우리 코드가 만들고 모델은 여전히 텍스트만 쓰므로
 * 주입될 자리가 없다.
 *
 * **그림을 DB에 저장하지 않는다.** 울타리에 구조가 이미 있어서 그릴 때마다
 * 만들면 된다. 저장하면 테마를 못 따라가고(밝은/어두운 두 벌이다), 글자가
 * 선택되지 않고, 디자인을 바꿀 때 257편을 다시 렌더해야 한다.
 *
 * 색은 기존 토큰만 쓴다. `currentColor`와 CSS 변수로 받으므로 테마가 바뀌면
 * 그림도 같이 바뀐다.
 *
 * **그림만으로 뜻이 전해지면 안 된다.** `<title>`과 숨긴 글로 낭독기가 읽을
 * 것을 남긴다.
 */

/** 폰 390px에서 좌우 여백을 뺀 폭. 이 좌표계로 그리고 CSS로 늘린다 */
const W = 320

/**
 * 순서 — 생명선과 화살표.
 *
 * 번호 목록과 다른 점은 **누가 누구에게**가 자리로 보인다는 것이다. 목록에서는
 * `클라 → 서버`를 매줄 읽어야 하는데, 여기서는 화살표가 어느 기둥에서 어느
 * 기둥으로 가는지가 한눈에 들어온다. 왕복이 많은 핸드셰이크에서 특히 다르다.
 */
export function FlowSvg({ steps }: { steps: FlowStep[] }) {
  /* 나온 순서대로 행위자를 모은다. 대개 둘이고 셋을 넘으면 폰에서 좁다 */
  const actors: string[] = []
  for (const s of steps) {
    for (const who of [s.from, s.to]) if (!actors.includes(who)) actors.push(who)
  }

  const cols = actors.length
  const laneW = W / cols
  const x = (who: string) => laneW * (actors.indexOf(who) + 0.5)

  const HEAD = 34
  const GAP = 52
  const height = HEAD + steps.length * GAP + 12

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised px-3 py-3">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full"
        style={{ maxHeight: height * 1.4 }}
        role="img"
      >
        <title>{`${actors.join('과 ')} 사이의 순서 ${steps.length}단계`}</title>

        <defs>
          <marker id="arw" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--d0)" />
          </marker>
        </defs>

        {actors.map((a) => (
          <g key={a}>
            {/* 기둥 이름 */}
            <text
              x={x(a)}
              y={14}
              textAnchor="middle"
              fontSize="11"
              fill="var(--muted)"
              className="font-sans"
            >
              {a.length > 9 ? `${a.slice(0, 8)}…` : a}
            </text>
            {/* 생명선. 점선이라 "시간이 흐른다"로 읽힌다 */}
            <line
              x1={x(a)}
              y1={HEAD - 12}
              x2={x(a)}
              y2={height - 6}
              stroke="var(--line)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
          </g>
        ))}

        {steps.map((s, i) => {
          const y = HEAD + i * GAP + 14
          const from = x(s.from)
          const to = x(s.to)
          const back = to < from
          return (
            <g key={i}>
              <line
                x1={from}
                y1={y}
                x2={to}
                y2={y}
                stroke="var(--d0)"
                strokeWidth="1.5"
                markerEnd="url(#arw)"
              />
              {/* 이름표는 화살표 위에. 되돌아오는 화살표는 글자를 반대로 붙인다 */}
              <text
                x={(from + to) / 2}
                y={y - 7}
                textAnchor="middle"
                fontSize="11.5"
                fill="var(--ink)"
                className="font-sans"
              >
                {s.label.length > 26 ? `${s.label.slice(0, 25)}…` : s.label}
              </text>
              <text
                x={back ? to + 6 : from - 6}
                y={y + 4}
                textAnchor={back ? 'start' : 'end'}
                fontSize="10"
                fill="var(--faint)"
                className="font-mono"
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 그림을 못 보는 사람을 위해 같은 내용을 글로 남긴다 */}
      <ol className="sr-only">
        {steps.map((s, i) => (
          <li key={i}>{`${s.from}에서 ${s.to}로: ${s.label}`}</li>
        ))}
      </ol>
    </figure>
  )
}

/**
 * 상태 — 원과 화살표.
 *
 * 중첩 목록과 다른 점은 **돌아오는 길이 보인다**는 것이다. 목록에서는 `↩`
 * 기호로 표시할 수밖에 없는데, 그림에서는 화살표가 실제로 되돌아간다.
 * 원 상태와 재시도가 있는 상태 머신에서 차이가 크다.
 */
export function StateSvg({ steps }: { steps: FlowStep[] }) {
  const nodes: string[] = []
  for (const s of steps) {
    for (const who of [s.from, s.to]) if (!nodes.includes(who)) nodes.push(who)
  }

  const R = 24
  const GAP = 78
  const cx = 46
  const y = (n: string) => 30 + nodes.indexOf(n) * GAP
  const height = 30 + (nodes.length - 1) * GAP + R + 20

  /*
   * 화살표가 서로 안 겹치게 **선마다 다른 크기로 부풀린다.**
   *
   * 처음에 앞으로 가는 길과 되돌아오는 길에만 값을 나눴더니, 한 상태에서
   * 두 갈래가 나갈 때 둘이 같은 자리에 겹쳐 그려지고 이름표도 포개졌다.
   * 순번을 섞어 층을 만든다.
   */
  const bulge = (i: number, back: boolean) => (back ? 46 : 26) + (i % 2) * 22

  /*
   * 이름표가 겹치지 않게 아래로 밀어 둔다.
   *
   * 한 상태에서 두 갈래가 나가면 두 화살표의 가운데 높이가 거의 같다. 그대로
   * 두면 글자가 포개져 **둘 다 못 읽는다** — 실제로 "대기 시간이 지난다"와
   * "시험 요청이 실패한다"가 한 덩어리로 뭉쳤다.
   *
   * 앞의 것과 15px 안으로 붙으면 그만큼 내린다. 화살표에서 조금 떨어지지만
   * 읽을 수 있는 쪽이 낫다.
   */
  const labelY: number[] = []
  for (const s of steps) {
    const want = (y(s.from) + y(s.to)) / 2 + 4
    const prev = labelY.length > 0 ? labelY[labelY.length - 1] : -Infinity
    labelY.push(want - prev < 15 ? prev + 15 : want)
  }

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised px-3 py-3">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
        <title>{`상태 ${nodes.length}개와 전이 ${steps.length}개`}</title>

        <defs>
          <marker id="arw2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill="var(--d0)" />
          </marker>
        </defs>

        {steps.map((s, i) => {
          const y1 = y(s.from)
          const y2 = y(s.to)
          const back = nodes.indexOf(s.to) < nodes.indexOf(s.from)
          const b = bulge(i, back)

          /*
           * 원 가장자리에서 나가 원 가장자리로 들어간다. 앞으로 갈 때는
           * 아래에서 위로, 되돌아올 때는 위에서 아래로 붙인다.
           */
          const sy = back ? y1 - R : y1 + R
          const ey = back ? y2 + R : y2 - R
          const d = `M ${cx} ${sy} C ${cx + b} ${sy + (back ? -14 : 14)}, ${cx + b} ${ey + (back ? 14 : -14)}, ${cx} ${ey}`

          return (
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke="var(--d0)"
                strokeWidth="1.3"
                strokeDasharray={back ? '4 3' : undefined}
                markerEnd="url(#arw2)"
              />
              <text
                x={cx + b + 8}
                y={labelY[i]}
                fontSize="11"
                fill={back ? 'var(--faint)' : 'var(--muted)'}
                className="font-sans"
              >
                {s.label.length > 16 ? `${s.label.slice(0, 15)}…` : s.label}
              </text>
            </g>
          )
        })}

        {nodes.map((n) => (
          <g key={n}>
            <circle cx={cx} cy={y(n)} r={R} fill="var(--accent-soft)" stroke="var(--d0)" strokeWidth="1.2" />
            <text
              x={cx}
              y={y(n) + 4}
              textAnchor="middle"
              fontSize="11"
              fill="var(--ink)"
              className="font-sans"
            >
              {n.length > 4 ? `${n.slice(0, 3)}…` : n}
            </text>
          </g>
        ))}
      </svg>

      {/* 되돌아가는 길은 점선이다. 그림만으로 전해지면 안 되므로 글로도 남긴다 */}
      <ul className="sr-only">
        {steps.map((s, i) => (
          <li key={i}>{`${s.from}에서 ${s.to}로: ${s.label}`}</li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * 트리 — 부모와 자식을 잇는 선.
 *
 * 들여쓰기와 다른 점은 **어디에 붙었는지가 선으로 보인다**는 것이다. 깊이가
 * 셋이 되면 들여쓰기만으로는 형제인지 조카인지 세어야 한다.
 */
export function TreeSvg({ nodes }: { nodes: TreeNode[] }) {
  const ROW = 40
  const INDENT = 30
  const height = nodes.length * ROW + 12
  const xOf = (d: number) => 14 + d * INDENT

  /* 각 노드의 부모는 위쪽에서 가장 가까운 한 단계 얕은 노드다 */
  const parentOf = (i: number) => {
    for (let j = i - 1; j >= 0; j -= 1) if (nodes[j].depth === nodes[i].depth - 1) return j
    return -1
  }

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised px-3 py-3">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
        <title>{`${nodes[0]?.name ?? ''} 아래 ${nodes.length - 1}개가 붙은 트리`}</title>

        {nodes.map((n, i) => {
          const p = parentOf(i)
          if (p < 0) return null
          const x1 = xOf(nodes[p].depth) + 4
          const y1 = p * ROW + 22
          const x2 = xOf(n.depth) - 4
          const y2 = i * ROW + 22
          /* 세로로 내려왔다가 가로로 꺾는다. 파일 트리와 같은 모양이라 익숙하다 */
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`}
              fill="none"
              stroke="var(--line)"
              strokeWidth="1.2"
            />
          )
        })}

        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={xOf(n.depth)} cy={i * ROW + 22} r="3.5" fill="var(--d0)" />
            <text
              x={xOf(n.depth) + 11}
              y={i * ROW + 20}
              fontSize="12"
              fill="var(--ink)"
              className="font-sans"
            >
              {n.name}
            </text>
            {n.note.length > 0 && (
              <text
                x={xOf(n.depth) + 11}
                y={i * ROW + 33}
                fontSize="10.5"
                fill="var(--muted)"
                className="font-sans"
              >
                {n.note.length > 30 ? `${n.note.slice(0, 29)}…` : n.note}
              </text>
            )}
          </g>
        ))}
      </svg>
    </figure>
  )
}
