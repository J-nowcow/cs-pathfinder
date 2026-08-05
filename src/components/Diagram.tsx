import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import type { FlowStep, StackLayer } from '@/lib/markdown/blocks'

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
              <p className="mt-1 text-[15px] leading-[1.6] text-ink">
                <Inline text={s.label} />
              </p>
            </div>
          </li>
        ))}
      </ol>
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
    /*
      오른쪽 끝을 배경색으로 흐린다. 잘린 것과 밀 수 있는 것은 눈에 같아 보여서,
      힌트가 없으면 표가 그냥 깨진 줄 안다. 스크롤이 끝까지 가도 흐림은 남지만
      그건 잘못 읽힐 여지가 없다.
    */
    <div className="relative my-6">
      <figure className="scroll-x -mx-5 px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[26rem] border-collapse overflow-hidden rounded-lg border border-line bg-raised text-left">
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
              <tr key={i}>
                {row.map((c, j) => (
                  <td
                    key={j}
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

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent sm:hidden"
      />
    </div>
  )
}
