/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, within } from '@testing-library/react'
import { LearningAreas } from '@/components/LearningAreas'

afterEach(cleanup)

describe('learning areas', () => {
  it('groups real study destinations by purpose without duplicating records', () => {
    const { getByRole } = render(<LearningAreas />)
    const pm = within(getByRole('region', { name: 'PM 이론' }))
    const cs = within(getByRole('region', { name: 'CS 이론' }))
    const cert = within(getByRole('region', { name: '자격증 대비' }))
    expect(
      pm.getByRole('link', { name: /Jira 실무/ }).getAttribute('href'),
    ).toBe('/learn/jira')
    expect(
      cs.getByRole('link', { name: /CS 질문·해설/ }).getAttribute('href'),
    ).toBe('/questions')
    expect(cs.getByRole('link', { name: /동시성/ }).getAttribute('href')).toBe(
      '/learn/engineer/concurrency',
    )
    expect(
      cert.getByRole('link', { name: /정보처리기사/ }).getAttribute('href'),
    ).toBe('/learn/certificate')
    expect(
      cert.getByRole('link', { name: /정보관리기술사/ }).getAttribute('href'),
    ).toBe('/learn/engineer#questions')
  })
  it('opens native PMP without offering retired offline editions', () => {
    const { getByRole, container } = render(<LearningAreas />)
    expect(
      getByRole('link', {
        name: '프로젝트·제품 관리 → PMP 개념·사례·계산 실습',
      }).getAttribute('href'),
    ).toBe('/learn/pmp')
    expect(container.querySelector('a[download]')).toBeNull()
    expect(container.querySelector('a[href^="/pmp/"]')).toBeNull()
  })
})
