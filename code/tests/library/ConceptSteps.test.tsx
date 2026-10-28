// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { ConceptSteps } from '@/components/library/ConceptSteps'
import { pmpCourse } from '@/lib/pmp/course'

const steps = ['Set the purpose', 'Agree on delivery', 'Check the outcome']
afterEach(cleanup)
it('keeps each authored procedure readable in its original order without playback controls', () => {
  const { container } = render(<ConceptSteps steps={steps} />)
  expect(screen.getByRole('list')).toBeTruthy()
  expect(screen.getAllByRole('listitem').map(li => li.querySelector('div')?.textContent)).toEqual(steps)
  expect(screen.queryAllByRole('button')).toEqual([])
  expect(container.querySelectorAll('[tabindex], [aria-current], [role=status]')).toHaveLength(0)
})
it('server renders every PMP procedure unchanged, including empty lists and literal markup text', () => {
  for (const n of pmpCourse.nodes) {
    const html = renderToString(<ConceptSteps steps={n.steps} />)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect([...doc.querySelectorAll('li > div')].map(el => el.textContent)).toEqual(n.steps)
    expect(doc.querySelector('button')).toBeNull()
  }
  expect(renderToString(<ConceptSteps steps={[]} />)).not.toContain('<li')
  const html = renderToString(<ConceptSteps steps={['<img src=x onerror=alert(1)>']} />)
  expect(html).toContain('&lt;img')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('<button')
})
