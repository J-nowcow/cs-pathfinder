import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'
import type { FlowStep } from '@/lib/markdown/blocks'

/**
 * 상태 전이 시안 — **상태마다 한 줄, 그 아래 나가는 길**.
 *
 * 상태는 순서가 아니라 **관계**다. 되돌아가고, 여러 곳에서 한 곳으로 모이고,
 * 조건이 붙는다. 그것을 임의 그래프로 그리면 노드를 2차원에 흩뿌리고 선을
 * 이어야 하는데, 배치 계산이 들어가는 순간 겹침·삐침이 시작된다. 앞선 SVG
 * 시안이 정확히 거기서 무너졌다 — 한 상태에서 두 갈래가 나가자 곡선과 이름표가
 * 포개졌고, 그걸 피하려고 `bulge`와 `labelY` 같은 손보정을 쌓다가 반려됐다.
 *
 * 그래서 **배치를 없앤다.** 상태를 세로로 한 줄씩 세우고, 그 상태에서 나가는
 * 길을 바로 아래 가지로 붙인다. 세로 순서는 나온 순서고, 가로는 한 단뿐이다.
 * 계산할 좌표가 없다.
 *
 * 잃는 것은 "돌아오는 선이 실제로 돌아오는 모양". 그건 도착 칩에 방향 표식
 * (`↑` 앞으로 돌아감 · `↓` 아래로 이어짐 · `↺` 제자리)으로 대신한다. 눈이
 * 표를 위아래로 따라가면 사이클이 읽힌다.
 *
 * 얻는 것이 셋이다. 지금 컴포넌트에 없는 것들이다.
 *
 * 1. **합류가 보인다.** 상태마다 "어디서 들어오는가"를 머리에 적는다. `준비`로
 *    세 곳에서 모이는 것이 상태 기계의 요점인데, 나가는 길만 그리면 그 사실이
 *    어디에도 안 남는다.
 * 2. **끝 상태가 자리를 갖는다.** 나가는 길이 없는 상태는 지금 도착점으로만
 *    스쳐 지나간다. `종료`·`TERMINATED`가 자기 줄을 갖고 "여기서 끝난다"를 말한다.
 * 3. **조건과 설명이 갈린다.** `[…]`로 감싼 앞머리를 가드로 떼어 칩으로 그린다.
 *    "언제 이 길로 가는가"와 "그때 무슨 일이 나는가"는 다른 정보다.
 *
 * SVG를 쓰지 않는다. 커넥터와 화살촉까지 전부 CSS다 — `border`로 그린 `└`와
 * 삼각형이다. 그래서 테마·글꼴을 그냥 따라가고 좌표가 등장할 자리가 없다.
 *
 * 그림은 낭독기에 안 잡힌다. 화살촉·방향 표식은 `aria-hidden`으로 감추고 같은
 * 뜻을 문장으로 따로 남긴다.
 */

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) => (
        <Fragment key={i}>
          {t.type === 'bold' ? (
            <strong>{t.value}</strong>
          ) : t.type === 'code' ? (
            <code className="rounded bg-accent-soft px-1 py-px font-mono text-[0.88em]">
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

/**
 * `[조건] 설명` 에서 조건을 뗀다.
 *
 * **파서를 안 건드린다.** 지금 문법으로 이미 쓸 수 있는 모양이고, 모델이
 * 대괄호를 안 쓰면 통째로 설명이 된다 — 못 알아봐서 잃는 것이 없다.
 * 파서로 옮길 때의 제안은 `docs/design/proto-state.md`에 적었다.
 */
const GUARD = /^\[([^\]]+)\]\s*(.*)$/

/** 받침 `ㄹ`. 이것만 예외라 `으로`가 아니라 `로`가 붙는다 */
const JONG_RIEUL = 8

/**
 * `준비로`인가 `실행으로`인가.
 *
 * 낭독기용 문장을 손으로 이어 붙이면 조사가 틀린다 — 실제로 첫 렌더에서
 * `실행로 갈 수 있다`가 나왔다. 눈으로는 안 보이고 소리로만 드러나는 종류의
 * 고장이라 그냥 두면 오래 남는다.
 *
 * 한글은 받침으로 갈린다. 영문은 우리말로 옮겼을 때 받침이 남는 끝만 `으로`다 —
 * `LISTEN`은 리슨, `WAITING`은 웨이팅이라 받침이 남고, `CLOSED`는 클로즈드,
 * `RUNNABLE`은 러너블이라 안 남는다. 숫자는 읽는 소리를 따른다(영·삼·육).
 */
function toward(name: string): string {
  const letters = [...name].filter((c) => /[0-9A-Za-z가-힣]/.test(c))
  const last = letters[letters.length - 1]
  if (!last) return '로'

  if (last >= '가' && last <= '힣') {
    const jong = (last.charCodeAt(0) - 0xac00) % 28
    return jong === 0 || jong === JONG_RIEUL ? '로' : '으로'
  }

  if (/[0-9]/.test(last)) return '036'.includes(last) ? '으로' : '로'

  return /(?:ng|[nm])$/i.test(name) ? '으로' : '로'
}

/** 도착 상태가 표에서 어느 쪽에 있는가. 배치 대신 이걸로 관계를 말한다 */
type Dir = 'back' | 'ahead' | 'self'

type Out = { to: string; guard: string; note: string; dir: Dir }
type Node = { name: string; outs: Out[]; ins: string[] }

/**
 * 전이 목록을 상태별로 접는다.
 *
 * 나온 순서를 지킨다. 상태 기계에는 대개 시작 상태가 있고 모델이 그것을 먼저
 * 쓴다. 도착으로만 나온 상태도 목록에 넣는다 — 그것이 끝 상태다.
 */
function buildNodes(steps: FlowStep[]): Node[] {
  const order: string[] = []
  const push = (name: string) => {
    if (!order.includes(name)) order.push(name)
  }
  for (const s of steps) {
    push(s.from)
    push(s.to)
  }

  const nodes: Node[] = order.map((name) => ({ name, outs: [], ins: [] }))
  const at = (name: string) => nodes[order.indexOf(name)]

  for (const s of steps) {
    const m = GUARD.exec(s.label.trim())
    const dir: Dir =
      s.to === s.from
        ? 'self'
        : order.indexOf(s.to) < order.indexOf(s.from)
          ? 'back'
          : 'ahead'

    at(s.from).outs.push({
      to: s.to,
      guard: m ? m[1].trim() : '',
      note: (m ? m[2] : s.label).trim(),
      dir,
    })

    // 같은 곳에서 두 길이 와도 출처는 한 번만 적는다
    const ins = at(s.to).ins
    if (s.to !== s.from && !ins.includes(s.from)) ins.push(s.from)
  }

  return nodes
}

/** 상태 이름. 머리의 것은 실물, 도착의 것은 참조라 크기와 두께를 달리한다 */
function Chip({ name, kind }: { name: string; kind: 'head' | 'target' }) {
  return (
    <span
      className={
        kind === 'head'
          ? 'rounded-full border border-line bg-surface px-2.5 py-1 text-[14px] font-semibold text-ink'
          : 'rounded-full border border-line bg-surface px-2 py-0.5 text-[13px] font-medium text-muted'
      }
    >
      {name}
    </span>
  )
}

export function StateProto({ steps }: { steps: FlowStep[] }) {
  const nodes = buildNodes(steps)

  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-line bg-raised">
      <ol className="divide-y divide-line">
        {nodes.map((n, ni) => {
          const isStart = ni === 0
          const isEnd = n.outs.length === 0

          return (
            <li key={n.name} className="px-4 py-3.5 sm:px-5">
              {/* 상태 머리. 점 하나가 노드고, 점들이 세로로 줄지어 기계가 된다 */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span aria-hidden className="flex w-2.5 shrink-0 justify-center">
                  {isEnd ? (
                    <span className="h-2.5 w-2.5 rounded-full border-2 border-accent" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-accent" />
                  )}
                </span>

                <Chip name={n.name} kind="head" />

                {isStart && (
                  <span className="rounded bg-accent px-1.5 py-px text-[11px] font-medium text-on-accent">
                    시작
                  </span>
                )}
                {isEnd && (
                  <span className="rounded border border-accent px-1.5 py-px text-[11px] font-medium text-accent">
                    끝
                  </span>
                )}
              </div>

              {/*
                합류. 이 도식이 지금 것과 갈리는 자리다.
                `준비`로 세 곳에서 모이는 것이 프로세스 상태의 요점인데,
                나가는 길만 그리면 그 사실이 어디에도 안 남는다.
              */}
              {n.ins.length > 0 && (
                <p className="mt-1 break-keep pl-[18px] text-[12px] leading-[1.5] text-faint">
                  {/* 낭독기에는 쉼표로, 눈에는 가운뎃점으로 */}
                  <span className="sr-only">{`${n.ins.join(', ')}에서 ${n.name}${toward(n.name)} 들어온다.`}</span>
                  <span aria-hidden>{`← ${n.ins.join(' · ')}에서 온다`}</span>
                </p>
              )}

              {n.outs.length > 0 && (
                <ul className="mt-2">
                  {n.outs.map((o, oi) => {
                    const last = oi === n.outs.length - 1
                    return (
                      <li key={oi} className="flex items-stretch">
                        {/*
                          가지 커넥터 `└`. SVG도 좌표도 없이 border 두 개다.
                          마지막 가지는 세로줄을 꺾이는 데서 끊어 목록이 여기서
                          닫힌 것을 말한다.
                        */}
                        <span aria-hidden className="flex w-4 shrink-0 flex-col">
                          <span className="h-[11px] w-full rounded-bl-[4px] border-b border-l border-line" />
                          {!last && <span className="w-full flex-1 border-l border-line" />}
                        </span>

                        <div className="min-w-0 flex-1 pb-2.5">
                          {/* 그림은 낭독기에 안 잡힌다. 같은 뜻을 문장으로 남긴다 */}
                          <span className="sr-only">
                            {`${n.name}에서 ${o.to}${toward(o.to)} 갈 수 있다.`}
                            {o.dir === 'back'
                              ? ' 앞에 나온 상태로 돌아간다.'
                              : o.dir === 'self'
                                ? ' 제자리에 머문다.'
                                : ''}
                            {o.guard.length > 0 ? ` 조건: ${o.guard}.` : ''}
                          </span>

                          <span
                            aria-hidden
                            className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
                          >
                            {/* 화살촉도 CSS다. 테두리만으로 만든 삼각형 */}
                            <span className="h-0 w-0 shrink-0 border-y-[3.5px] border-l-[5.5px] border-y-transparent border-l-accent" />
                            <Chip name={o.to} kind="target" />
                            <span
                              className={
                                o.dir === 'ahead'
                                  ? 'text-[12px] text-faint'
                                  : 'text-[12px] text-accent'
                              }
                            >
                              {o.dir === 'back' ? '↑' : o.dir === 'self' ? '↺' : '↓'}
                            </span>
                          </span>

                          {/*
                            조건과 설명은 도착 칩의 왼쪽 끝에 맞춘다. 화살촉
                            5.5px + 사이 6px = 11.5px. 여기를 안 맞추면 글이
                            칩보다 왼쪽으로 삐져나와 한 덩어리로 안 읽힌다.
                          */}
                          <div className="pl-[11.5px]">
                            {o.guard.length > 0 && (
                              <p className="mt-1">
                                <span className="inline-block break-keep rounded border border-line bg-surface px-1.5 py-0.5 text-[12px] leading-[1.45] text-muted">
                                  <Inline text={o.guard} />
                                </span>
                              </p>
                            )}

                            {o.note.length > 0 && (
                              <p className="mt-1 break-keep text-[14px] leading-[1.6] text-ink">
                                <Inline text={o.note} />
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
