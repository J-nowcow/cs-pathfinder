import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
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
export function FlowDiagram({ steps }: { steps: FlowStep[] }) {
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
