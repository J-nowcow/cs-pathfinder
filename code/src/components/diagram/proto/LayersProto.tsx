/**
 * 층으로 쌓인 것 — 시안.
 *
 * 지금 `stack`은 테두리를 친 목록이다. 그래서 "위"에 아무 뜻이 없다. 뜻이
 * 없으니 표로 읽히고, 표로 읽히니 그림이 아니다.
 *
 * **축이 이 시안의 전부다.** 그림 위아래에 "위쪽이 무엇인가"를 문장으로 적는다.
 * 축이 붙는 순간 같은 목록이 도식이 된다 — 눈금이 있어야 그래프인 것과 같다.
 *
 * 축 문장은 **보이는 글**이다. 숨긴 글(`sr-only`)로 두지 않는다. 방향은 이
 * 도식에서 가장 틀리기 쉬운 것이라 눈으로 읽는 사람도 같이 봐야 한다. 덤으로
 * 낭독기용 사본을 따로 유지할 필요가 없다.
 *
 * **SVG를 쓰지 않는다.** 좌표를 손으로 계산한 시안은 글자 길이가 조금만 달라져도
 * 선과 이름표가 겹쳤다. 여기는 전부 flex와 grid라 폭이 남거나 모자라도 브라우저가
 * 알아서 민다.
 *
 * 색은 `--color-*` 토큰만 쓴다. 깊이 램프(`--d1`~`--d5`)는 "얼마나 팠는지"에
 * 예약된 뜻이라 도식이 빌려 쓰면 안 된다.
 */

/** 자라는 방향 */
type Grow = 'up' | 'down'

/**
 * 주어 조사를 붙인다.
 *
 * 빈 공간 칸에 "스택이 내려온다"를 그려야 하는데 이름은 본문에서 온다. 받침을
 * 안 보고 `이`로 고정하면 "코드이 올라온다"가 나온다.
 */
function subj(word: string): string {
  const last = word.trim().slice(-1)
  const code = last.charCodeAt(0)
  const hangul = code >= 0xac00 && code <= 0xd7a3
  return `${word}${hangul && (code - 0xac00) % 28 !== 0 ? '이' : '가'}`
}

/**
 * 축 눈금.
 *
 * 삼각형은 테두리로 그린다. 글꼴에 있는 ▲ 글리프를 쓰면 기기마다 크기와
 * 기준선이 달라 글자와 안 맞는다. 오른쪽 실선은 "여기가 끝"을 말한다 —
 * 이것 하나로 문단이 아니라 눈금으로 읽힌다.
 */
function Cap({ dir, text }: { dir: Grow; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-faint">
      <span
        aria-hidden
        className="h-0 w-0 shrink-0"
        style={{
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          ...(dir === 'up'
            ? { borderBottom: '6px solid currentColor' }
            : { borderTop: '6px solid currentColor' }),
        }}
      />
      <span>{text}</span>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-line" />
    </div>
  )
}

/**
 * `<p>`를 안 쓴다.
 *
 * `globals.css`의 `.prose-body figure p`가 행간을 `inherit`으로 되돌린다.
 * 그 규칙은 레이어 밖에 있어서 Tailwind 유틸리티를 이긴다 — 시안 페이지에서
 * 맞춰 놓은 간격이 해설 본문에 넣는 순간 달라진다. `div`와 `span`으로 쓰면
 * 두 자리가 같게 나온다.
 */

/* ────────────────────────────── 연속한 공간 ────────────────────────────── */

export type Slice = {
  name: string
  note?: string
  /** 자라는 방향. 스택은 아래로, 힙은 위로 */
  grow?: Grow
  /** 아무것도 없는 칸. 스택과 힙 사이 */
  empty?: boolean
}

/**
 * 프로세스 메모리처럼 **연속한 공간**을 나눈 것.
 *
 * 칸을 맞붙여 그린다. 사이를 띄우면 층마다 따로 떠 있는 것으로 읽히는데,
 * 메모리는 하나의 주소 공간을 자른 것이라 그 뜻이 반대다. 붙어 있는 모양
 * 자체가 "이어진 하나"라는 정보다.
 *
 * **빈 공간을 크게 그리는 것이 이 도식의 요점이다.** 칸 높이를 전부 같게 두면
 * 어느 칸이든 그냥 표의 한 줄이다. 빗금 친 넓은 칸 하나가 들어가는 순간 그림이
 * 된다 — 그리고 그 칸이 실제로 이 도식이 말하려는 것이다. 스택과 힙은 그
 * 빈 곳을 향해 마주 자라고, 다 쓰면 부딪힌다.
 */
export function MemoryMap({
  up,
  down,
  slices,
}: {
  up?: string
  down?: string
  slices: Slice[]
}) {
  return (
    <figure className="my-6">
      {up && <Cap dir="up" text={up} />}

      <ol className="my-1.5 overflow-hidden rounded-lg border border-line bg-raised">
        {slices.map((s, i) => {
          const edge = i > 0 ? 'border-t border-line' : ''

          /* 빈 칸. 위아래 이웃이 이쪽으로 자라면 그 사실을 칸 안에 적는다 */
          if (s.empty) {
            const from = slices[i - 1]?.grow === 'down' ? slices[i - 1].name : null
            const into = slices[i + 1]?.grow === 'up' ? slices[i + 1].name : null

            return (
              <li
                key={i}
                className={edge}
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(135deg, var(--line) 0 1px, transparent 1px 8px)',
                }}
              >
                {/*
                  칸이 셋이라 `justify-between`이 위·가운데·아래로 벌린다.
                  이웃이 안 자라면 빈 자리만 남긴다 — 없애 버리면 가운데
                  이름이 위나 아래로 딸려 간다.
                */}
                <div className="flex min-h-[104px] flex-col items-center justify-between gap-1 px-4 py-2.5">
                  {from ? (
                    <span className="rounded bg-raised px-2 py-0.5 text-[11px] text-accent">
                      <span aria-hidden>↓ </span>
                      {subj(from)} 내려온다
                    </span>
                  ) : (
                    <span aria-hidden />
                  )}

                  <span className="rounded bg-raised px-2 py-0.5 text-[12.5px] text-faint">
                    {s.name}
                  </span>

                  {into ? (
                    <span className="rounded bg-raised px-2 py-0.5 text-[11px] text-accent">
                      <span aria-hidden>↑ </span>
                      {subj(into)} 올라온다
                    </span>
                  ) : (
                    <span aria-hidden />
                  )}
                </div>
              </li>
            )
          }

          return (
            <li key={i} className={edge}>
              <div className="px-4 py-3 sm:px-5">
                <div className="flex items-baseline justify-between gap-2.5">
                  <span className="text-[15px] font-medium text-ink">{s.name}</span>

                  {/*
                    방향은 글로 적는다. `↓` 하나만 두면 낭독기가 아무것도 안
                    읽는데, 이 도식에서 방향은 곁가지가 아니라 본론이다.
                  */}
                  {s.grow && (
                    <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                      <span aria-hidden>{s.grow === 'down' ? '↓ ' : '↑ '}</span>
                      {s.grow === 'down' ? '아래로 자란다' : '위로 자란다'}
                    </span>
                  )}
                </div>

                {s.note && (
                  <div className="mt-0.5 text-[13px] text-muted">{s.note}</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {down && <Cap dir="down" text={down} />}
    </figure>
  )
}

/* ────────────────────────────── 쌓인 판 ────────────────────────────── */

export type Frame = {
  name: string
  note?: string
  /** 그 프레임 안에 든 것. 지역 변수·돌아갈 주소 같은 것 */
  slots?: string[]
}

/**
 * 함수 호출 프레임처럼 **하나씩 얹힌 것**.
 *
 * 메모리와 **일부러 다르게 그린다.** 칸을 띄우고 테두리를 각자 준다. 같은 모양에
 * 축 문장만 바꿔 두면 앞 도식에서 읽은 "위 = 높은 주소"를 그대로 들고 온다.
 * 실제로 호출 스택은 주소로 보면 아래로 자라므로, 여기서 "위 = 최근"은 주소
 * 방향과 **반대**다. 이 도식에서 방향을 헷갈리면 뜻이 뒤집힌다.
 *
 * 칸 안에 든 것을 작은 조각으로 보여 준다. 표의 한 줄에는 없는 결이라, 이름만
 * 적힌 목록과 눈으로 구별된다.
 *
 * 맨 위와 맨 아래에만 이름표를 붙인다. 번호를 매기면 "1번 다음 2번"으로
 * 읽히는데 이것은 차례가 아니라 **쌓인 순서**다.
 */
export function CallStack({
  up,
  down,
  frames,
}: {
  up?: string
  down?: string
  frames: Frame[]
}) {
  return (
    <figure className="my-6">
      {up && <Cap dir="up" text={up} />}

      <ol className="my-1.5 space-y-1.5">
        {frames.map((f, i) => {
          const top = i === 0
          const bottom = i === frames.length - 1

          return (
            <li
              key={i}
              className={`rounded-lg border bg-raised px-3.5 py-3 ${
                top ? 'border-accent' : 'border-line'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2.5">
                <span
                  className={`text-[15px] font-medium ${top ? 'text-ink' : 'text-muted'}`}
                >
                  {f.name}
                </span>

                {top && (
                  <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                    지금 실행 중
                  </span>
                )}
                {bottom && !top && (
                  <span className="shrink-0 text-[11px] text-faint">맨 처음 호출</span>
                )}
              </div>

              {f.note && <div className="mt-0.5 text-[13px] text-muted">{f.note}</div>}

              {f.slots && f.slots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.slots.map((s, j) => (
                    <span
                      key={j}
                      className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {down && <Cap dir="down" text={down} />}
    </figure>
  )
}

/* ────────────────────────────── 겹겹이 감싸기 ────────────────────────────── */

export type Wrap = {
  /** 계층 이름. `전송` 같은 것 */
  name: string
  /** 이 계층이 붙이는 것. 맨 위 계층은 붙이는 대신 알맹이를 만든다 */
  part: string
  note?: string
  /** 뒤에 붙는 것. 이더넷의 FCS 정도만 있다 */
  tail?: string
}

/**
 * 캡슐화 — **층이 아니다.**
 *
 * 층으로 그리면 "네 칸이 위아래로 있다"까지만 전해지고 정작 알맹이가 사라진다.
 * 캡슐화의 뜻은 쌓인 것이 아니라 **감싼 것**이다. 내려갈 때마다 앞에 헤더가
 * 하나씩 붙고, 위에서 온 것은 통째로 안쪽에 들어간다.
 *
 * 그래서 가로 막대로 그린다. 한 줄이 한 계층에서의 **패킷 생김새**다. 아래로
 * 내려갈수록 왼쪽에 칸이 하나씩 늘어난다.
 *
 * **새로 붙인 칸만 색이 진하다.** 나머지는 위에서 내려온 그대로다 — 아래
 * 계층은 그 안을 열어 보지 않는다는 것이 색으로 읽힌다. 이 한 가지가 캡슐화를
 * 층과 갈라놓는 것이라 색으로도 글로도 말한다.
 *
 * 헤더 칸은 `shrink-0`, 알맹이는 `flex-1 truncate`다. 폭이 모자라면 알맹이만
 * 줄어들고 가로 스크롤이 안 생긴다. 계층 다섯이 한계이고, 그보다 많으면
 * (OSI 7계층 같은 것) 캡슐화가 아니라 그냥 층으로 그릴 자리다.
 */
export function Encapsulation({
  up,
  down,
  layers,
}: {
  up?: string
  down?: string
  layers: Wrap[]
}) {
  return (
    <figure className="my-6">
      {up && <Cap dir="up" text={up} />}

      <ol className="my-1.5 space-y-2.5 rounded-lg border border-line bg-raised px-3.5 py-3.5">
        {layers.map((l, i) => (
          <li key={i}>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-medium text-ink">{l.name}</span>
              {l.note && <span className="text-[12px] text-muted">{l.note}</span>}
            </div>

            {/*
              이 계층에서 본 패킷. 맨 앞이 방금 붙인 것, 그 뒤가 위에서 온 것.

              헤더 칸이 `shrink-0`이라 이름이 길면 이론상 넘칠 수 있다. 넘치면
              **본문이 통째로 옆으로 밀린다** — 도식 하나가 페이지를 망가뜨리는
              모양이라 여기서 잘라 막는다. 실제로는 알맹이가 먼저 줄어들어
              여기까지 오지 않는다.
            */}
            <div className="mt-1.5 flex items-stretch gap-1 overflow-hidden">
              {Array.from({ length: i + 1 }, (_, k) => i - k).map((k) => {
                const isNew = k === i
                const isBody = k === 0

                return (
                  <span
                    key={k}
                    className={[
                      'truncate rounded border px-1.5 py-1.5 text-[10.5px]',
                      isBody ? 'min-w-0 flex-1 text-center' : 'shrink-0 font-mono',
                      isNew
                        ? 'border-accent bg-accent-soft text-accent'
                        : isBody
                          ? 'border-line bg-surface text-muted'
                          : 'border-line bg-surface text-faint',
                    ].join(' ')}
                  >
                    {layers[k].part}
                  </span>
                )
              })}

              {l.tail && (
                <span className="shrink-0 truncate rounded border border-accent bg-accent-soft px-1.5 py-1.5 font-mono text-[10.5px] text-accent">
                  {l.tail}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="text-[12px] leading-[1.65] text-muted">
        색이 진한 칸이 그 계층에서 새로 붙인 것이다. 나머지는 위에서 내려온 그대로다 —
        아래 계층은 그 안을 열어 보지 않는다.
      </div>

      {down && <Cap dir="down" text={down} />}
    </figure>
  )
}
