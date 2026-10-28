import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExamBrowser, type ExamQuestion } from '@/components/library/ExamBrowser'
import { examBrowserQuestions } from '@/lib/library/exam-browser-data'
import index from '../../data/engineer-index.json'
import guides from '../../data/engineer-guides.json'

const fields = ['id', 'round', 'session', 'number', 'text', 'rawTopics', 'types', 'sourceUrl', 'quality', 'topics', 'backgroundTopics', 'classification'] as const
const reviewFields = ['core', 'background', 'implicitDemand', 'rationale', 'reviewedAt'] as const
const topicTitles = Object.fromEntries(guides.map((guide) => [guide.id, guide.title]))
const sets = [
  { name: 'catalogue', questions: index.questions },
  ...guides.map((guide) => ({
    name: guide.id,
    questions: index.questions.filter((q) => q.topics.includes(guide.id) || q.backgroundTopics.some((id) => id === guide.id)),
  })),
]

function expectedQuestion(q: ExamQuestion) {
  const expected: Record<string, unknown> = Object.fromEntries(fields.map((field) => [field, q[field]]))
  expected.classification = q.classification === null ? null : Object.fromEntries(reviewFields.map((field) => [field, q.classification![field]]))
  return expected
}

function freezeTree(value: unknown) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return
  Object.freeze(value)
  for (const child of Object.values(value)) freezeTree(child)
}

describe('server projection of engineer questions', () => {
  it.each(sets)('preserves the independent consumed contract and order for $name', ({ questions }) => {
    const before = JSON.stringify(questions)
    const projected = examBrowserQuestions(questions)
    expect(projected).toEqual(questions.map(expectedQuestion))
    expect(projected.map((q) => q.id)).toEqual(questions.map((q) => q.id))
    expect(JSON.stringify(questions)).toBe(before)
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const result = projected[i]
      expect(result).not.toBe(q)
      expect(Object.keys(result)).toEqual([...fields])
      for (const field of fields.filter((field) => field !== 'classification')) expect(result[field]).toBe(q[field])
      if (q.classification === null) {
        expect(result.classification).toBeNull()
      } else {
        expect(result.classification).not.toBe(q.classification)
        expect(Object.keys(result.classification!)).toEqual([...reviewFields])
        for (const field of reviewFields) expect(result.classification![field]).toBe(q.classification[field])
      }
    }
  })

  it('keeps frozen canonical data and provenance metadata intact', () => {
    const source = structuredClone(index.questions)
    const before = JSON.stringify(source)
    freezeTree(source)
    expect(() => examBrowserQuestions(source)).not.toThrow()
    expect(JSON.stringify(source)).toBe(before)
    expect(source).toHaveLength(1860)
    expect(source.filter((q) => q.classification !== null)).toHaveLength(31)
    expect(source.filter((q) => q.classification === null)).toHaveLength(1829)
    expect(source[0]).toHaveProperty('autoTopics')
    expect(source[0]).toHaveProperty('autoTypes')
    expect(source.find((q) => q.classification)?.classification).toHaveProperty('sourceTextSha256')
  })

  it('retains empty subsets and background-only membership without normalization', () => {
    const empty = sets.find((set) => set.name === 'observability')!
    expect(empty.questions).toEqual([])
    expect(examBrowserQuestions(empty.questions)).toEqual([])
    const backgroundOnly = guides.flatMap((guide) => index.questions.filter((q: ExamQuestion) => !q.topics.includes(guide.id) && q.backgroundTopics.includes(guide.id)))
    expect(backgroundOnly.length).toBeGreaterThan(0)
    expect(examBrowserQuestions(backgroundOnly)).toEqual(backgroundOnly.map(expectedQuestion))
    expect(examBrowserQuestions(index.questions).map((q) => q.text === null)).toEqual(index.questions.map((q) => q.text === null))
  })

  it.each(sets)('retains actual initial server markup/text for $name', ({ questions }) => {
    const before = renderToStaticMarkup(createElement(ExamBrowser, { questions, topicTitles }))
    const after = renderToStaticMarkup(createElement(ExamBrowser, { questions: examBrowserQuestions(questions), topicTitles }))
    expect(after).toBe(before)
  })
})
