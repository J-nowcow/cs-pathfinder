import { describe, it, expect } from 'vitest'
import {
  GRASS_IMAGE_PALETTE,
  GRASS_IMAGE_SCALE,
  drawGrassImage,
  grassImageSize,
  type GrassImageContext,
} from '@/lib/streak/grass-image'
import type { Cell } from '@/lib/streak/grass'

/**
 * 잔디를 그림으로 굽는 일.
 *
 * 시험 환경(happy-dom)에는 canvas 2D가 없다. 그래서 그리는 함수는 붓을
 * **주입받는다** — 진짜 캔버스든 여기 가짜든 같은 몇 개만 쓴다. 덕분에
 * 좌표와 색을 눈이 아니라 숫자로 잴 수 있다.
 *
 * 색은 화면 잔디를 oklab에서 섞은 값을 그대로 굳힌 것이다. 화면은
 * color-mix로 테마를 따라가지만 캔버스는 CSS를 모른다. 두 벌이 갈라지면
 * 공유한 그림만 다른 색이 되므로 여기서 전수로 잡아 둔다.
 */
type Op =
  | { op: 'rect'; style: string; x: number; y: number; w: number; h: number }
  | { op: 'text'; style: string; font: string; text: string; x: number; y: number }

function mockCtx() {
  const ops: Op[] = []
  const scales: Array<[number, number]> = []
  const ctx: GrassImageContext = {
    fillStyle: '',
    font: '',
    textBaseline: 'alphabetic',
    fillRect(x, y, w, h) {
      ops.push({ op: 'rect', style: String(ctx.fillStyle), x, y, w, h })
    },
    fillText(text, x, y) {
      ops.push({ op: 'text', style: String(ctx.fillStyle), font: ctx.font, text, x, y })
    },
    scale(x, y) {
      scales.push([x, y])
    },
  }
  return {
    ctx,
    ops,
    scales,
    rects: () => ops.filter((o): o is Extract<Op, { op: 'rect' }> => o.op === 'rect'),
    texts: () => ops.filter((o): o is Extract<Op, { op: 'text' }> => o.op === 'text'),
  }
}

function cell(day: string, level: Cell['level']): Cell {
  return { day, count: level, level }
}

/** 다섯 단계가 한 주에 다 들어 있는 격자. 마지막 두 칸은 아직 오지 않은 날이다 */
const ALL_LEVELS: Array<Array<Cell | null>> = [
  [
    cell('2026-08-02', 0),
    cell('2026-08-03', 1),
    cell('2026-08-04', 2),
    cell('2026-08-05', 3),
    cell('2026-08-06', 4),
    null,
    null,
  ],
]

const STATS = { total: 55, distinct: 42, streak: 7 }

describe('그림 크기', () => {
  it('선명하게 두 배로 굽는다', () => {
    expect(GRASS_IMAGE_SCALE).toBe(2)
    const { width, height, scale } = grassImageSize(ALL_LEVELS)
    expect(scale).toBe(2)
    /* 캔버스 픽셀은 이미 배율이 곱해진 값이다 — 호출부가 다시 곱하면 안 된다 */
    expect(width % 2).toBe(0)
    expect(height % 2).toBe(0)
  })

  it('주가 늘면 가로만 늘고 세로는 그대로다', () => {
    const one = grassImageSize(ALL_LEVELS)
    const three = grassImageSize([ALL_LEVELS[0], ALL_LEVELS[0], ALL_LEVELS[0]])

    expect(three.height).toBe(one.height)
    /* 한 주는 칸 하나에 사이 간격 하나다 */
    expect(three.width - one.width).toBe(2 * (11 + 3) * GRASS_IMAGE_SCALE)
  })

  it('26주도 공유할 만한 크기다', () => {
    const weeks = Array.from({ length: 26 }, () => ALL_LEVELS[0])
    const { width, height } = grassImageSize(weeks)
    expect(width).toBeGreaterThan(600)
    expect(width).toBeLessThan(1400)
    expect(height).toBeGreaterThan(300)
  })
})

describe('잔디 그리기', () => {
  it('배경과 카드를 깔고 그 위에 칸을 놓는다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)

    /* 배경 1 + 카드 1 + 칸 5. null 칸은 그리지 않는다 */
    expect(m.rects().length).toBe(2 + 5)
    expect(m.rects()[0].style).toBe(GRASS_IMAGE_PALETTE.bg)
    expect(m.rects()[1].style).toBe(GRASS_IMAGE_PALETTE.card)
  })

  it('배율을 붓에 먼저 걸어 둔다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)
    expect(m.scales[0]).toEqual([GRASS_IMAGE_SCALE, GRASS_IMAGE_SCALE])
  })

  /** 화면 잔디와 같은 색이어야 한다. 공유한 그림만 다른 색이면 그건 다른 기록이다 */
  it('단계마다 정해진 색을 쓴다 — 0부터 4까지 전부', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)

    const cells = m.rects().slice(2)
    expect(cells.map((c) => c.style)).toEqual([
      GRASS_IMAGE_PALETTE.levels[0],
      GRASS_IMAGE_PALETTE.levels[1],
      GRASS_IMAGE_PALETTE.levels[2],
      GRASS_IMAGE_PALETTE.levels[3],
      GRASS_IMAGE_PALETTE.levels[4],
    ])
  })

  it('빈 칸도 색이 있다 — 안 판 날이 보여야 판 날이 읽힌다', () => {
    expect(GRASS_IMAGE_PALETTE.levels[0]).toBe('#272c33')
    expect(GRASS_IMAGE_PALETTE.levels[4]).toBe('#34c0ac')
    expect(new Set(GRASS_IMAGE_PALETTE.levels).size).toBe(5)
  })

  it('세로가 요일이고 가로가 주다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, [ALL_LEVELS[0], ALL_LEVELS[0]], STATS)
    const cells = m.rects().slice(2)

    /* 같은 주 안에서는 아래로 내려간다 */
    expect(cells[1].x).toBe(cells[0].x)
    expect(cells[1].y - cells[0].y).toBe(11 + 3)
    /* 다음 주는 오른쪽이다 */
    expect(cells[5].x - cells[0].x).toBe(11 + 3)
    expect(cells[5].y).toBe(cells[0].y)
    /* 칸은 정사각형이다 */
    expect(cells[0].w).toBe(11)
    expect(cells[0].h).toBe(11)
  })
})

describe('그림에 적는 말', () => {
  it('제목과 숫자와 주소를 적는다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)
    const said = m.texts().map((t) => t.text)

    expect(said.some((t) => t.includes('CS 길라잡이'))).toBe(true)
    expect(said.some((t) => t.includes('학습 기록'))).toBe(true)
    expect(said.some((t) => t.includes('cs-pathfinder.vercel.app'))).toBe(true)
  })

  it('센 것을 그대로 적는다 — 판 질문, 판 날, 이어서 판 날', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)
    const summary = m.texts().find((t) => t.text.includes('질문'))!

    expect(summary.text).toContain('42개')
    /* 다섯 칸 가운데 편수가 0인 하루를 뺀 네 날 */
    expect(summary.text).toContain('4일')
    expect(summary.text).toContain('7일')
    /* 연 횟수는 아래 줄에 있다 */
    expect(m.texts().some((t) => t.text.includes('55'))).toBe(true)
  })

  it('한 번도 안 판 사람도 문장이 깨지지 않는다', () => {
    const m = mockCtx()
    const empty: Array<Array<Cell | null>> = [[cell('2026-08-02', 0), null, null, null, null, null, null]]
    drawGrassImage(m.ctx, empty, { total: 0, distinct: 0, streak: 0 })

    const summary = m.texts().find((t) => t.text.includes('질문'))!
    expect(summary.text).toContain('0개')
    expect(summary.text).toContain('0일')
  })

  it('한글이 깨지지 않게 시스템 글꼴을 쓴다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)
    for (const t of m.texts()) {
      expect(t.font).toContain('Apple SD Gothic Neo')
      expect(t.font).toMatch(/\d+px/)
    }
  })

  it('글씨는 배경이 아니라 글씨 색으로 적는다', () => {
    const m = mockCtx()
    drawGrassImage(m.ctx, ALL_LEVELS, STATS)
    const styles = new Set(m.texts().map((t) => t.style))
    expect(styles.has(GRASS_IMAGE_PALETTE.ink)).toBe(true)
    expect(styles.has(GRASS_IMAGE_PALETTE.bg)).toBe(false)
    expect(styles.has(GRASS_IMAGE_PALETTE.card)).toBe(false)
  })

  it('글씨가 카드 밖으로 나가지 않는다', () => {
    const m = mockCtx()
    const weeks = Array.from({ length: 26 }, () => ALL_LEVELS[0])
    drawGrassImage(m.ctx, weeks, STATS)

    const card = m.rects()[1]
    for (const t of m.texts()) {
      expect(t.x).toBeGreaterThanOrEqual(card.x)
      expect(t.x).toBeLessThan(card.x + card.w)
      expect(t.y).toBeGreaterThanOrEqual(card.y)
      expect(t.y).toBeLessThan(card.y + card.h)
    }
  })
})
