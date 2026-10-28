// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { StudyNavigation, studyNavigationGroups } from '@/components/library/StudyNavigation'
vi.mock('next/navigation', () => ({ usePathname: () => '/learn/pmp' }))
vi.mock('next/link', () => ({ default: ({ href, prefetch, children, ...props }: { href: string; prefetch?: boolean; children: React.ReactNode }) => <a href={href} data-prefetch={String(prefetch)} {...props}>{children}</a> }))
vi.mock('@/components/library/DeskAppearance', () => ({ DeskAppearance: () => <button>Appearance</button> }))
afterEach(cleanup)

it('exposes every existing subject entry and personal destination with prefetch disabled', () => {
  const { container } = render(<StudyNavigation section="pmp" />)
  expect(container.querySelectorAll('summary')).toHaveLength(3)
  const expected = [...studyNavigationGroups.flatMap(g => g.links.map(l => l.href)), '/learn', '/learn/library', '/learn/progress']
  const anchors = [...container.querySelectorAll('a')]
  expect(new Set(anchors.map(a => a.getAttribute('href')))).toEqual(new Set(expected))
  expect(anchors.every(a => a.dataset.prefetch === 'false')).toBe(true)
  const current = anchors.filter(a => a.getAttribute('aria-current') === 'page')
  expect(current.map(a => a.getAttribute('href'))).toEqual(['/learn/pmp'])
})

it('closes with Escape and returns summary focus, and closes on outside pointer action', () => {
  const { container } = render(<StudyNavigation section="pmp" />)
  const menu = container.querySelector('details')!
  menu.open = true
  const link = menu.querySelector('a')!
  link.focus()
  fireEvent.keyDown(link, { key: 'Escape' })
  expect(menu.open).toBe(false)
  expect(document.activeElement).toBe(menu.querySelector('summary'))
  menu.open = true
  fireEvent.pointerDown(document.body)
  expect(menu.open).toBe(false)
  expect(screen.getByRole('navigation')).toBeTruthy()
})
