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
  it('자동 별칭 후보와 원문 대조한 핵심·보충 연결을 구분한다', () => {
    const ids = new Set(guides.map((x) => x.id))
    expect(guides).toHaveLength(24)
    for (const q of index.questions)
      expect(q.topics.every((t) => ids.has(t))).toBe(true)
    expect(index.questions.filter((q) => q.autoTopics.length)).toHaveLength(538)
    expect(index.questions.filter((q) => q.classification)).toHaveLength(31)
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '')
    for (const q of index.questions) {
      expect(q.autoTopics).toEqual(
        guides
          .filter((g) =>
            g.aliases.some((a) =>
              q.rawTopics.map(normalize).includes(normalize(a)),
            ),
          )
          .map((g) => g.id),
      )
      if (!q.classification) {
        expect(q.topics).toEqual(q.autoTopics)
        expect(q.types).toEqual(q.autoTypes)
      } else {
        expect(q.round).toBe(140)
        expect(createHash('sha256').update(q.text!).digest('hex')).toBe(
          q.classification.sourceTextSha256,
        )
        expect(q.classification.core.length).toBeGreaterThan(0)
        expect(
          q.topics.some((t) => q.backgroundTopics.some((id) => id === t)),
        ).toBe(false)
      }
    }
    for (const g of guides) {
      expect(g.questionCount).toBe(
        index.questions.filter((q) => q.topics.includes(g.id)).length,
      )
      expect(g.reviewedCount + g.candidateCount).toBe(g.questionCount)
      expect(g.backgroundCount).toBe(
        index.questions.filter((q) =>
          q.backgroundTopics.some((id) => id === g.id),
        ).length,
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
  it('같은 단어의 다른 의미와 배경 AI를 핵심 기출 연결로 세지 않는다', () => {
    const q = (id: string) =>
      index.questions.find((x) => x.id === 'impe-140-' + id)!
    expect(q('1-06').autoTopics).toContain('cloud')
    expect(q('1-06').topics).not.toContain('cloud')
    expect(q('1-06').backgroundTopics).toContain('rag')
    expect(q('1-07').autoTopics).toContain('cap')
    expect(q('1-07').topics).not.toContain('cap')
    expect(q('1-01').types).toEqual(['효과'])
    expect(q('3-05').topics).not.toContain('ml-evaluation')
    expect(q('3-05').types).toEqual(['비교', '적용'])
    expect(q('3-01').topics).toEqual(['continuity'])
    expect(q('3-01').backgroundTopics).toEqual(['cloud'])
    expect(q('3-01').types).not.toContain('설계')
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
