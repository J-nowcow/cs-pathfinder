import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'

/**
 * 주고받음 — 둘 이상이 메시지를 주고받는 것.
 *
 * 지금 이런 내용은 `flow`의 번호 목록으로 그려진다. 줄마다 `클라 → 서버`를
 * 다시 읽어야 해서, 왕복이 잦은 핸드셰이크에서는 누가 공을 쥐고 있는지가
 * 매번 흐려진다. **주고받음은 자리로 보여야 한다.**
 *
 * 손으로 좌표를 계산한 SVG 시안이 한 번 반려됐다. 이유는 SVG가 아니라
 * 좌표였다 — 이름표가 포개지고 화살표가 겹쳤고, 그걸 막으려고 `bulge`나
 * `labelY` 같은 보정을 손으로 쌓았다. 그런 보정은 다음 입력에서 또 깨진다.
 *
 * 그래서 **격자에 맡긴다.** 좌표는 한 줄도 계산하지 않는다. 픽셀 대신 격자선
 * 번호만 쓴다.
 *
 * ## 겹치는 두 층
 *
 * 생명선과 화살표가 같은 폭을 서로 다르게 나눠야 한다. 생명선은 칸 **한가운데**에
 * 서고, 화살표는 그 한가운데에서 한가운데로 가야 한다.
 *
 *   생명선 층   `repeat(N, 1fr)`
 *   화살표 층   `0.5fr repeat(N-1, 1fr) 0.5fr`
 *
 * 양 끝을 반 칸으로 두면 화살표 층의 격자선이 생명선 칸의 한가운데에 정확히
 * 떨어진다. N=3이면 칸 폭이 W/3이고 한가운데는 W/6·W/2·5W/6인데, 화살표 층의
 * 격자선도 0·W/6·W/2·5W/6·W다. 그래서 **주체 i의 기둥 = 격자선 i+2**라는 규칙
 * 하나로 끝난다. 브라우저가 나눗셈을 하므로 폭이 얼마든 어긋나지 않는다.
 *
 * ## 390px에서 셋 이상
 *
 * 칸을 N등분하면 셋일 때 130px, 넷이면 97px이다. 한글 설명이 들어갈 폭이
 * 아니다. **그래서 칸 안에 글자를 넣지 않는다.** 칸이 나르는 것은 화살표와
 * 기둥뿐이고, 설명은 아래 줄에서 폭을 통째로 쓴다. 주체가 늘어도 글자 칸은
 * 줄지 않는다 — 화살표만 짧아진다.
 *
 * 설명 줄은 `bg-raised`라 뒤의 생명선을 덮는다. 선이 글자를 가로지르지 않고,
 * 줄과 줄 사이에서만 보인다.
 *
 * ## 낭독기
 *
 * 방향이 삼각형 모양에만 있으면 안 된다. 걸음마다 "몇 번째, 누가, 누구에게,
 * 무엇을"이 통문장으로 숨어 있고, 눈에 보이는 쪽은 통째로 `aria-hidden`이다.
 * 같은 내용을 두 번 읽히지 않으면서 방향을 글로 남기는 방법이다.
 */

/** 걸음의 성질. 실패만 따로 두고 재시도는 **구조에서 알아낸다**(아래 `isRetry`) */
export type SeqTone = 'ok' | 'fail'

export type SeqRow =
  /** 한 걸음. `from === to`면 자기 자신에게 하는 일이다 */
  | { type: 'msg'; from: string; to: string; label: string; tone?: SeqTone }
  /** 걸음 사이에 흐르는 시간. 기다림·백오프처럼 주고받음이 아닌 것 */
  | { type: 'note'; text: string }

/**
 * 폰에서 기둥이 설 수 있는 한계.
 *
 * 넷이면 칸이 97px이라 `인가 서버` 정도가 두 줄로 접힌다. 다섯이면 기둥 이름이
 * 먼저 무너진다. 파서가 이 수를 넘는 울타리를 거절해야 한다 — 여기서는
 * 넘겨도 그리기는 한다(도식을 통째로 잃는 것보다 낫다).
 */
export const MAX_SEQ_ACTORS = 4

const TONE = {
  ok: {
    line: 'border-accent',
    right: 'border-l-accent',
    left: 'border-r-accent',
    dot: 'bg-accent',
    dash: 'border-solid',
  },
  fail: {
    line: 'border-warn',
    right: 'border-l-warn',
    left: 'border-r-warn',
    dot: 'bg-warn',
    dash: 'border-dashed',
  },
} as const

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
 * `로`인가 `으로`인가.
 *
 * 낭독기가 읽을 문장을 만드는데 `클라이언트(으)로` 같은 표기는 소리로
 * "괄호 으 괄호 로"가 된다. 받침을 보고 고르면 그럴 일이 없다.
 *
 * 받침 자리는 유니코드 한글에서 `(코드 - 가) % 28`이다. 0이면 받침이 없고,
 * 8은 `ㄹ`인데 이때는 `서울로`처럼 `로`를 쓴다. 한글이 아니면(영문 약어 등)
 * 받침 없는 쪽으로 읽는다 — `TCP로`가 맞다.
 */
function needsEu(word: string): boolean {
  const w = word.trim()
  if (w.length === 0) return false
  const c = w.charCodeAt(w.length - 1)
  if (c < 0xac00 || c > 0xd7a3) return false
  const final = (c - 0xac00) % 28
  return final !== 0 && final !== 8
}

/** 화살촉. 테두리 삼각형이라 폭·색이 CSS 값 하나로 바뀐다 */
function Head({ dir, tone }: { dir: 'left' | 'right'; tone: SeqTone }) {
  return (
    <span
      className={
        dir === 'right'
          ? `h-0 w-0 shrink-0 border-y-[4.5px] border-l-[7px] border-solid border-y-transparent ${TONE[tone].right}`
          : `h-0 w-0 shrink-0 border-y-[4.5px] border-r-[7px] border-solid border-y-transparent ${TONE[tone].left}`
      }
    />
  )
}

/** 못 닿은 걸음. 화살촉 대신 이것이 붙는다 */
function Blocked() {
  return <span className="shrink-0 text-[11px] leading-none font-bold text-warn">✕</span>
}

export function SeqProto({
  rows,
  actors: given,
  caption,
}: {
  rows: SeqRow[]
  /** 기둥 순서를 손으로 정할 때. 없으면 나온 순서대로 세운다 */
  actors?: string[]
  caption?: string
}) {
  const actors = given ? [...given] : []
  if (!given) {
    for (const r of rows) {
      if (r.type !== 'msg') continue
      for (const who of [r.from, r.to]) if (!actors.includes(who)) actors.push(who)
    }
  }
  if (actors.length === 0 || rows.length === 0) return null

  const n = actors.length

  /* 두 층이 쓰는 열 자. 위 주석의 반 칸 규칙이 여기에 있다 */
  const laneCols = `repeat(${n}, minmax(0, 1fr))`
  const arrowCols =
    n > 1
      ? `minmax(0, 0.5fr) repeat(${n - 1}, minmax(0, 1fr)) minmax(0, 0.5fr)`
      : 'minmax(0, 0.5fr) minmax(0, 0.5fr)'

  /**
   * 재시도인가.
   *
   * 문법을 하나 더 만들지 않는다. **같은 방향을 앞에서 이미 보냈고 그 뒤로
   * 실패한 걸음이 있었으면** 이번 것은 다시 보내는 것이다. 상태 도식이
   * 되돌아가는 길을 알아내는 방식과 같다 — 글쓴이가 표시하는 게 아니라
   * 구조에서 나온다.
   */
  const isRetry = (i: number, from: string, to: string) => {
    const same = rows.findIndex(
      (r, j) => j < i && r.type === 'msg' && r.from === from && r.to === to,
    )
    if (same < 0) return false
    return rows.slice(same, i).some((r) => r.type === 'msg' && r.tone === 'fail')
  }

  let no = 0

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-3 py-3.5">
      {/* 기둥 머리. 칸을 벌리지 않는다 — 벌리면 아래 두 층과 한가운데가 어긋난다 */}
      <div className="grid" style={{ gridTemplateColumns: laneCols }}>
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
          생명선. 아래 목록보다 먼저 그려지므로 설명 줄에 가려진다.

          1px로 뒀더니 실제로 그려보니 거의 안 보였다. `--line`은 칸을 나누는
          색이라 배경과의 차이가 원래 작은데, 설명 줄이 대부분을 덮어서 남는
          것이 줄 사이의 짧은 도막뿐이다. 색은 못 바꾸므로(토큰이 정해져 있다)
          폭으로 벌었다.
        */}
        <div aria-hidden className="absolute inset-0 grid" style={{ gridTemplateColumns: laneCols }}>
          {actors.map((a) => (
            <span key={a} className="mx-auto h-full w-0.5 rounded-full bg-line" />
          ))}
        </div>

        <ol className="relative list-none">
          {rows.map((r, i) => {
            if (r.type === 'note') {
              return (
                <li key={i} className="py-1.5">
                  <p className="mx-auto w-fit rounded-full border border-line bg-surface px-2.5 py-0.5 text-center text-[11px] leading-[1.5] break-keep text-faint">
                    <Inline text={r.text} />
                  </p>
                </li>
              )
            }

            no += 1
            const tone: SeqTone = r.tone ?? 'ok'
            const a = actors.indexOf(r.from)
            const b = actors.indexOf(r.to)
            const self = a === b
            const rightward = b > a
            const retry = isRetry(i, r.from, r.to)

            /*
             * 기둥을 손으로 정했는데 거기 없는 이름이 나오면 그릴 자리가 없다.
             * 걸음을 통째로 버리지 않고 화살표만 뺀다 — 설명은 남아야 한다.
             */
            const placed = a >= 0 && b >= 0

            /* 픽셀이 아니라 격자선이다. 주체 i의 기둥 = 격자선 i+2 */
            const span = self
              ? `${a + 2} / span 1`
              : `${Math.min(a, b) + 2} / ${Math.max(a, b) + 2}`

            return (
              <li key={i} className="pb-3 last:pb-1">
                <span className="sr-only">
                  {`${no}. ${r.from}에서 ${r.to}${needsEu(r.to) ? '으로' : '로'}: ${r.label}`}
                  {tone === 'fail' && ' (닿지 못했다)'}
                  {retry && ' (다시 보내는 것이다)'}
                </span>

                <div aria-hidden>
                  <div
                    className={placed ? 'grid items-center' : 'hidden'}
                    style={{ gridTemplateColumns: arrowCols }}
                  >
                    <div className="flex h-5 items-center" style={{ gridColumn: span }}>
                      {self ? (
                        /*
                         * 자기 자신에게. 왼쪽이 트인 고리라 기둥에서 나가
                         * 기둥으로 돌아온다. 칸 폭을 다 쓰지 않게 잘라둔다.
                         *
                         * **화살촉을 안 붙인다.** 붙여봤더니 고리의 트인 쪽과
                         * 겹쳐서 삼각형이 아니라 덩어리로 보였다. 돌아오는 고리는
                         * 그것만으로 방향이 분명하고, 시작점은 다른 걸음과 같은
                         * 점으로 찍으면 된다.
                         */
                        <span className="flex h-4 w-full max-w-[58px] items-center">
                          <span
                            className={`-mr-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone].dot}`}
                          />
                          <span
                            className={`h-4 flex-1 rounded-r-[7px] border-2 border-l-0 border-solid ${TONE[tone].line}`}
                          />
                        </span>
                      ) : rightward ? (
                        <>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone].dot}`} />
                          <span
                            className={`min-w-0 flex-1 border-t-2 ${TONE[tone].dash} ${TONE[tone].line}`}
                          />
                          {tone === 'fail' ? <Blocked /> : <Head dir="right" tone={tone} />}
                        </>
                      ) : (
                        <>
                          {tone === 'fail' ? <Blocked /> : <Head dir="left" tone={tone} />}
                          <span
                            className={`min-w-0 flex-1 border-t-2 ${TONE[tone].dash} ${TONE[tone].line}`}
                          />
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE[tone].dot}`} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* 폭을 통째로 쓴다. 배경이 있어 뒤의 생명선을 덮는다 */}
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 bg-raised px-0.5 text-[14px] leading-[1.55] break-keep text-ink">
                    <span className="font-mono text-[10px] text-faint">{no}</span>
                    {tone === 'fail' && (
                      <span className="rounded bg-warn-soft px-1.5 py-px text-[10px] leading-[1.5] font-medium text-warn">
                        닿지 못함
                      </span>
                    )}
                    {retry && (
                      <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] leading-[1.5] font-medium text-accent">
                        ↻ 다시
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <Inline text={r.label} />
                    </span>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {caption && (
        <figcaption className="mt-3 border-t border-line pt-2.5 text-[12px] leading-[1.6] break-keep text-faint">
          <Inline text={caption} />
        </figcaption>
      )}
    </figure>
  )
}
