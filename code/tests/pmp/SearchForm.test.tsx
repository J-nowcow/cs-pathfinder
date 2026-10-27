// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { PmpSearchForm } from '@/components/pmp/PmpSearchForm'
afterEach(cleanup)
it('provides a plain GET form with accessible query, limits and scope', () => {
  render(<PmpSearchForm query="음수 여유" />)
  const form = screen.getByRole('search')
  expect(form.getAttribute('action')).toBe('/learn/pmp/search')
  expect(form.getAttribute('method')).toBe('get')
  expect(form.getAttribute('autocomplete')).toBe('off')
  expect(
    (screen.getByRole('searchbox', { name: '수업 찾기' }) as HTMLInputElement)
      .value,
  ).toBe('음수 여유')
  expect(screen.getByRole('searchbox').getAttribute('maxlength')).toBe('120')
  expect(
    screen.getByRole('button', { name: '찾기' }).getAttribute('type'),
  ).toBe('submit')
  expect(screen.getByText(/개인 메모는 제외합니다/)).toBeTruthy()
})
it('server-renders an enabled form without scripts and escapes untrusted query text', () => {
  const html = renderToString(
    <PmpSearchForm query={'"><img src=x onerror=alert(1)>'} error="long" />,
  )
  expect(html).not.toContain('<img')
  expect(html).not.toContain('disabled=')
  expect(html).toContain('role="alert"')
  expect(html).toContain('aria-invalid="true"')
})
