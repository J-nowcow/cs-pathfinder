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
import { PmpFloatLab } from '@/components/pmp/PmpFloatLab'
import course from '../../pm-content/pmp/source/course.json'
const props = {
  config: course.floatLab,
  source: course.sources.find((s) => s.id === 'cpm')!,
}
afterEach(cleanup)
it('resets every preset to the authored baseline and shows multiple critical paths', () => {
  localStorage.setItem('pmp-pathfinder-v1', 'synthetic-keep')
  render(<PmpFloatLab {...props} />)
  fireEvent.change(screen.getByLabelText('B 기간 (일)'), {
    target: { value: '90' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'C +2일 · 두 임계 경로' }))
  expect((screen.getByLabelText('B 기간 (일)') as HTMLInputElement).value).toBe(
    '6',
  )
  expect(screen.getByRole('status').textContent).toContain('프로젝트 종료 12일')
  expect(screen.getByRole('status').textContent).toContain('임계 경로 2개')
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
    'A→C→E→D',
  )
  fireEvent.click(screen.getByRole('button', { name: 'C +3일 · 경로 전환' }))
  expect(screen.getByRole('status').textContent).toContain('프로젝트 종료 13일')
  expect(screen.getByRole('status').textContent).toContain(
    '임계 경로 1개: A → C → E → D',
  )
  expect(localStorage.getItem('pmp-pathfinder-v1')).toBe('synthetic-keep')
})
it('removes stale results on invalid input and restores them from a preset', () => {
  render(<PmpFloatLab {...props} />)
  fireEvent.change(screen.getByLabelText('C 기간 (일)'), {
    target: { value: '' },
  })
  expect(screen.getByRole('status').textContent).toContain(
    '빈칸·소수는 계산하지 않습니다',
  )
  expect(screen.queryByRole('table')).toBeNull()
  expect(
    screen.getByLabelText('C 기간 (일)').getAttribute('aria-invalid'),
  ).toBe('true')
  fireEvent.click(
    screen.getByRole('button', { name: /^기본 예제$/ }),
  )
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6)
  expect(screen.getByRole('status').textContent).toContain('프로젝트 종료 12일')
})
it('server-renders a complete worked default with disabled controls for no-JS readers', () => {
  const html = renderToString(<PmpFloatLab {...props} />)
  expect(html).toContain('프로젝트 종료 ')
  expect(html).toContain('12')
  expect(html).toContain('data-float-row="C"')
  expect(html).toContain('disabled=""')
  expect(html).toContain('<noscript>')
  expect(html).toContain('작업 C의 총여유·자유여유')
})
