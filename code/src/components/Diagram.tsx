import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import { flowShape, actorsOf } from '@/lib/markdown/flow-shape'
import type { FlowStep, StackLayer, TreeNode, MemoryArea, TimelineRow } from '@/lib/markdown/blocks'

/**
 * 해설 안의 도식.
 *
 * 순서·계층·비교는 줄글로 읽으면 머리로 다시 그려야 한다. 3-way handshake처럼
 * 순서가 본질인 내용이 특히 손해다.
 *
 * SVG 문자열을 넣지 않는다. 전부 React 요소라 사이트와 같은 색·같은 글꼴로
 * 그려지고, innerHTML 경로가 생기지 않는다.
 *
 * 모바일이 기준이다. 가로로 넓은 도식은 폰에서 읽을 수 없으므로 세로로 쌓는다.
 */

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => (
        <Fragment key={i}>
          {t.type === 'bold' ? (
            <strong>{t.value}</strong>
          ) : t.type === 'code' ? (
            <code>{t.value}</code>
          ) : (
            t.value
          )}
        </Fragment>
      ))}
    </>
  )
}

/**
 * 순서.
 *
 * 행위자를 가로로 늘어놓는 전형적인 시퀀스 다이어그램은 폰에서 글자가 뭉갠다.
 * 세로 타임라인으로 눕히고 번호를 매긴다. 왼쪽 선이 "이어지는 한 줄기"를 말한다.
 */
/**
 * 마지막 글자의 받침 번호. 한글이 아니면 `null`.
 *
 * 영문·숫자로 끝나는 이름이 흔하다(`FCM`, `L1`, `TCP`). 그때는 받침을 알 수
 * 없으므로 조사를 붙이지 않는 쪽으로 흘린다 — 틀린 조사보다 없는 편이 낫다.
 */
function jongOf(word: string): number | null {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return null
  return (code - 0xac00) % 28
}

/** `로` 앞에 `으`가 필요한가. 받침 ㄹ은 그냥 `로`를 쓴다 */
export function needsEu(word: string): boolean {
  const jong = jongOf(word)
  return jong !== null && jong !== 0 && jong !== 8
}

/**
 * `다` 앞에 `이`가 필요한가.
 *
 * `주문다`가 아니라 `주문이다`다. 낭독기가 읽는 문장이라 눈에 안 띄는데,
 * 소리로 들으면 바로 걸린다. 실제로 브라우저에서 듣기 전까지 못 봤다.
 */
export function needsI(word: string): boolean {
  const jong = jongOf(word)
  return jong !== null && jong !== 0
}

/**
 * 오가는 것 — 기둥과 화살표.
 *
 * `flow` 안에 두 모양이 섞여 있다. `A→B`와 `B→A`가 둘 다 있는 **왕복**은
 * 세로 목록으로 그리면 오간 것이 사라진다. 핸드셰이크가 "1번 다음 2번"으로
 * 읽히고 누가 공을 쥐고 있는지 매 줄 읽어야 안다.
 *
 * **좌표를 한 줄도 계산하지 않는다.** 격자 두 층이 같은 폭을 다르게 나눈다.
 * 기둥은 `repeat(N, 1fr)`, 화살표는 `0.5fr repeat(N-1, 1fr) 0.5fr`. 양 끝을
 * 반 칸으로 두면 화살표 층의 격자선이 기둥 한가운데에 정확히 떨어져서
 * **주체 i의 기둥 = 격자선 i+2** 하나로 끝난다. 손보정이 필요 없다.
 *
 * **칸 안에 글자를 넣지 않는다.** 390px을 넷으로 나누면 97px이라 한글이 안
 * 들어간다. 칸은 화살표만 나르고 설명은 아래 줄에서 폭을 통째로 쓴다. 주체가
 * 늘어도 글자 칸은 안 줄고 화살표만 짧아진다.
 *
 * 재시도·실패 같은 것을 구조에서 짐작하지 않는다. `flow` 문법에는 그것을
 * 적을 자리가 없고, 짐작하면 관계없는 걸음을 오탐한다.
 */
export function SequenceDiagram({ steps }: { steps: FlowStep[] }) {
  const actors = actorsOf(steps)
  const n = actors.length

  const laneCols = `repeat(${n}, minmax(0, 1fr))`
  const arrowCols = `minmax(0, 0.5fr) repeat(${n - 1}, minmax(0, 1fr)) minmax(0, 0.5fr)`

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-3 py-3.5">
      {/* 기둥 머리. 칸을 벌리지 않는다 — 벌리면 아래 두 층과 한가운데가 어긋난다 */}
      <div aria-hidden className="grid" style={{ gridTemplateColumns: laneCols }}>
        {actors.map((a) => (
          <p
            key={a}
            className="mx-0.5 rounded-md bg-accent-soft px-1 py-1 text-center text-[11px] leading-[1.25] font-medium break-keep text-ink"
          >
            {a}
          </p>
        ))}
      </div>

      <div className="relative mt-2">
        {/*
          생명선. 설명 줄이 대부분을 덮으므로 남는 것은 줄 사이의 짧은 도막뿐이다.
          1px로는 거의 안 보였다. 색은 토큰이 정해져 있어 못 바꾸므로 폭으로 벌었다.
        */}
        <div aria-hidden className="absolute inset-0 grid" style={{ gridTemplateColumns: laneCols }}>
          {actors.map((a) => (
            <span key={a} className="mx-auto h-full w-0.5 rounded-full bg-line" />
          ))}
        </div>

        <ol className="relative list-none">
          {steps.map((s, i) => {
            const a = actors.indexOf(s.from)
            const b = actors.indexOf(s.to)
            const self = a === b
            const rightward = b > a
            /* 픽셀이 아니라 격자선이다. 주체 i의 기둥 = 격자선 i+2 */
            const span = self
              ? `${a + 2} / span 1`
              : `${Math.min(a, b) + 2} / ${Math.max(a, b) + 2}`

            return (
              <li key={i} className="pb-3 last:pb-1">
                {/*
                  낭독기는 화살표 모양을 못 읽는다. 누가 누구에게 무엇을 보냈는지
                  한 문장으로 남긴다 — 이것만 읽어도 뜻이 통해야 한다.
                */}
                <span className="sr-only">
                  {`${i + 1}. ${s.from}에서 ${s.to}${needsEu(s.to) ? '으로' : '로'}${
                    s.label.length > 0 ? `: ${s.label}` : ''
                  }`}
                </span>

                <div aria-hidden>
                  <div className="grid items-center" style={{ gridTemplateColumns: arrowCols }}>
                    <div className="flex h-5 items-center" style={{ gridColumn: span }}>
                      {self ? (
                        /*
                         * 자기 자신에게. 왼쪽이 트인 고리라 기둥에서 나가 기둥으로
                         * 돌아온다. 화살촉을 안 붙인다 — 고리의 트인 쪽과 겹쳐
                         * 삼각형이 아니라 덩어리로 보인다.
                         */
                        <span className="flex h-4 w-full max-w-[58px] items-center">
                          <span className="-mr-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          <span className="h-4 flex-1 rounded-r-[7px] border-2 border-l-0 border-solid border-accent" />
                        </span>
                      ) : rightward ? (
                        <>
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          <span className="min-w-0 flex-1 border-t-2 border-accent" />
                          <ArrowHead dir="right" />
                        </>
                      ) : (
                        <>
                          <ArrowHead dir="left" />
                          <span className="min-w-0 flex-1 border-t-2 border-accent" />
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* 폭을 통째로 쓴다. 배경이 있어 뒤의 생명선을 덮는다 */}
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 bg-raised px-0.5 text-[14px] leading-[1.55] break-keep text-ink">
                    <span className="font-mono text-[10px] text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      {s.label.length > 0 ? (
                        <Inline text={s.label} />
                      ) : (
                        <span className="text-muted">
                          {s.from} → {s.to}
                        </span>
                      )}
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </figure>
  )
}

/**
 * 한 줄로 이어지는 것 — 상자와 이음줄.
 *
 * `소스 -> 전처리기 -> 컴파일러 -> 링커`는 마디가 저마다 한 번씩만 나오는
 * 사슬이다. 지금 목록은 걸음마다 `소스 → 전처리기`를 다시 적어서, 같은
 * 이름이 두 줄에 걸쳐 나오고 **하나로 이어진다는 사실이 글자에 묻힌다.**
 *
 * 마디를 상자로 한 번만 두고 사이를 이음줄로 꿴다. 설명은 줄 옆에 붙는다 --
 * 그 자리에 있어야 "이래서 다음으로 간다"로 읽힌다.
 *
 * 여기서 같은 이름을 하나로 합치는 것은 **맞다.** 사슬에서 같은 이름은 같은
 * 자리를 뜻하기 때문이다. 왕복에 그 규칙을 쓰면 핸드셰이크가 분기 그래프가
 * 되므로 왕복은 앞에서 갈라낸다.
 */
export function ChainDiagram({ steps }: { steps: FlowStep[] }) {
  const nodes = [steps[0].from, ...steps.map((s) => s.to)]

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-4 py-4 sm:px-5">
      <ol className="list-none">
        {nodes.map((name, i) => (
          <li key={i}>
            {i > 0 && (
              <div className="flex items-stretch gap-3">
                {/* 이음줄과 화살촉. 설명 높이만큼 늘어난다 */}
                <div aria-hidden className="flex w-5 shrink-0 flex-col items-center">
                  <span className="w-0.5 flex-1 bg-line" />
                  <span className="h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-accent" />
                </div>
                <p className="min-w-0 flex-1 py-1.5 text-[13px] leading-[1.55] text-muted">
                  <span className="sr-only">{`그다음은 ${nodes[i]}${needsI(nodes[i]) ? '이다' : '다'}. `}</span>
                  {steps[i - 1].label.length > 0 ? (
                    <Inline text={steps[i - 1].label} />
                  ) : (
                    <span className="text-faint">그다음</span>
                  )}
                </p>
              </div>
            )}

            <div
              className={
                i === nodes.length - 1
                  ? 'flex items-baseline gap-2.5 rounded-lg border border-accent bg-raised px-3.5 py-2.5'
                  : 'flex items-baseline gap-2.5 rounded-lg border border-line bg-raised px-3.5 py-2.5'
              }
            >
              <span aria-hidden className="font-mono text-[11px] text-faint">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-[1.45] font-medium text-ink">
                <Inline text={name} />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}

/** 화살촉. 테두리 삼각형이라 SVG가 필요 없다 */
function ArrowHead({ dir }: { dir: 'left' | 'right' }) {
  return (
    <span
      className={
        dir === 'right'
          ? 'h-0 w-0 shrink-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-accent'
          : 'h-0 w-0 shrink-0 border-y-[4px] border-r-[7px] border-y-transparent border-r-accent'
      }
    />
  )
}

export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  /*
   * 오가는 것은 기둥으로 그린다.
   *
   * 문법을 새로 열지 않았다. 파싱된 걸음만 보면 왕복인지 알 수 있으므로
   * 저장된 본문을 한 글자도 안 고치고 그림만 고른다. 못 알아본 것은 아래
   * 목록 그대로 둔다 — 섣불리 그리느니 그대로가 낫다.
   */
  const shape = flowShape(steps)
  if (shape === 'sequence') return <SequenceDiagram steps={steps} />
  if (shape === 'chain') return <ChainDiagram steps={steps} />

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised">
      <ol className="divide-y divide-line">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3.5 px-4 py-3.5 sm:px-5">
            <span
              aria-hidden
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-medium text-accent"
            >
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-faint">
                <span className="font-medium text-muted">{s.from}</span>
                <span aria-label="에서" className="text-accent">
                  →
                </span>
                <span className="font-medium text-muted">{s.to}</span>
              </p>
              {/* 화살표만 있고 설명이 없는 걸음도 있다. 빈 문단을 남기면 칸만 벌어진다 */}
              {s.label.length > 0 && (
                <p className="mt-1 text-[15px] leading-[1.6] text-ink">
                  <Inline text={s.label} />
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  )
}

/**
 * 상태 전이.
 *
 * `flow`와 문법이 같은데 그리는 방식이 다르다. **출발 상태로 묶는 것**이
 * 전부다.
 *
 * flow는 1·2·3으로 번호를 매겨 한 줄로 세운다. 상태 머신은 그러면 안 된다.
 * 한 상태에서 여러 갈래로 나가는 것이 상태 머신의 요점인데, 번호를 매기면
 * 그 갈림이 "그다음 차례"로 읽힌다. `반열림 → 닫힘`과 `반열림 → 열림`은
 * 순서가 아니라 **둘 중 하나**다.
 *
 * 그래서 중첩 목록이다. 바깥이 상태, 안쪽이 그 상태에서 나가는 길. 화면
 * 낭독기가 중첩 목록을 그대로 읽으므로 "반열림 아래에 두 갈래"가 소리로도
 * 전달된다.
 *
 * 되돌아가는 전이(앞에 이미 나온 상태로 가는 것)에는 `↩`를 붙인다. 그림만
 * 보고 알 수 없으면 안 되므로 낭독기용 글자를 따로 둔다.
 */
export function StateDiagram({ steps }: { steps: FlowStep[] }) {
  /*
   * 출발 상태별로 모은다. 나온 순서를 지킨다 — 상태 머신에는 대개 시작
   * 상태가 있고 모델이 그것을 먼저 쓴다.
   */
  const groups: Array<{ from: string; outs: FlowStep[] }> = []
  for (const s of steps) {
    const hit = groups.find((g) => g.from === s.from)
    if (hit) hit.outs.push(s)
    else groups.push({ from: s.from, outs: [s] })
  }

  /* 앞에서 이미 출발 상태로 나온 곳으로 가면 되돌아가는 길이다 */
  const seenBefore = (index: number, to: string) =>
    groups.slice(0, index).some((g) => g.from === to)

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised">
      <ul className="divide-y divide-line">
        {groups.map((g, gi) => (
          <li key={gi} className="px-4 py-3.5 sm:px-5">
            <p className="text-[13px] font-medium text-ink">{g.from}</p>

            <ul className="mt-1.5 space-y-2">
              {g.outs.map((s, si) => {
                const back = seenBefore(gi, s.to)
                return (
                  <li key={si} className="flex gap-2">
                    <span aria-hidden className="mt-[3px] shrink-0 text-[12px] text-accent">
                      {back ? '↩' : '→'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-accent">
                        {s.to}
                        {back && <span className="sr-only"> (앞의 상태로 돌아간다)</span>}
                      </p>
                      {s.label.length > 0 && (
                        <p className="mt-0.5 text-[15px] leading-[1.6] text-muted">
                          <Inline text={s.label} />
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * 무엇이 무엇에 속하는가.
 *
 * 계층과 헷갈리기 쉬운데 다르다. 계층은 **위아래로 쌓인 것**이고 트리는
 * **속한 것**이다. B-tree·상속·참조 사슬·인증서 체인이 여기 온다. 지금은
 * 그런 것들이 전부 계층으로 그려져 있고, 그러면 "자식"이 "아래층"으로
 * 읽힌다.
 *
 * 중첩 목록으로 그린다. 깊이가 곧 중첩이라 **낭독기가 소속을 그대로 읽는다** —
 * 여기는 따로 이름표를 붙일 필요가 없다.
 *
 * 설명은 이름 **아래 줄**에 둔다. 계층처럼 오른쪽에 붙이면 깊이 2에서
 * 이름 칸이 좁아진다.
 */
export function TreeDiagram({ nodes }: { nodes: TreeNode[] }) {
  /* 평평한 목록을 중첩으로 되돌린다. 깊이가 줄면 그만큼 위로 올라간다 */
  type Item = { name: string; note: string; children: Item[] }
  const roots: Item[] = []
  const stack: Item[] = []

  for (const n of nodes) {
    const item: Item = { name: n.name, note: n.note, children: [] }
    stack.length = n.depth
    const parent = stack[n.depth - 1]
    if (parent) parent.children.push(item)
    else roots.push(item)
    stack[n.depth] = item
  }

  const List = ({ items, depth }: { items: Item[]; depth: number }) => (
    <ul
      className={
        depth === 0 ? 'space-y-2.5' : 'mt-2 space-y-2 border-l border-line pl-3.5'
      }
    >
      {items.map((it, i) => (
        <li key={i}>
          <p className="text-[15px] leading-[1.5] text-ink">
            <Inline text={it.name} />
          </p>
          {it.note.length > 0 && (
            <p className="mt-0.5 text-[13px] leading-[1.55] text-muted">
              <Inline text={it.note} />
            </p>
          )}
          {it.children.length > 0 && <List items={it.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  )

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-4 py-3.5 sm:px-5">
      <List items={roots} depth={0} />
    </figure>
  )
}

/**
 * 어디에 놓이고 어느 쪽으로 자라는가.
 *
 * 계층과 **붙어 있는 것**으로 구별한다. 계층은 층마다 떠 있는데 메모리는
 * 연속한 공간이라는 것이 뜻이라 칸을 붙여 그린다.
 *
 * **마주 자라는 것이 이 도식의 존재 이유다.** 스택은 아래로, 힙은 위로
 * 자라고 그 사이가 빈 공간이다. 계층으로 그리면 그 사실이 통째로 사라진다.
 * 방향이 반대인 두 칸이 붙어 있으면 사이를 점선으로 끊어 그것을 말한다.
 *
 * 화살표는 그림이라 낭독기에 안 잡힌다. 뜻은 숨긴 글자로 따로 둔다.
 */
export function MemoryDiagram({ areas }: { areas: MemoryArea[] }) {
  /* 위아래가 서로 반대로 자라면 그 사이가 빈 공간이다 */
  const facing = (i: number) =>
    i > 0 && areas[i - 1].grow === 'down' && areas[i].grow === 'up'

  return (
    <figure className="my-6 grid grid-cols-[auto_1fr] items-stretch gap-x-2">
      <div className="flex flex-col justify-between py-1 text-[11px] text-faint">
        <span>높은 주소</span>
        <span>낮은 주소</span>
      </div>

      <ol className="overflow-hidden rounded-lg border border-line bg-raised">
        {areas.map((a, i) => (
          <li
            key={i}
            className={
              i === 0
                ? 'px-4 py-3 sm:px-5'
                : facing(i)
                  ? 'border-t border-dashed border-line px-4 py-3 sm:px-5'
                  : 'border-t border-line px-4 py-3 sm:px-5'
            }
          >
            <p className="flex items-baseline justify-between gap-3 text-[15px] text-ink">
              <span className="font-medium">
                <Inline text={a.name} />
              </span>
              {a.grow && (
                <span className="shrink-0 text-[13px] text-accent">
                  <span aria-hidden>{a.grow === 'down' ? '↓' : '↑'}</span>
                  <span className="sr-only">
                    {a.grow === 'down' ? '아래로 자란다' : '위로 자란다'}
                  </span>
                </span>
              )}
            </p>
            {a.note.length > 0 && (
              <p className="mt-0.5 text-[13px] leading-[1.55] text-muted">
                <Inline text={a.note} />
              </p>
            )}
          </li>
        ))}
      </ol>
    </figure>
  )
}

/**
 * 누가 같은 시간에 무엇을 하는가.
 *
 * **시간을 아래로 흘린다.** 가로 시간축은 폰에서 죽는다 — 다섯 칸이면
 * 칸당 70px이라 한 칸에 두 글자만 들어간다.
 *
 * **진짜 `<table>`을 쓴다.** 행이 시간, 열이 주체다. `<th scope="col">`이
 * 주체 이름이라 낭독기가 "2번째: 스레드 A 100+50 계산, 스레드 B 잔액 100
 * 읽기"로 읽는다. 접근성이 마크업에서 공짜로 나온다.
 *
 * **빈 칸에는 아무것도 안 그린다.** 비어 보이는 것이 이 도식의 전부다 —
 * 기다림과 겹침이 거기서 읽힌다.
 *
 * `.rtable` 접기 규칙은 안 탄다. 그 규칙은 첫 칸을 카드 제목으로 삼는데
 * 여기 첫 칸은 순번이라 뜻이 없다. 대신 넘치면 이 안에서만 밀리게 한다.
 */
export function TimelineDiagram({ rows }: { rows: TimelineRow[] }) {
  const slots = rows[0]?.slots.length ?? 0

  return (
    <figure className="my-6 overflow-x-auto rounded-lg border border-line bg-raised">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-8 px-3 py-2">
              <span className="sr-only">순서</span>
            </th>
            {rows.map((r) => (
              <th
                key={r.actor}
                scope="col"
                className="px-3 py-2 text-[12px] font-medium text-muted"
              >
                <Inline text={r.actor} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: slots }, (_, t) => (
            <tr key={t} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2 align-top font-mono text-[11px] text-faint">{t + 1}</td>
              {rows.map((r) => (
                <td key={r.actor} className="px-3 py-2 align-top">
                  {/*
                    주체가 셋이면 폰에서 한 칸이 99px이라 줄이 넘어간다. 기본
                    규칙은 글자 단위로 끊어서 "받아 적는 / 다"가 된다 — 어절
                    한가운데가 갈라져 읽다가 걸린다. `break-keep`으로 어절을
                    지키면 "받아 / 적는다"가 된다. 칸 수가 적어 가로로 넘칠 일은
                    없다(파서가 다섯으로 막는다).
                  */}
                  {r.slots[t]?.length > 0 && (
                    <span className="inline-block break-keep rounded bg-accent-soft px-2 py-1 text-[13px] leading-[1.45] text-ink">
                      <Inline text={r.slots[t]} />
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

/**
 * 계층.
 *
 * 위가 위층이다. OSI나 메모리 영역처럼 "쌓여 있다"는 것 자체가 정보인 경우에 쓴다.
 * 오른쪽 보조 설명은 없어도 된다 — 있으면 예시를 붙이는 자리다.
 */
export function StackDiagram({ layers }: { layers: StackLayer[] }) {
  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised">
      <ul className="divide-y divide-line">
        {layers.map((l, i) => (
          <li
            key={i}
            className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:px-5"
          >
            <span className="text-[15px] font-medium leading-[1.5] text-ink">
              <Inline text={l.name} />
            </span>
            {l.note && (
              <span className="text-[13px] leading-[1.5] text-muted sm:shrink-0 sm:text-right">
                <Inline text={l.note} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/**
 * 비교표.
 *
 * 칸이 많으면 폰에서 글자가 줄바꿈으로 뭉갠다. 가로로 밀 수 있게 두고 표 자체는
 * 최소 폭을 지킨다. 본문이 통째로 밀리지 않게 스크롤은 이 안에서만 일어난다.
 */
export function TableDiagram({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <figure className="my-6">
      {/*
        좁은 화면에서는 표를 줄 단위 카드로 접는다 (rtable, globals.css).

        비교표는 기준 한 칸에 비교 대상 두 칸이라 최소 세 칸이다. 390px에서
        세 칸이면 칸당 100px 남짓이라 어느 쪽이든 잘린다. 가로로 밀게 두면
        읽는 사람이 표를 오간다 — 비교하려고 만든 것이 비교를 방해한다.

        접으면 한 줄씩 세로로 읽힌다. 첫 칸이 제목, 나머지는 머리글을 이름표로
        달고 값이 따라온다.

        display를 바꾸면 브라우저가 표 의미를 잃으므로 role을 손으로 붙인다.
        그래야 스크린 리더가 카드로 접힌 뒤에도 표로 읽는다.
      */}
      <table
        role="table"
        className="rtable w-full border-collapse overflow-hidden rounded-lg border border-line bg-raised text-left"
      >
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className="px-4 py-2.5 text-[12px] font-medium text-faint sm:px-5"
              >
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row, i) => (
            <tr key={i} role="row">
              {row.map((c, j) => (
                <td
                  key={j}
                  role="cell"
                  data-label={head[j] ?? ''}
                  className={`px-4 py-3 align-top text-[14px] leading-[1.6] sm:px-5 ${
                    j === 0 ? 'font-medium text-ink' : 'text-muted'
                  }`}
                >
                  <Inline text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
