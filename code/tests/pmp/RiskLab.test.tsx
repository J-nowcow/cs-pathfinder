// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { PmpRiskLab } from '@/components/pmp/PmpRiskLab'
afterEach(cleanup)
it('compares equal expectations with different tails and resets all four values', () => {
  localStorage.setItem('pmp-pathfinder-v1', 'synthetic-keep')
  render(<PmpRiskLab />)
  expect(screen.getByRole('status').textContent).toContain('20%')
  fireEvent.change(screen.getByLabelText('A 확정 비용'), {
    target: { value: '90' },
  })
  fireEvent.change(screen.getByLabelText('비교할 금액 한도'), {
    target: { value: '1' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: '같은 기대손실 · 40%·50' }),
  )
  expect((screen.getByLabelText('A 확정 비용') as HTMLInputElement).value).toBe(
    '30',
  )
  expect(
    (screen.getByLabelText('비교할 금액 한도') as HTMLInputElement).value,
  ).toBe('50')
  expect(screen.getByRole('status').textContent).toContain('0%')
  expect(
    document.querySelectorAll('.pmp-risk-results .pmp-risk-value')[1]
      .textContent,
  ).toBe('20')
  fireEvent.click(
    screen.getByRole('button', { name: '같은 기대손실 · 10%·200' }),
  )
  expect(screen.getByRole('status').textContent).toContain('10%')
  expect(
    document.querySelectorAll('.pmp-risk-results .pmp-risk-value')[1]
      .textContent,
  ).toBe('20')
  expect(localStorage.getItem('pmp-pathfinder-v1')).toBe('synthetic-keep')
})
it('explains impossible-in-model, certain and both-over-limit cases without recommending', () => {
  render(<PmpRiskLab />)
  fireEvent.click(screen.getByRole('button', { name: '발생 확률 0%' }))
  expect(screen.getByRole('status').textContent).toContain('0%')
  expect(
    screen.getByText(/현실에서 사건이 불가능하다는 증명은 아닙니다/),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '발생 확률 100%' }))
  expect(screen.getByRole('status').textContent).toContain('100%')
  fireEvent.click(screen.getByRole('button', { name: 'A도 한도를 넘으면' }))
  expect(screen.getByText(/A의 확정 비용도 한도를 넘습니다/)).toBeTruthy()
  expect(document.querySelector('.pmp-risk-limit')!.textContent).toContain(
    '같은 금액은 포함하지 않습니다',
  )
})
it('removes current outputs on invalid input while retaining the clearly fixed comparison examples', () => {
  render(<PmpRiskLab />)
  fireEvent.change(screen.getByLabelText('B 사건 발생 확률 (%)'), {
    target: { value: '100.01' },
  })
  expect(screen.getByRole('status').textContent).toContain(
    '입력값을 확인하세요',
  )
  expect(document.querySelector('.pmp-risk-outcomes')).toBeNull()
  expect(
    screen.getByLabelText('B 사건 발생 확률 (%)').getAttribute('aria-invalid'),
  ).toBe('true')
  expect(screen.getByRole('table')).toBeTruthy()
  expect(screen.getByText(/입력값에 따라 바뀌는 표가 아닙니다/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '기본 예제' }))
  expect(document.querySelector('.pmp-risk-outcomes')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('20%')
})
it('server-renders a full no-JS worked default and fixed contrast table with disabled controls', () => {
  const html = renderToString(<PmpRiskLab />)
  expect(html).toContain('pmp-risk-value">20</p>')
  expect(html).toContain('같은 기대손실의 다른 결과 비교')
  expect(html).toContain('disabled=""')
  expect(html).toContain('<noscript>')
  expect(html).toContain('대안을 자동으로 추천하지 않으며')
})
