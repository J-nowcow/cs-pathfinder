// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrassShare } from '@/components/GrassShare'
import type { Cell } from '@/lib/streak/grass'

/**
 * 잔디 그림 공유.
 *
 * 두 길이 있고 **가는 길을 잘못 고르면 아무 일도 안 일어난 것처럼 보인다.**
 * 폰은 공유 시트로 파일을 넘기고, 파일을 못 받는 곳은 내려받는다.
 * `navigator.share`만 보고 갈라지면 파일을 못 받는 브라우저에서 조용히
 * 실패하므로 `canShare`에 파일을 넣어 물어본 뒤 갈라져야 한다.
 *
 * 그리고 무슨 일이 있어도 던지면 안 된다 — 여기서 터지면 내 기록 화면이
 * 통째로 사라진다.
 */
const WEEKS: Array<Array<Cell | null>> = [
  [{ day: '2026-08-09', count: 2, level: 2 }, null, null, null, null, null, null],
]
const STATS = { total: 5, distinct: 4, streak: 2 }

const PNG = () => new Blob(['fake'], { type: 'image/png' })

type CanvasProto = {
  getContext: HTMLCanvasElement['getContext']
  toBlob: HTMLCanvasElement['toBlob']
}
const original: CanvasProto = {
  getContext: HTMLCanvasElement.prototype.getContext,
  toBlob: HTMLCanvasElement.prototype.toBlob,
}

/** 붓 시늉. 그림의 내용은 grass-image 시험이 재고 여기서는 경로만 본다 */
function stubCanvas(opts: { ctx?: boolean; blob?: Blob | null } = {}) {
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: 'top',
    fillRect: vi.fn(),
    fillText: vi.fn(),
    scale: vi.fn(),
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(() =>
    opts.ctx === false ? null : ctx,
  ) as unknown as HTMLCanvasElement['getContext']
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) {
    cb(opts.blob === undefined ? PNG() : opts.blob)
  } as HTMLCanvasElement['toBlob']
  return ctx
}

function stubShare(opts: { canShare?: boolean; share?: () => Promise<void> }) {
  if (opts.canShare !== undefined) {
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn(() => opts.canShare),
      configurable: true,
      writable: true,
    })
  }
  const share = vi.fn<(data?: ShareData) => Promise<void>>(opts.share ?? (async () => undefined))
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
  return share
}

let clicks: Array<{ download: string; href: string }>

beforeEach(() => {
  clicks = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({ download: this.download, href: this.href })
  })
  URL.createObjectURL = vi.fn(() => 'blob:grass')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  HTMLCanvasElement.prototype.getContext = original.getContext
  HTMLCanvasElement.prototype.toBlob = original.toBlob
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
})

describe('GrassShare', () => {
  it('손가락으로 누를 수 있는 크기다', () => {
    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    /* 44px. 폰에서 이보다 작으면 옆 것이 눌린다 */
    expect(screen.getByRole('button').className).toContain('min-h-11')
  })

  it('그림을 만드는 동안 로더와 진행 상태를 보여준다', async () => {
    stubCanvas()
    HTMLCanvasElement.prototype.toBlob = function () {
      /* 완료 콜백을 부르지 않아 생성 중 상태를 유지한다 */
    } as HTMLCanvasElement['toBlob']

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))
    const pending = screen.getByRole('button', { name: /만드는 중/ })
    expect(pending.getAttribute('aria-busy')).toBe('true')
    expect(pending.querySelector('.animate-spin')).toBeTruthy()
  })

  /** 폰. 카톡이 목적지라 파일을 바로 넘기는 것이 제일 짧다 */
  it('파일을 받는 공유 시트가 있으면 거기로 넘긴다', async () => {
    stubCanvas()
    const share = stubShare({ canShare: true })

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    const sent = share.mock.calls[0][0] as ShareData
    expect(sent.files?.[0]).toBeInstanceOf(File)
    expect(sent.files?.[0].name).toBe('cs-길라잡이-학습기록.png')
    expect(sent.files?.[0].type).toBe('image/png')

    /* 넘겼으면 내려받지 않는다 — 같은 그림이 두 번 나오면 안 된다 */
    expect(clicks.length).toBe(0)
  })

  it('파일을 못 받는 곳에서는 내려받는다', async () => {
    stubCanvas()
    /* share는 있는데 파일은 못 받는 브라우저다. 이 경우가 실제로 있다 */
    const share = stubShare({ canShare: false })

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(clicks.length).toBe(1))
    expect(clicks[0].download).toBe('cs-길라잡이-학습기록.png')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(share).not.toHaveBeenCalled()
  })

  it('공유 시트가 아예 없는 곳에서도 내려받는다', async () => {
    stubCanvas()

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(clicks.length).toBe(1))
    expect(screen.queryByRole('status')).toBeNull()
  })

  /** 시트를 닫은 것이다. 닫았는데 파일이 떨어지면 취소가 취소가 아니다 */
  it('공유를 취소하면 조용히 돌아간다', async () => {
    stubCanvas()
    stubShare({
      canShare: true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('이미지로 공유'))
    expect(clicks.length).toBe(0)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('붓을 못 얻으면 말한다 — 조용히 아무 일도 없으면 고장으로 안 보인다', async () => {
    stubCanvas({ ctx: false })

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
    expect(screen.getByRole('status').textContent).toContain('만들지 못했습니다')
    expect(clicks.length).toBe(0)
  })

  it('그림이 빈손으로 나와도 말한다', async () => {
    stubCanvas({ blob: null })

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
  })

  it('굽다가 터져도 화면을 데려가지 않는다', async () => {
    stubCanvas()
    HTMLCanvasElement.prototype.toBlob = function () {
      throw new Error('canvas is tainted')
    } as HTMLCanvasElement['toBlob']

    render(<GrassShare weeks={WEEKS} stats={STATS} />)
    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
    /* 버튼은 살아 있어야 한다. 다시 눌러볼 수 있어야 하니까 */
    expect(screen.getByRole('button').textContent).toBe('이미지로 공유')
  })
})
