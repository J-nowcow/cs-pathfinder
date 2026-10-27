import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import index from '../../data/engineer-index.json'
import guides from '../../data/engineer-guides.json'
import missions from '../../learning-content/jira/missions.json'
describe('기출 원문 경계와 학습 연결', () => {
  it('실제1860개 위치·60회차를 보존하고140회31개만 원문을 제공한다', () => {
    expect(index.questions).toHaveLength(1860)
    expect(new Set(index.questions.map((q) => q.id)).size).toBe(1860)
    expect(new Set(index.questions.map((q) => q.round)).size).toBe(60)
    expect(index.questions.filter((q) => q.text !== null)).toHaveLength(31)
    expect(
      index.questions
        .filter((q) => q.round < 140)
        .every((q) => q.text === null),
    ).toBe(true)
    expect(
      index.coverage
        .filter((x) => x.round < 63)
        .every((x) => x.question_records === 0),
    ).toBe(true)
  })
  it('주제 연결을 정확한 별칭 규칙으로만 생성하고 연결 대기를 남긴다', () => {
    const ids = new Set(guides.map((x) => x.id))
    expect(guides).toHaveLength(24)
    for (const q of index.questions)
      expect(q.topics.every((t) => ids.has(t))).toBe(true)
    expect(index.questions.filter((q) => q.topics.length)).toHaveLength(538)
    expect(index.questions.filter((q) => !q.topics.length)).toHaveLength(1322)
    for (const g of guides) {
      expect(g.questionCount).toBe(
        index.questions.filter((q) => q.topics.includes(g.id)).length,
      )
      expect(g.reference.length).toBeGreaterThanOrEqual(3)
      expect(g.comparison.length).toBe(3)
      expect(g.related.every((id) => ids.has(id))).toBe(true)
      expect(
        g.sources.every(
          (x) => x.url.startsWith('https://') && x.checked === '2026-10-27',
        ),
      ).toBe(true)
    }
  })
  it('원본Jira 데이터·추적 데이터·폰트 허가 파일을 그대로 보존한다', () => {
    const bytes = readFileSync('public/jira/data.js')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '834bc09b28292689eba8b5e7b1ab1710b602719c5d782f44ac380a1acf9ad6a6',
    )
    expect(readFileSync('public/jira/trace-data.js')).toEqual(
      readFileSync('learning-content/jira/template/trace-data.js'),
    )
    expect(readFileSync('public/jira/offline.html', 'utf8')).toContain(
      'bundled-font-licenses',
    )
    expect(missions).toHaveLength(5)
    for (const m of missions) {
      expect(idsafe(m.topic)).toBe(true)
      expect(m.checks.length).toBeGreaterThan(1)
    }
  })
})
function idsafe(id: string) {
  return guides.some((x) => x.id === id)
}
