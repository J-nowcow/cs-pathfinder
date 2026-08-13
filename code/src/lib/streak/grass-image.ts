import type { Cell } from '@/lib/streak/grass'

/**
 * 잔디를 그림 한 장으로 굽는다.
 *
 * 자랑할 데가 카톡이라 링크가 아니라 그림이어야 한다. 링크를 보내면 받은
 * 사람은 남의 기록 페이지를 열어야 하고, 로그인 전 기록은 브라우저에만
 * 있으니 열어도 자기 잔디가 뜬다. 그림이면 그냥 보인다.
 *
 * **서버에서 굽지 않는다.** 잔디의 재료가 localStorage에 있어서 서버는 그
 * 사람의 기록을 모른다. 브라우저 canvas로 그리면 왕복도 비용도 없다.
 *
 * 붓(`ctx`)을 **주입받는다.** 캔버스를 이 안에서 만들면 시험 환경(happy-dom,
 * 2D 컨텍스트가 없다)에서 한 줄도 못 잰다. 쓰는 것은 아래 여섯 개뿐이다.
 */
export type GrassImageContext = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'font' | 'textBaseline' | 'fillRect' | 'fillText' | 'scale'
>

export type GrassImageStats = { total: number; distinct: number; streak: number }

/**
 * 그림의 색.
 *
 * 화면 잔디는 `color-mix(in oklab, ...)`로 테마를 따라가지만 캔버스는 CSS를
 * 모른다. 그래서 **다크 테마 값을 oklab에서 미리 섞어 굳혔다** — 레벨 1~4는
 * `--d0`(#34c0ac)을 `--raised`(#191d22)에 28/50/74/100% 섞은 결과다.
 *
 * 라이트 테마로도 굽지 않는다. 공유한 그림은 남의 화면에 뜨는데 그쪽 테마는
 * 알 수 없고, 어두운 배경이 어디 얹혀도 잔디로 읽힌다.
 */
export const GRASS_IMAGE_PALETTE = {
  bg: '#101317',
  card: '#191d22',
  ink: '#e5e8ec',
  muted: '#9aa2ac',
  levels: ['#272c33', '#274645', '#2f6963', '#349285', '#34c0ac'],
} as const

/** 폰 화면에 얹어도 뭉개지지 않게 두 배로 굽는다 */
export const GRASS_IMAGE_SCALE = 2

/* 화면 잔디와 같은 칸 크기다. 여기를 바꾸면 그림만 다른 모양이 된다 */
const CELL = 11
const GAP = 3
const ROWS = 7

const PAD = 20
const CARD_PAD = 18
const TITLE_H = 22
const TITLE_GAP = 14
const GRID_H = ROWS * CELL + (ROWS - 1) * GAP
const STAT_GAP = 16
const STAT_H = 18
const FOOT_GAP = 6
const FOOT_H = 14

/**
 * 글꼴.
 *
 * 한글이 실린 것부터 세운다. 캔버스는 없는 글꼴을 만나면 조용히 다음으로
 * 넘어가는데, 마지막이 sans-serif뿐이면 기기에 따라 네모로 깨진다.
 */
const FAMILY =
  'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", system-ui, "Malgun Gothic", sans-serif'

/**
 * 그림에 굽는 이름과 주소.
 *
 * `@/lib/site`에서 가져오지 않는다. 그 모듈은 불러오는 즉시 `process.env`를
 * 읽는데 여기는 브라우저에서 도는 코드다. 게다가 `SITE_URL`은 클라이언트에서
 * `NEXT_PUBLIC_SITE_URL`이 없으면 localhost로 떨어져서 **공유한 그림에
 * localhost가 박힌다** — 한번 구운 그림은 되돌릴 방법이 없다.
 *
 * 이름을 바꾸면 여기도 바꿔야 한다. 그 값이면 그럴 만하다.
 */
const TITLE = 'CS 길라잡이 — 학습 기록'
const SITE_HOST = 'cs-pathfinder.vercel.app'

/** 공유 시트에 띄울 제목. 그림에 굽는 제목과 같아야 한다 */
export const GRASS_IMAGE_TITLE = TITLE

function gridWidth(weeks: Array<Array<Cell | null>>): number {
  if (weeks.length === 0) return 0
  return weeks.length * CELL + (weeks.length - 1) * GAP
}

/**
 * 캔버스에 넣을 크기.
 *
 * 돌려주는 값은 **이미 배율이 곱해진 픽셀**이다. `canvas.width`에 그대로
 * 넣으면 된다 — 그리는 쪽이 `ctx.scale`을 걸어 두므로 좌표는 배율을 몰라도 된다.
 */
export function grassImageSize(weeks: Array<Array<Cell | null>>): {
  width: number
  height: number
  scale: number
} {
  const width = gridWidth(weeks) + (CARD_PAD + PAD) * 2
  const height =
    CARD_PAD * 2 + TITLE_H + TITLE_GAP + GRID_H + STAT_GAP + STAT_H + FOOT_GAP + FOOT_H + PAD * 2

  return {
    width: width * GRASS_IMAGE_SCALE,
    height: height * GRASS_IMAGE_SCALE,
    scale: GRASS_IMAGE_SCALE,
  }
}

/** 판 날이 며칠인가. 잔디 자체가 답을 갖고 있어서 따로 받지 않는다 */
function activeDays(weeks: Array<Array<Cell | null>>): number {
  return weeks.flat().filter((c) => c !== null && c.count > 0).length
}

/**
 * 그린다.
 *
 * 좌표는 전부 CSS 픽셀이다. 맨 앞에서 배율을 한 번 걸고 그 안에서는 화면과
 * 같은 숫자를 쓴다 — 칸 크기 11이 두 곳에서 갈라지지 않게.
 */
export function drawGrassImage(
  ctx: GrassImageContext,
  weeks: Array<Array<Cell | null>>,
  stats: GrassImageStats,
): void {
  ctx.scale(GRASS_IMAGE_SCALE, GRASS_IMAGE_SCALE)
  ctx.textBaseline = 'top'

  const cardW = gridWidth(weeks) + CARD_PAD * 2
  const cardH =
    CARD_PAD * 2 + TITLE_H + TITLE_GAP + GRID_H + STAT_GAP + STAT_H + FOOT_GAP + FOOT_H

  ctx.fillStyle = GRASS_IMAGE_PALETTE.bg
  ctx.fillRect(0, 0, cardW + PAD * 2, cardH + PAD * 2)

  ctx.fillStyle = GRASS_IMAGE_PALETTE.card
  ctx.fillRect(PAD, PAD, cardW, cardH)

  const left = PAD + CARD_PAD
  const titleY = PAD + CARD_PAD
  const gridY = titleY + TITLE_H + TITLE_GAP
  const statY = gridY + GRID_H + STAT_GAP
  const footY = statY + STAT_H + FOOT_GAP

  ctx.fillStyle = GRASS_IMAGE_PALETTE.ink
  ctx.font = `600 17px ${FAMILY}`
  ctx.fillText(TITLE, left, titleY)

  /* 칸. 세로가 요일이고 가로가 주다 — 화면과 같은 모양이어야 자기 잔디로 알아본다 */
  weeks.forEach((week, w) => {
    week.forEach((cell, d) => {
      if (cell === null) return
      ctx.fillStyle = GRASS_IMAGE_PALETTE.levels[cell.level]
      ctx.fillRect(left + w * (CELL + GAP), gridY + d * (CELL + GAP), CELL, CELL)
    })
  })

  ctx.fillStyle = GRASS_IMAGE_PALETTE.ink
  ctx.font = `600 14px ${FAMILY}`
  ctx.fillText(
    `질문 ${stats.distinct}개 · ${activeDays(weeks)}일 · 연속 ${stats.streak}일`,
    left,
    statY,
  )

  ctx.fillStyle = GRASS_IMAGE_PALETTE.muted
  ctx.font = `400 12px ${FAMILY}`
  ctx.fillText(`모두 ${stats.total}번 열어 봄 · ${SITE_HOST}`, left, footY)
}
