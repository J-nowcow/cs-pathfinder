import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
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

  it('retains the reviewed archive outside public serving assets', () => {
    for (const url of Object.values(release.links)) {
      expect(url.startsWith('/pmp/')).toBe(true)
      expect(readFileSync(resolve('pm-content/pmp/downloads', decodeURIComponent(url.split('#')[0].split('/').pop()!))).length).toBeGreaterThan(0)
    }
    expect(existsSync(resolve('public/pmp'))).toBe(false)
    const reader = readFileSync(resolve('pm-content/pmp/downloads', decodeURIComponent(release.links.reader.split('#')[0].split('/').pop()!)), 'utf8')
    expect(release.links.reader).toBe(`${release.links.study}#reader-top`)
    expect(reader).toContain('id="pmp-reader"')
    expect(reader).toContain('id="pmp-interactive" hidden')
    expect(reader).not.toMatch(/<iframe(?:\s|>)/i)
    expect(reader.match(/class="reader-lesson" id="reader-n\d+"/g)).toHaveLength(release.stats.lessons)
    expect(reader).toContain('data:font/woff2;base64,')
  })
})
