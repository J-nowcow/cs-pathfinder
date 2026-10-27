/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LearningAreas } from '@/components/LearningAreas'
import release from '../../data/pmp-release.json'

describe('learning areas', () => {
  it('opens PMP within the library and preserves the old offline resources and record boundary', () => {
    const { getByRole, getByText } = render(<LearningAreas />)
    expect(
      getByRole('link', { name: 'PMP 통합 자습서 열기 →' }).getAttribute(
        'href',
      ),
    ).toBe('/learn/pmp')
    expect(
      getByRole('link', { name: '이전 전체 읽기 HTML →' }).getAttribute('href'),
    ).toBe(release.links.reader)
    expect(
      getByRole('link', { name: '오프라인 ZIP 받기 ↓' }).hasAttribute(
        'download',
      ),
    ).toBe(true)
    expect(getByText(/CS 계정 기록과 별도로/)).toBeTruthy()
  })
})
