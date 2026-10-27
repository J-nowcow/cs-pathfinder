// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { PmpEvmLab } from '@/components/pmp/PmpEvmLab'
afterEach(cleanup)
it('changes only the explicitly supplied forecast and resets presets without storage writes', () => {
  localStorage.setItem('pmp-pathfinder-v1', 'synthetic-keep')
  render(<PmpEvmLab />)
  expect(screen.getByRole('status').textContent).toContain('125')
  fireEvent.change(screen.getByLabelText('새로 추정한 잔여 원가 ETC (선택)'), {
    target: { value: '90' },
  })
  const forecasts = document.querySelector('.pmp-evm-forecasts')!
  expect(forecasts.textContent).toContain('EAC 140')
  expect(forecasts.textContent).toContain('EAC 110')
  expect(screen.getByRole('status').textContent).toContain('125')
  fireEvent.click(screen.getByRole('button', { name: '지출만 70으로' }))
  expect(
    (
      screen.getByLabelText(
        '새로 추정한 잔여 원가 ETC (선택)',
      ) as HTMLInputElement
    ).value,
  ).toBe('70')
  expect(screen.getByRole('status').textContent).toContain('175')
  expect(localStorage.getItem('pmp-pathfinder-v1')).toBe('synthetic-keep')
})
it('explains zero denominators, no earned work, depleted budget and completion separately', () => {
  render(<PmpEvmLab />)
  fireEvent.click(screen.getByRole('button', { name: '아직 지출이 없다면' }))
  expect(screen.getByText('AC가 0이라 나눌 수 없습니다.')).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('계산 불가')
  fireEvent.click(screen.getByRole('button', { name: '계획 가치가 0이면' }))
  expect(screen.getByText('PV가 0이라 나눌 수 없습니다.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '전체 예산을 썼다면' }))
  expect(document.querySelector('.pmp-evm-target')!.textContent).toContain(
    'BAC−AC가 0 이하',
  )
  fireEvent.click(
    screen.getByRole('button', { name: '가치 기준으로 모두 완료' }),
  )
  expect(document.querySelector('.pmp-evm-target')!.textContent).toContain(
    '성과 요구로 해석하지 않습니다',
  )
  fireEvent.click(screen.getByRole('button', { name: '기본 예제' }))
  fireEvent.change(screen.getByLabelText('EV · 획득 가치'), {
    target: { value: '0' },
  })
  expect(screen.getByRole('status').textContent).toContain('계산 불가')
  expect(
    within(document.querySelector('.pmp-evm-metrics') as HTMLElement).getAllByText(
      '0',
      { exact: true },
    ),
  ).toHaveLength(2)
})
it('hides stale results for invalid input and permits a missing optional ETC', () => {
  render(<PmpEvmLab />)
  fireEvent.change(screen.getByLabelText('BAC · 전체 예산'), {
    target: { value: '' },
  })
  expect(screen.getByRole('status').textContent).toContain('빈 필수값')
  expect(document.querySelector('.pmp-evm-forecasts')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '기본 예제' }))
  fireEvent.change(screen.getByLabelText('새로 추정한 잔여 원가 ETC (선택)'), {
    target: { value: '' },
  })
  expect(screen.getByRole('status').textContent).toContain('125')
  expect(screen.getByText(/선택 입력란에 새로 추정한/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('EV · 획득 가치'), {
    target: { value: '101' },
  })
  expect(
    screen.getByLabelText('EV · 획득 가치').getAttribute('aria-invalid'),
  ).toBe('true')
  expect(document.querySelector('.pmp-evm-forecasts')).toBeNull()
})
it('server-renders the worked default, assumptions and disabled no-JS controls', () => {
  const html = renderToString(<PmpEvmLab />)
  expect(html).toContain('EAC <!-- -->125')
  expect(html).toContain('EAC <!-- -->110')
  expect(html).toContain('EAC <!-- -->120')
  expect(html).toContain('disabled=""')
  expect(html).toContain('<noscript>')
  expect(html).toContain('지연 일수가 아닙니다')
})
