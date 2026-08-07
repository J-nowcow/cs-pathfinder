import { Fragment } from 'react'
import { parseInline } from '@/lib/markdown/inline'

/**
 * 수치·크기·비율의 비교.
 *
 * 지금은 이런 것이 전부 표로 들어간다. 표는 값을 **읽게** 하지만 크기를
 * **보게** 하지는 못한다. `1 ns`와 `100 µs`가 같은 칸에 나란히 적히면 자릿수가
 * 다섯 벌어졌다는 사실이 글자 뒤로 숨는다. 캐시 이야기의 요점이 바로 그
 * 자릿수인데도 그렇다.
 *
 * **SVG 문자열을 넣지 않는다.** 여기는 div와 CSS 폭(%)뿐이다. 좌표를 손으로
 * 계산해 선을 긋는 방식은 이미 한 번 깨졌다 — 글자 길이를 모르는 채 자리를
 * 정하니 이름표가 서로 포개졌다. 폭은 브라우저가 재게 두고 우리는 비율만 준다.
 *
 * **그림이 없어도 뜻이 통해야 한다.** 이름·값·배수가 전부 눈에 보이는 글자다.
 * 막대는 `aria-hidden`이고, 낭독기는 목록을 그대로 읽는다. 색으로만 구분되는
 * 정보도 두지 않는다 — 띠의 조각은 번호로 가른다.
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

export type RatioItem = {
  /** 항목 이름 */
  name: string
  /** 크기. 항목끼리 **같은 단위**여야 한다. 그림은 이 값으로만 그린다 */
  value: number
  /** 화면에 적을 값. 없으면 `value`를 그대로 쓴다 */
  display?: string
  /** 한 줄 보탬말 */
  note?: string
}

/** 자릿수가 얼마나 벌어져야 눈금을 바꾸는가. 100배 = 두 자릿수 */
const DECADE_THRESHOLD = 100

/** 눈금 이름표가 서로 붙기 시작하는 칸 수. 넘으면 한 칸씩 건너뛴다 */
const TICK_CROWD = 6

/**
 * `10000` → `1만 배`.
 *
 * 자릿수가 큰 값을 아라비아 숫자로만 적으면 0을 세게 된다. `100000배`와
 * `10000배`는 눈으로 구별되지 않는다.
 */
function timesLabel(x: number): string {
  if (x >= 1e8) return `${round(x / 1e8)}억 배`
  if (x >= 1e4) return `${round(x / 1e4)}만 배`
  if (x >= 100) return `${Math.round(x).toLocaleString('ko-KR')}배`
  return `${Math.round(x * 10) / 10}배`
}

/** 큰 수는 반올림하고 작은 수만 소수점 한 자리를 남긴다 */
function round(x: number): string {
  const v = x >= 10 ? Math.round(x) : Math.round(x * 10) / 10
  return v.toLocaleString('ko-KR')
}

/**
 * `k`번째 칸이 뜻하는 배수.
 *
 * 0번 칸은 배수가 아니라 **기준 그 자체**다. 가장 작은 값이 딱 한 칸을
 * 차지하게 만드는 칸이라 `×1`이라고 적으면 오히려 헷갈린다.
 */
function decadeTick(k: number): string {
  if (k === 0) return '기준'
  const v = 10 ** k
  if (v < 1e4) return `×${v.toLocaleString('ko-KR')}`
  if (v < 1e8) return `×${(v / 1e4).toLocaleString('ko-KR')}만`
  return `×${(v / 1e8).toLocaleString('ko-KR')}억`
}

function valueText(it: RatioItem, unit: string): string {
  if (it.display) return it.display
  return unit ? `${it.value.toLocaleString('ko-KR')} ${unit}` : it.value.toLocaleString('ko-KR')
}

/**
 * 크기 비교.
 *
 * **자릿수가 벌어지는 값이 이 도식의 존재 이유다.** 캐시 1 ns와 디스크 10 ms를
 * 길이에 그대로 비례시키면 캐시는 0.00001칸이라 화면에 점 하나도 안 남는다.
 * 가장 중요한 항목이 가장 안 보인다.
 *
 * 그렇다고 막대 길이를 로그로 눕히는 것도 정직하지 않다. 사람은 막대를
 * **길이의 비**로 읽는다 — 두 배 긴 막대는 두 배로 읽힌다. 로그 막대에서
 * 두 배 긴 막대는 100배거나 1만 배거나 제멋대로다. 눈금을 작게 적어 두는
 * 것으로는 이 오독이 안 막힌다.
 *
 * 그래서 **길이를 재는 대신 칸을 센다.** 눈금을 자릿수 칸으로 끊고, 한 칸이
 * 10배라고 그림 위에 크게 적는다. 칸 사이에 실선이 보이므로 읽는 동작 자체가
 * "길이를 어림잡기"에서 "칸을 세기"로 바뀐다. 세는 것은 눈이 틀리지 않는다.
 * 가장 작은 값도 한 칸을 받으므로 사라지지 않는다.
 *
 * 자릿수가 두 개 미만이면 이 장치가 필요 없다. 그때는 그냥 길이에 비례시킨다 —
 * 안 벌어진 값에까지 로그를 씌우면 없는 왜곡을 만든다.
 */
export function RatioBars({
  items,
  scale = 'auto',
  unit = '',
}: {
  items: RatioItem[]
  /** `auto`는 자릿수가 두 개 이상 벌어질 때만 칸 눈금으로 바꾼다 */
  scale?: 'auto' | 'linear' | 'decade'
  /** 모든 값의 공통 단위. `display`가 있으면 그쪽이 이긴다 */
  unit?: string
}) {
  if (items.length === 0) return null

  const values = items.map((i) => i.value)
  const max = Math.max(...values)
  const positive = values.filter((v) => v > 0 && Number.isFinite(v))
  const min = positive.length > 0 ? Math.min(...positive) : 0

  /*
   * 0이나 음수가 하나라도 있으면 로그를 못 씌운다. 도식을 버리는 대신 길이
   * 비례로 떨어뜨린다 — 값이 안 벌어졌을 가능성이 높고, 벌어졌더라도 아무것도
   * 안 그리는 것보다 낫다.
   */
  const loggable = min > 0 && positive.length === values.length
  const spread = loggable ? max / min : 1
  const decade =
    loggable && (scale === 'decade' || (scale === 'auto' && spread >= DECADE_THRESHOLD))

  /* 가장 작은 값이 한 칸, 열 배마다 한 칸씩 */
  const cells = Math.max(2, Math.ceil(Math.log10(spread) - 1e-9) + 1)
  const tickStep = cells > TICK_CROWD ? 2 : 1

  /** 칸 눈금에서 이 값이 차지하는 칸 수 (1 ~ cells) */
  const span = (v: number) => Math.log10(v / min) + 1
  /** `c`번 칸이 얼마나 차는가 (0 ~ 1) */
  const fill = (v: number, c: number) => Math.min(1, Math.max(0, span(v) - c))

  const biggest = items[values.indexOf(max)]
  const smallest = loggable ? items[values.indexOf(min)] : null

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-4 py-3.5 sm:px-5">
      {/*
        그림을 못 보는 사람이 놓치는 것은 개별 값이 아니라 **전체가 얼마나
        벌어졌는가**다. 값 자체는 아래 목록에 글자로 다 있으므로 여기서는
        한눈에 들어오는 그 한 가지만 말한다.
      */}
      <p className="sr-only">
        {decade && smallest
          ? `${items.length}개 값을 자릿수 눈금으로 비교한다. 가장 작은 값은 ${smallest.name} ${valueText(smallest, unit)}, 가장 큰 값은 ${biggest.name} ${valueText(biggest, unit)}로 ${timesLabel(spread)} 차이난다.`
          : `${items.length}개 값을 막대 길이로 비교한다. 가장 큰 값은 ${biggest.name} ${valueText(biggest, unit)}다.`}
      </p>

      {/*
        눈금 머리. 칸마다 그 칸이 끝나는 자리의 배수를 적는다. 막대가 어느 칸에서
        멈췄는지 보면 대략의 배수가 바로 읽힌다.

        칸이 많아지면 이름표끼리 붙으므로 한 칸씩 건너뛴다. 이름표가 제 칸을
        넘어 옆으로 번지는 것은 그냥 둔다 — 옆 칸이 비어 있어 겹칠 것이 없고,
        바깥으로 새는 부분만 이 줄에서 잘라낸다.
      */}
      {decade && (
        <div
          aria-hidden
          className="mb-2.5 flex overflow-hidden border-b border-line pb-1.5"
        >
          {Array.from({ length: cells }, (_, k) => (
            <div
              key={k}
              className="flex-1 whitespace-nowrap text-center font-mono text-[10px] text-faint"
            >
              {k % tickStep === 0 ? decadeTick(k) : ''}
            </div>
          ))}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((it, i) => (
          <li key={i}>
            <p className="flex items-baseline justify-between gap-3">
              {/* min-w-0이 없으면 flex 항목이 글자 길이 아래로 안 줄어 이름이 옆으로 샌다 */}
              <span className="min-w-0 break-keep text-[14px] font-medium leading-[1.5] text-ink">
                <Inline text={it.name} />
              </span>
              <span className="shrink-0 text-[12px] text-muted">
                <span className="font-mono">{valueText(it, unit)}</span>
                {/*
                  배수는 그림에서 어림잡는 값이라 반드시 글자로도 있어야 한다.
                  칸을 세어 "다섯 칸쯤"까지는 읽히지만 "10만 배"는 안 읽힌다.
                */}
                {decade && (
                  <span className="text-faint">
                    {' · '}
                    {it.value === min ? '기준' : timesLabel(it.value / min)}
                  </span>
                )}
              </span>
            </p>

            <div
              aria-hidden
              className="mt-1.5 flex h-3.5 overflow-hidden rounded-[3px] border border-line bg-surface"
            >
              {decade ? (
                Array.from({ length: cells }, (_, c) => (
                  <div key={c} className={c > 0 ? 'flex-1 border-l border-line' : 'flex-1'}>
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${fill(it.value, c) * 100}%` }}
                    />
                  </div>
                ))
              ) : (
                <div
                  className="h-full bg-accent"
                  style={{
                    /* 값이 아주 작아도 자국은 남긴다. 2px는 0.6칸이라 왜곡이 눈에 안 띈다 */
                    width: max > 0 ? `${Math.max(0, (it.value / max) * 100)}%` : '0%',
                    minWidth: it.value > 0 ? '2px' : undefined,
                  }}
                />
              )}
            </div>

            {it.note && (
              <p className="mt-1 text-[12px] leading-[1.55] text-faint">
                <Inline text={it.note} />
              </p>
            )}
          </li>
        ))}
      </ul>

      {/*
        읽는 법을 그림 안에 둔다. 로그 눈금이 오독되는 이유의 절반은 눈금이
        로그라는 사실을 아무도 안 말해 주기 때문이다.
      */}
      {decade && (
        <figcaption className="mt-3 border-t border-line pt-2.5 text-[12px] leading-[1.55] text-faint">
          눈금 한 칸이 <span className="text-accent">10배</span>다. 막대가 멈춘 칸의 눈금이
          대강의 배수이고, 정확한 값은 항목 오른쪽에 적었다.
        </figcaption>
      )}
    </figure>
  )
}

/**
 * 무엇이 전체의 얼마를 차지하는가.
 *
 * 막대 비교와 다르다. 저쪽은 **따로 있는 값들의 크기**를 견주고, 이쪽은
 * **하나를 나눠 가진 몫**을 본다. 최소 이더넷 프레임에서 헤더가 몇 바이트인지는
 * 표로도 읽히지만, 그 헤더가 프레임의 **절반을 넘는다**는 사실은 나란히 붙여
 * 놓아야 보인다.
 *
 * **조각을 색으로 구분하지 않는다.** 쓸 수 있는 색이 강조색 한 벌뿐이라
 * 억지로 나누면 명도만 다른 청록 다섯 개가 되고, 그러면 색맹은 물론 멀쩡한
 * 눈으로도 범례와 조각을 못 잇는다. 대신 조각마다 번호를 넣고 아래 목록에
 * 같은 번호를 단다. 번호는 흑백으로 인쇄해도 남는다.
 *
 * **작은 조각을 억지로 키우지 않는다.** 6바이트가 전체의 9%면 9%로 그린다.
 * 최소 폭을 주면 "작다"는 사실 자체가 지워진다 — 그 사실이 대개 요점이다.
 * 대신 목록에 정확한 값과 백분율을 적어 둔다.
 */
export function RatioBand({
  items,
  unit = '',
}: {
  items: RatioItem[]
  unit?: string
}) {
  const total = items.reduce((s, it) => s + Math.max(0, it.value), 0)
  if (items.length === 0 || total <= 0) return null

  const pct = (v: number) => (Math.max(0, v) / total) * 100
  /** 번호가 조각 안에 들어갈 만한가. 25px 아래면 글자가 잘린다 */
  const roomy = (v: number) => pct(v) >= 8

  return (
    <figure className="my-6 rounded-lg border border-line bg-raised px-4 py-3.5 sm:px-5">
      <p className="sr-only">
        {`전체 ${total.toLocaleString('ko-KR')}${unit ? ` ${unit}` : ''}를 ${items.length}조각으로 나눈 구성비. 가장 큰 조각은 ${
          items.reduce((a, b) => (b.value > a.value ? b : a)).name
        }로 ${pct(Math.max(...items.map((i) => i.value))).toFixed(1)}퍼센트다.`}
      </p>

      {/*
        조각 사이는 빈틈으로 가른다. flex의 gap을 쓰면 폭 합이 100%를 넘어
        마지막 조각이 밀려 나가므로, 테두리로 안쪽을 깎는다(box-sizing이
        border-box라 폭 안에서 먹는다).
      */}
      <div aria-hidden className="flex h-7 overflow-hidden rounded-[4px] border border-line">
        {items.map((it, i) => (
          <div
            key={i}
            className={`flex items-center justify-center bg-accent ${
              i > 0 ? 'border-l-2 border-raised' : ''
            }`}
            style={{ width: `${pct(it.value)}%` }}
          >
            {roomy(it.value) && (
              <span className="font-mono text-[10px] leading-none text-on-accent">{i + 1}</span>
            )}
          </div>
        ))}
      </div>

      <ol className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-baseline gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center self-start rounded-full bg-accent-soft font-mono text-[10px] text-accent"
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 break-keep text-[14px] leading-[1.5] text-ink">
              <Inline text={it.name} />
              {it.note && (
                <span className="mt-0.5 block text-[12px] leading-[1.55] text-faint">
                  <Inline text={it.note} />
                </span>
              )}
            </span>
            <span className="shrink-0 text-[12px] text-muted">
              <span className="font-mono">{valueText(it, unit)}</span>
              <span className="text-faint">{` · ${pct(it.value).toFixed(1)}%`}</span>
            </span>
          </li>
        ))}
      </ol>

      <figcaption className="mt-3 border-t border-line pt-2.5 text-[12px] leading-[1.55] text-faint">
        전체 {total.toLocaleString('ko-KR')}
        {unit ? ` ${unit}` : ''}를 100으로 놓고 나눈 몫이다. 띠 안의 번호가 아래 목록의 번호와
        같다.
      </figcaption>
    </figure>
  )
}
