// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { ConceptSteps } from '@/components/library/ConceptSteps'

const steps = ['Set the purpose', 'Agree on delivery', 'Check the outcome']
let preference: EventTarget & { matches: boolean }
beforeEach(() => {
  vi.useFakeTimers()
  preference = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal('matchMedia', () => preference)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
it('server renders every authored step without requiring playback or JavaScript', () => {
  const html = renderToString(<ConceptSteps steps={steps} />)
  for (const text of steps) expect(html).toContain(text)
  expect(html).not.toContain('aria-current="step"')
  expect(html).toContain('disabled=""')
})
it('plays once only on request, supports manual steps and cancels work on unmount', () => {
  const view = render(<ConceptSteps steps={steps} />)
  expect(view.container.querySelector('[aria-current]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '순서대로 보기' }))
  expect(
    screen.getByRole('button', { name: steps[0] }).getAttribute('aria-current'),
  ).toBe('step')
  act(() => {
    vi.advanceTimersByTime(1400)
  })
  expect(
    screen.getByRole('button', { name: steps[1] }).getAttribute('aria-current'),
  ).toBe('step')
  fireEvent.click(screen.getByRole('button', { name: '일시정지' }))
  act(() => {
    vi.advanceTimersByTime(10000)
  })
  expect(
    screen.getByRole('button', { name: steps[1] }).getAttribute('aria-current'),
  ).toBe('step')
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }))
  expect(
    screen.getByRole('button', { name: steps[2] }).getAttribute('aria-current'),
  ).toBe('step')
  fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
  expect(view.container.querySelector('[aria-current]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '순서대로 보기' }))
  for (let i = 0; i < steps.length; i++)
    act(() => {
      vi.advanceTimersByTime(1400)
    })
  expect(view.container.querySelector('[data-playing="true"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '순서대로 보기' }))
  view.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
it('reduced motion uses direct selection and changing preference or hiding the page stops playback', () => {
  preference.matches = true
  const view = render(<ConceptSteps steps={steps} />)
  expect(screen.queryByRole('button', { name: '순서대로 보기' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다음 단계' }))
  expect(
    screen.getByRole('button', { name: steps[0] }).getAttribute('aria-current'),
  ).toBe('step')
  act(() => {
    preference.matches = false
    preference.dispatchEvent(new Event('change'))
  })
  fireEvent.click(screen.getByRole('button', { name: '순서대로 보기' }))
  act(() => {
    preference.matches = true
    preference.dispatchEvent(new Event('change'))
  })
  expect(view.container.querySelector('[data-playing="true"]')).toBeNull()
  act(() => {
    preference.matches = false
    preference.dispatchEvent(new Event('change'))
  })
  fireEvent.click(screen.getByRole('button', { name: '순서대로 보기' }))
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  fireEvent(document, new Event('visibilitychange'))
  expect(view.container.querySelector('[data-playing="true"]')).toBeNull()
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: false,
  })
})
