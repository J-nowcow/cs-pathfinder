// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PmpConceptFigure } from '@/components/pmp/PmpConceptFigure'
import { EVM_DEFAULTS, calculateEvm } from '@/lib/pmp/evm'

afterEach(cleanup)
it('server renders labelled, independent concept figures without scripts or external images', () => {
  for (const id of ['n01', 'n27', 'n35']) {
    const html = renderToStaticMarkup(<PmpConceptFigure lesson={id} />)
    expect(html).toContain('<figure')
    expect(html).toContain('<title id=')
    expect(html).toContain('<desc id=')
    expect(html).not.toMatch(/<script|<image|<img|https?:/)
    expect(html).not.toContain('animation')
  }
  expect(renderToStaticMarkup(<PmpConceptFigure lesson="n02" />)).toBe('')
})
it('uses the same EVM sample and calculations as the authored lesson and existing lab', () => {
  const view = render(<PmpConceptFigure lesson="n35" />)
  const rows = [...view.container.querySelectorAll('[data-evm-figure]')]
  expect(rows.map((row) => Number(row.getAttribute('data-value')))).toEqual([
    EVM_DEFAULTS.pv,
    EVM_DEFAULTS.ev,
    EVM_DEFAULTS.ac,
  ])
  expect(
    rows.map((row) =>
      Number(row.querySelector('.figure-bar')!.getAttribute('width')),
    ),
  ).toEqual([420, 336, 420])
  expect(calculateEvm(EVM_DEFAULTS)).toMatchObject({
    cpi: 0.8,
    spi: 0.8,
    cv: -10,
    sv: -10,
  })
  const figure = screen.getByRole('img', { name: 'PV·EV·AC의 같은 기준 비교' })
  expect(figure.querySelector('desc')!.textContent).toContain(
    'SPI는 날짜 지연 비율이 아닙니다',
  )
})
