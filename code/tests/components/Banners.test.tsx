// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { Banner, GeneratingBody, ExpandingNote } from '@/components/Banners'

/**
 * 기다리는 동안의 말.
 *
 * "몇 초만요"는 약속이다. 무료 한도에 걸려 폴백 사슬을 타면 20초가 걸리는데
 * 그때까지 같은 문구가 떠 있으면 거짓말이 된다. 한 번 어긋나면 다음부터
 * 안 기다린다.
 */
beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 초를 흘려보낸다. React 상태 갱신이라 act로 감싼다 */
function advance(seconds: number) {
  act(() => {
    vi.advanceTimersByTime(seconds * 1000)
  })
}

describe('GeneratingBody', () => {
  it('starts with the short promise', () => {
    render(<GeneratingBody />)
    expect(screen.getByText(/몇 초만 기다려/)).toBeTruthy()
  })

  it('softens once it takes longer than promised', () => {
    render(<GeneratingBody />)
    advance(9)
    expect(screen.queryByText(/몇 초만 기다려/)).toBeNull()
    expect(screen.getByText(/조금 더 걸리고 있습니다/)).toBeTruthy()
  })

  /** 마지막 문구는 원인을 그대로 말한다. 왜 느린지 알면 기다리기 쉽다 */
  it('names the reason when it drags on', () => {
    render(<GeneratingBody />)
    advance(20)
    expect(screen.getByText(/평소보다 더딘/)).toBeTruthy()
  })

  it('does not skip ahead too early', () => {
    render(<GeneratingBody />)
    advance(5)
    expect(screen.getByText(/몇 초만 기다려/)).toBeTruthy()
  })

  /** 스크린 리더가 문구 변화를 읽어야 한다 */
  it('announces politely', () => {
    const { container } = render(<GeneratingBody />)
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  /** 스켈레톤은 장식이라 보조 기술이 읽을 필요가 없다 */
  it('hides the skeleton from assistive tech', () => {
    const { container } = render(<GeneratingBody />)
    expect(container.querySelector('[aria-hidden]')).toBeTruthy()
  })
})

describe('Banner', () => {
  it('shows nothing when there is nothing to say', () => {
    const { container } = render(<Banner state={{ kind: 'none' }} onRetry={() => {}} />)
    expect(container.textContent).toBe('')
  })

  /** 거절 사유는 모델이 쓴 문장이 그대로 나간다 */
  it('passes the rejection reason through', () => {
    render(
      <Banner state={{ kind: 'rejected', reason: 'CS 학습 질문으로 보기 어려워요.' }} onRetry={() => {}} />,
    )
    expect(screen.getByText(/CS 학습 질문으로 보기 어려워요/)).toBeTruthy()
  })

  /** 숫자를 지어내지 않는다. 서버가 준 초만 말한다 */
  it('shows the retry delay the server gave', () => {
    render(<Banner state={{ kind: 'rate_limited', retryAfter: 7 }} onRetry={() => {}} />)
    expect(screen.getByText(/7/)).toBeTruthy()
  })
})

/**
 * 파고드는 동안 누르는 자리 옆에 붙는 한 줄.
 *
 * 재보니 꼬리질문을 누르고 새 화면이 뜰 때까지 **35초**가 걸렸다. 그동안
 * 바뀌는 것은 화살표 `→`가 `···`이 되는 것뿐이었고, `role="status"`도
 * `aria-busy`도 없어 화면 낭독기에는 아무것도 안 알려줬다. 35초면 사람은
 * 고장 났다고 판단한다.
 *
 * 기다림 문구 자체는 `GeneratingBody`에 이미 있었는데 **빠른 쪽(이미 판
 * 노드로 이동)에만 붙어 있었다.** 정작 오래 걸리는 생성에는 없었다.
 */
describe('ExpandingNote', () => {
  it('화면 낭독기에 알린다', () => {
    render(<ExpandingNote />)
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('처음에는 몇 초만 기다리라고 한다', () => {
    render(<ExpandingNote />)
    expect(screen.getByRole('status').textContent).toContain('몇 초만 기다려')
  })

  /*
   * "몇 초만요"는 약속이다. 무료 한도에 걸려 폴백 사슬을 타면 35초가 걸리는데
   * 그때까지 같은 문구면 거짓말이 된다.
   */
  it('오래 걸리면 말을 바꾼다', () => {
    render(<ExpandingNote />)
    advance(20)
    const t = screen.getByRole('status').textContent ?? ''
    expect(t).not.toContain('몇 초만 기다려')
    expect(t).toContain('더딘')
  })

  /* 본문을 지우지 않는다. 읽던 글까지 없어지면 기다리는 동안 읽을 것이 없다 */
  it('스켈레톤을 그리지 않는다', () => {
    const { container } = render(<ExpandingNote />)
    expect(container.querySelectorAll('.animate-pulse').length).toBe(1)
  })
})
