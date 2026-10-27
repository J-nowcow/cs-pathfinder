import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import release from '../../data/pmp-release.json'

const course = JSON.parse(readFileSync(new URL('../../pm-content/pmp/source/course.json', import.meta.url), 'utf8'))

describe('PMP reviewed content package', () => {
  it('serves the reviewed lesson identities, original quizzes and complete reading order', () => {
    const ids = new Set(course.nodes.map((node: { id: string }) => node.id))
    expect(ids.size).toBe(release.stats.lessons)
    expect(new Set(course.readingOrder)).toEqual(ids)
    expect(course.version).toBe(release.version)
    expect(course.stats).toEqual(release.stats)
    for (const node of course.nodes) {
      expect(node.options).toHaveLength(4)
      expect(node.options.filter((option: { correct: boolean }) => option.correct)).toHaveLength(1)
      expect(node.links.every((id: string) => ids.has(id))).toBe(true)
    }
    expect(course.nodes.length + course.cases.reduce((n: number, item: { questions: unknown[] }) => n + item.questions.length, 0)).toBe(release.stats.questions)
  })

  it('links the app to real same-origin learning and offline files', () => {
    for (const url of Object.values(release.links)) {
      expect(url.startsWith('/pmp/')).toBe(true)
      expect(readFileSync(resolve('public', decodeURIComponent(url.slice(1)))).length).toBeGreaterThan(0)
    }
    const live = JSON.parse(readFileSync(resolve('public/pmp/release.json'), 'utf8'))
    expect(live).toEqual(release)
    const reader = readFileSync(resolve('public', decodeURIComponent(release.links.reader.slice(1))), 'utf8')
    expect(reader).not.toMatch(/<script(?:\s|>)/i)
    expect(reader.match(/class="reader-lesson" id="n\d+"/g)).toHaveLength(release.stats.lessons)
    expect(reader).toContain('data:font/woff2;base64,')
  })
})
