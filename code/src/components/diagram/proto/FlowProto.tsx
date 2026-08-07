import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import type { FlowStep } from '@/lib/markdown/blocks'

/**
 * 흐름 도식 시안.
 *
 * 지금 `FlowDiagram`은 **간선을 상자로 그린다.** `A -> B: 설명` 한 줄이 한 행이
 * 되고, 그 행 안에 `A → B`가 작은 글씨로 들어간다. 그래서 여섯 단계짜리
 * 흐름에서 이름이 열 번 나오고, 화면은 번호 붙은 목록으로 읽힌다. "죄다 표뿐"이
 * 나온 자리가 여기다.
 *
 * 뒤집는다. **마디를 상자로, 설명을 화살표에 얹는다.** 이름은 한 번만 나오고
 * 사이는 선으로 이어진다. 그것이 순서도의 생김새다.
 *
 * 좌표를 손으로 계산하지 않는다. 반려된 `DiagramSvg`는 `y = HEAD + i * GAP`으로
 * 자리를 잡았고, 글자 길이를 모르니 이름표가 서로 포개졌다. 겹침을 막으려고
 * 넣은 보정(`bulge`, `labelY`)이 또 다른 겹침을 만들었다. 여기서는 높이를
 * 브라우저가 정한다 — 선은 `flex-1`로 늘어나고 되돌아감 괄호는 `inset-y-0`으로
 * 감싼 만큼 자란다. 계산할 좌표가 없으면 어긋날 좌표도 없다.
 *
 * 색은 기존 토큰만 쓴다. 깊이 램프(`--d1`~`--d5`)는 "몇 번 팠는지"를 뜻하므로
 * 손대지 않는다. 진행은 `accent`, 되돌아감은 `warn`이다.
 *
 * **그림만으로 뜻이 전해지지 않게 한다.** 선과 화살촉은 전부 `aria-hidden`이고,
 * 순서는 `<ol>`이, 갈림은 조건 글자가, 되돌아감은 "1번 «요청 보내기»"라는
 * 문장이 진다. 그림을 다 지워도 글로 읽힌다.
 */

/* 트렁크 선의 x 좌표. 화살표 기둥·엘보·분기 트렁크가 전부 이 값에 맞춰 선다 */
const RAIL = 9

/* 분기를 들여쓰는 단계. 390px에서 두 겹까지가 한계라 그 뒤로는 안 민다 */
const MAX_INDENT_DEPTH = 2

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => (
        <Fragment key={i}>
          {t.type === 'bold' ? (
            <strong className="font-semibold">{t.value}</strong>
          ) : t.type === 'code' ? (
            <code className="rounded bg-accent-soft px-1 py-0.5 font-mono text-[0.9em]">
              {t.value}
            </code>
          ) : (
            t.value
          )}
        </Fragment>
      ))}
    </>
  )
}

/* ---------------------------------------------------------------- 구조 만들기 */

type Jump = { to: string; toN: number; label: string; back: boolean }
type Item = { n: number; name: string; inLabel: string; terminal: boolean; fork: Branch[] | null }
type Branch = { label: string; track: Track }
type Track = { items: Item[]; jump: Jump | null }
type Shape = { tracks: Track[]; backTargets: Set<string> }

/**
 * 줄 목록을 그래프로 읽고 세로 한 줄기로 편다.
 *
 * **되돌아감과 합류를 가르는 것이 이 함수의 전부다.** 둘 다 "이미 나온 마디로
 * 간다"라서 방문 표시만으로는 구별이 안 된다. 나온 순서로 재는 방법도 틀린다 —
 * 캐시 미스 갈래가 캐시 히트 갈래의 `응답 반환`으로 합칠 때, 목표가 출발보다
 * 먼저 나왔다는 이유로 되돌아감이 된다. 되풀이가 아닌데 되풀이로 그려진다.
 *
 * 그래서 지금 내려온 길(`path`)을 따로 들고 다닌다. 목표가 그 길 위에 있으면
 * 되돌아감이고, 방문했지만 길 위에 없으면 다른 갈래로 합류하는 것이다.
 * 깊이 우선 탐색의 back edge 정의 그대로다.
 */
function build(steps: FlowStep[]): Shape {
  const order: string[] = []
  for (const s of steps) {
    for (const who of [s.from, s.to]) if (!order.includes(who)) order.push(who)
  }

  const outOf = (name: string) => steps.filter((s) => s.from === name)

  const num = new Map<string, number>()
  const visited = new Set<string>()
  const path = new Set<string>()
  const backTargets = new Set<string>()
  let counter = 0

  const jumpTo = (e: FlowStep): Jump => {
    const back = path.has(e.to)
    if (back) backTargets.add(e.to)
    return { to: e.to, toN: num.get(e.to) ?? 0, label: e.label, back }
  }

  function walk(start: string, depth: number): Track {
    const items: Item[] = []
    /* 이 줄기가 밟은 마디. 줄기가 끝나면 길에서 뺀다 */
    const mine: string[] = []
    let jump: Jump | null = null
    let cur = start
    /* 첫 마디의 이름표는 안 그린다. 줄기 첫머리는 위에 이어질 화살표가 없다 */
    let label = ''

    for (;;) {
      visited.add(cur)
      path.add(cur)
      mine.push(cur)
      counter += 1
      num.set(cur, counter)

      const outs = outOf(cur)
      const item: Item = {
        n: counter,
        name: cur,
        inLabel: label,
        terminal: outs.length === 0,
        fork: null,
      }
      items.push(item)

      if (outs.length === 0) break

      if (outs.length === 1) {
        const e = outs[0]
        if (visited.has(e.to)) {
          jump = jumpTo(e)
          break
        }
        label = e.label
        cur = e.to
        continue
      }

      /*
       * 갈래마다 새 줄기다. 앞 갈래가 먼저 걷고 나면 그 마디들은 `visited`에
       * 남지만 `path`에서는 빠지므로, 뒤 갈래가 같은 곳으로 가면 합류가 된다.
       */
      item.fork = outs.map((e) => ({
        label: e.label,
        track: visited.has(e.to)
          ? { items: [], jump: jumpTo(e) }
          : walk(e.to, depth + 1),
      }))
      break
    }

    for (const name of mine) path.delete(name)
    return { items, jump }
  }

  const tracks: Track[] = []
  if (order.length > 0) tracks.push(walk(order[0], 0))

  /*
   * 첫 마디에서 못 닿는 마디가 남을 수 있다. 모델이 흐름 두 개를 한 울타리에
   * 넣으면 그렇게 된다. 버리지 않고 별도 줄기로 뒤에 붙인다 — 도식이 조금
   * 어색해지는 편이 내용을 소리 없이 잃는 것보다 낫다.
   */
  for (const name of order) {
    if (!visited.has(name)) tracks.push(walk(name, 0))
  }

  return { tracks, backTargets }
}

/* ------------------------------------------------------------------- 그리기 */

/** 마디와 마디를 잇는 화살표. 이름표가 길어지면 선이 그만큼 늘어난다 */
function Connector({ label }: { label: string }) {
  return (
    <div className="flex min-h-[26px] items-stretch gap-2">
      <span className="sr-only">그다음{label.length > 0 ? ': ' : ''}</span>
      <div
        aria-hidden
        className="flex shrink-0 flex-col items-center"
        style={{ width: RAIL * 2 + 2 }}
      >
        <span className="w-0.5 flex-1 bg-accent" />
        <span className="h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-accent" />
      </div>
      {label.length > 0 && (
        <p className="self-center py-1 text-[13px] leading-[1.5] text-muted [overflow-wrap:anywhere] break-keep">
          <Inline text={label} />
        </p>
      )}
    </div>
  )
}

/**
 * 마디 상자.
 *
 * 번호는 장식이 아니다. 되돌아감 칩이 "1번 «요청 보내기»"라고 가리키므로 눈이
 * 그 상자를 찾아갈 열쇠다. 그래서 낭독기에서도 읽히게 둔다.
 */
function NodeBox({ item }: { item: Item }) {
  return (
    <div
      className={`flex items-baseline gap-2.5 rounded-lg border px-3.5 py-2.5 ${
        item.terminal ? 'border-accent bg-accent-soft' : 'border-line bg-raised'
      }`}
    >
      <span className="shrink-0 font-mono text-[11px] text-faint">
        {item.n}
        {/* 띄어쓰기가 없으면 낭독기가 "1번주소창 입력"을 한 덩어리로 읽는다 */}
        <span className="sr-only">번 </span>
      </span>
      <span className="text-[15px] font-medium leading-[1.5] text-ink [overflow-wrap:anywhere] break-keep">
        <Inline text={item.name} />
      </span>
    </div>
  )
}

/** 이미 나온 마디로 가는 간선. 되돌아감과 합류는 색과 말로 갈린다 */
function JumpChip({ jump }: { jump: Jump }) {
  return (
    <div
      className={`mt-2 flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 ${
        jump.back ? 'border-warn bg-warn-soft' : 'border-line bg-surface'
      }`}
    >
      <span aria-hidden className={`shrink-0 text-[13px] ${jump.back ? 'text-warn' : 'text-faint'}`}>
        {jump.back ? '↑' : '⇢'}
      </span>
      <p
        className={`text-[13px] leading-[1.5] [overflow-wrap:anywhere] break-keep ${
          jump.back ? 'text-warn' : 'text-muted'
        }`}
      >
        <span className="font-semibold">{jump.back ? '되돌아간다' : '합류한다'}</span>
        {` — ${jump.toN}번 «${jump.to}»`}
        {jump.label.length > 0 && (
          <>
            {'. '}
            <Inline text={jump.label} />
          </>
        )}
      </p>
    </div>
  )
}

/**
 * 되풀이 구간을 감싸는 점선 괄호.
 *
 * 되돌아가는 선을 200px 위로 그으려면 높이를 알아야 하는데, 글자가 몇 줄로
 * 접힐지는 브라우저만 안다. 그래서 **선을 긋는 대신 감싼다.** `inset-y-0`이라
 * 안에 무엇이 들어오든 딱 그만큼 자란다. 계산이 없으니 어긋날 것도 없다.
 */
function LoopWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pr-[26px]">
      <span
        aria-hidden
        className="absolute inset-y-0 right-[4px] w-[14px] rounded-r-[10px] border-y-2 border-r-2 border-dashed border-warn"
      />
      <span
        aria-hidden
        className="absolute right-[16px] top-[-5px] h-0 w-0 border-y-[5px] border-r-[7px] border-y-transparent border-r-warn"
      />
      <p className="mb-1.5 text-[11px] font-medium tracking-tight text-warn">되풀이 구간</p>
      {children}
    </div>
  )
}

/**
 * 갈림.
 *
 * 세로 화면에서 갈래를 가로로 벌릴 수는 없다. 대신 **왼쪽으로 트렁크를 내리고
 * 갈래마다 팔을 뻗는다.** 파일 탐색기와 같은 모양이라 따로 배울 것이 없다.
 *
 * 팔은 `border-b`와 `border-l`에 모서리를 둥글린 빈 칸 하나다. 좌표가 아니라
 * 고정 픽셀이라 글자가 몇 줄이 되든 자리가 안 틀어진다. 마지막 갈래만 트렁크를
 * 빼서 선이 아래로 새지 않게 한다.
 */
function ForkView({
  branches,
  depth,
  loopTargets,
}: {
  branches: Branch[]
  depth: number
  loopTargets: Set<string>
}) {
  const indent = depth < MAX_INDENT_DEPTH

  return (
    <div>
      <span aria-hidden className="block h-3 w-0.5 bg-accent" style={{ marginLeft: RAIL }} />
      <p className="sr-only">여기서 {branches.length}갈래로 나뉜다.</p>

      <ul>
        {branches.map((b, i) => {
          const last = i === branches.length - 1
          return (
            <li
              key={i}
              className={`relative ${last ? '' : 'pb-3'}`}
              style={{ paddingLeft: indent ? RAIL + 17 : 0 }}
            >
              {indent && (
                <>
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 w-0.5 bg-line"
                      style={{ left: RAIL }}
                    />
                  )}
                  <span
                    aria-hidden
                    className="absolute top-0 h-[14px] w-[13px] rounded-bl-[7px] border-b-2 border-l-2 border-line"
                    style={{ left: RAIL }}
                  />
                </>
              )}

              <p className="mb-2">
                <span className="sr-only">{i + 1}번째 갈래. </span>
                <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium leading-[1.4] text-accent [overflow-wrap:anywhere] break-keep">
                  {b.label.length > 0 ? <Inline text={b.label} /> : `갈래 ${i + 1}`}
                </span>
              </p>

              <TrackView track={b.track} depth={depth + 1} loopTargets={loopTargets} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* 되풀이 구간과 그 앞을 가르려면 목록이 둘로 쪼개진다. 그리는 몫은 같다 */
function ItemList({
  items,
  startsTrack,
  depth,
  loopTargets,
}: {
  items: Item[]
  startsTrack: boolean
  depth: number
  loopTargets: Set<string>
}) {
  return (
    <ol>
      {items.map((it, i) => (
        <li key={it.n}>
          {!(startsTrack && i === 0) && <Connector label={it.inLabel} />}
          <NodeBox item={it} />
          {it.fork && <ForkView branches={it.fork} depth={depth} loopTargets={loopTargets} />}
        </li>
      ))}
    </ol>
  )
}

/**
 * 줄기 하나.
 *
 * 괄호를 칠 자리는 훨씬 아래 갈래에서 나오는 간선이 정한다. 그래서 되돌아감의
 * 목표를 **props로 들려서 내려보낸다.** 모듈 바깥에 두면 한 화면에 도식이 둘일
 * 때 뒤에 그려진 것이 앞의 것을 덮어쓴다 — `build`는 바로 끝나지만 자식은
 * 리액트가 나중에 그리기 때문이다.
 */
function TrackView({
  track,
  depth,
  loopTargets,
}: {
  track: Track
  depth: number
  loopTargets: Set<string>
}) {
  const { items, jump } = track

  /*
   * 되풀이가 어디서 시작하는지는 이 줄기 안에서만 찾는다. 목표가 위쪽 줄기에
   * 있으면(재시도가 갈래 안에서 일어나는 흔한 모양) 여기서는 못 찾고, 그
   * 위쪽 줄기가 괄호를 친다. 칩은 어차피 제자리에 있으니 뜻은 안 샌다.
   */
  const loopFrom = items.findIndex((it) => loopTargets.has(it.name))
  const head = loopFrom >= 0 ? items.slice(0, loopFrom) : items
  const body = loopFrom >= 0 ? items.slice(loopFrom) : []

  return (
    <div>
      {head.length > 0 && (
        <ItemList items={head} startsTrack depth={depth} loopTargets={loopTargets} />
      )}
      {body.length > 0 && (
        <LoopWrap>
          <ItemList
            items={body}
            startsTrack={loopFrom === 0}
            depth={depth}
            loopTargets={loopTargets}
          />
        </LoopWrap>
      )}
      {jump && <JumpChip jump={jump} />}
    </div>
  )
}

export function FlowProto({ steps }: { steps: FlowStep[] }) {
  if (steps.length === 0) return null

  const { tracks, backTargets } = build(steps)

  return (
    <figure className="my-6 rounded-lg border border-line bg-surface px-4 py-4">
      {tracks.map((t, i) => (
        <div key={i} className={i > 0 ? 'mt-5 border-t border-line pt-5' : undefined}>
          {i > 0 && <p className="mb-2 text-[11px] text-faint">이어지지 않는 별도 흐름</p>}
          <TrackView track={t} depth={0} loopTargets={backTargets} />
        </div>
      ))}
    </figure>
  )
}
