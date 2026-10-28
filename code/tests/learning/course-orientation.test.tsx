import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { certificate as c } from '@/lib/certificate/course'
import {
  certificateSyllabus as s,
  certificateLocation,
} from '@/lib/certificate/syllabus'
import { CertificateSyllabus } from '@/components/certificate/CertificateSyllabus'
import { PmpCourseMap, pmpMapGroups } from '@/components/pmp/PmpCourseMap'
import { pmpCourse, nativePmpHtml } from '@/lib/pmp/course'
import legacy from '../certificate/fixtures/legacy-identities.json'
import headings from '../../learning-content/pmp-heading-editorial.json'
import search from '../../data/learning-search.json'
import pmpCatalog from '../../data/pmp-library.json'
import jiraTitles from '../../learning-content/jira/title-editorial.json'
import jiraCatalog from '../../data/jira-library.json'
import jiraCopy from '../../learning-content/jira/copy-editorial.json'

describe('official syllabus and public course orientation', () => {
  it('uses the 2027–2029 four-subject source and distinguishes partial content from unwritten units', () => {
    expect(s.source.validFrom).toBe('2027-01-01')
    expect(s.source.validThrough).toBe('2029-12-31')
    expect(s.source.url).toContain('mcrtrNo=1453')
    expect(s.written.subjects.map((x) => x.title)).toEqual([
      '소프트웨어 개발',
      '데이터베이스 구축',
      '프로그래밍 언어 활용',
      '정보시스템 구축관리',
    ])
    expect(s.written.subjects.reduce((sum, x) => sum + x.questions, 0)).toBe(80)
    const units = s.written.subjects.flatMap((x) => x.units)
    expect(units).toHaveLength(20)
    expect(s.practical.units).toHaveLength(12)
    const ids = units.flatMap((x) => x.lessons)
    expect(ids).toHaveLength(16)
    expect(new Set(ids)).toEqual(new Set(c.lessons.map((n) => n.id)))
    expect(
      c.lessons.map(({ id, domain, checklist, originConceptIds }) => ({
        id,
        domain,
        checklist,
        originConceptIds,
      })),
    ).toEqual(legacy)
    for (const n of c.lessons)
      expect(certificateLocation(n.id)?.unit.lessons).toContain(n.id)
    expect(certificateLocation('not-a-lesson')).toBeUndefined()
    const html = renderToStaticMarkup(<CertificateSyllabus />)
    expect(html).toContain(
      '링크가 있는 단원도 해당 출제 범위 전체를 다룬 것은 아닙니다',
    )
    expect(html.match(/목차 정리 · 본문 미작성/g)?.length).toBe(
      units.filter((x) => !x.lessons.length).length +
        s.practical.units.filter((x) => !x.lessons.length).length,
    )
    for (const id of ids) expect(html).toContain('/learn/certificate/' + id)
  })

  it('links every real PMP chapter once from a server-rendered concept map', () => {
    const ids = pmpMapGroups.flatMap((x) => x.chapters)
    expect(ids).toHaveLength(14)
    expect(new Set(ids)).toEqual(new Set(pmpCourse.tracks.map((x) => x.id)))
    const html = renderToStaticMarkup(<PmpCourseMap />)
    for (const id of ids)
      expect(html.match(new RegExp('href="#' + id + '"', 'g'))).toHaveLength(1)
    expect(html).toContain('role="img"')
    expect(html).toContain('공식 프로세스 순서를 나타내지 않습니다')
    expect(html).not.toMatch(/<script|<canvas|onClick/)
  })

  it('applies every reviewed rich heading and keeps quoted examples, lesson IDs, quizzes and sanitizer protections', () => {
    const raw = JSON.parse(
      readFileSync('pm-content/pmp/source/course.json', 'utf8'),
    )
    for (const [id, edits] of Object.entries(headings)) {
      const text = id.startsWith('n')
        ? pmpCourse.nodes.find((n) => n.id === id)?.supplement
        : pmpCourse.cases.find((n) => n.id === id)?.debrief
      for (const value of Object.values(edits))
        expect(text, id + ' ' + value).toContain(value.replace(/&/g, '&amp;'))
    }
    for (const n of pmpCourse.nodes) {
      const old = raw.nodes.find((x: { id: string }) => x.id === n.id)
      for (const key of [
        'track',
        'scene',
        'options',
        'recall',
        'links',
        'terms',
        'task',
        'sources',
        'level',
      ] as const)
        expect(n[key]).toEqual(old[key])
      expect(pmpCatalog.nodes.find((x) => x.id === n.id)?.title).toBe(n.title)
      expect(search.find((x) => x.path === '/learn/pmp/' + n.id)?.title).toBe(
        n.title,
      )
    }
    for (const n of pmpCourse.cases)
      expect(
        search.find((x) => x.path === '/learn/pmp/case/' + n.id)?.title,
      ).toBe(n.title)
    const example = pmpCourse.nodes.find((n) => n.id === 'n56')!.supplement!
    expect(example).toContain('“현장 대표는 변화에 반대한다.”')
    expect(() => nativePmpHtml('<h2 onclick="bad()">unsafe</h2>')).toThrow()
    for (const n of c.lessons)
      expect(
        search.find((x) => x.path === '/learn/certificate/' + n.id)?.title,
      ).toBe(n.title)
  })

  it('changes Jira display labels without rewriting source data, questions, lesson IDs or records', () => {
    const original = readFileSync(
      'learning-content/jira/template/data.js',
      'utf8',
    )
    expect(readFileSync('public/jira/data.js', 'utf8')).toBe(original)
    const context = { window: { STUDY_DATA: undefined as unknown } }
    runInNewContext(original, context)
    const before = JSON.parse(JSON.stringify(context.window.STUDY_DATA))
    const script = readFileSync('public/jira/app.js', 'utf8')
    expect(script.startsWith("'use strict';\n")).toBe(true)
    for (const value of Object.values(jiraCopy)) expect(script).toContain(value)
    runInNewContext(script.split('\n').find(line => line.startsWith('const lessonTitles='))!, context)
    const after = context.window.STUDY_DATA as typeof before
    expect(after.lessons).toHaveLength(10)
    for (const lesson of after.lessons) {
      const old = before.lessons.find((x: { id: number }) => x.id === lesson.id)
      expect({ ...lesson, title: old.title }).toEqual(old)
      expect(lesson.title).toBe(
        (jiraTitles.lessons as Record<string, string>)[lesson.id],
      )
      expect(jiraCatalog.lessons.find((x) => x.id === lesson.id)?.title).toBe(
        lesson.title,
      )
    }
    for (const [key, value] of Object.entries(before))
      if (key !== 'lessons') expect(after[key]).toEqual(value)
    for (const title of Object.values(jiraTitles.headings))
      expect(script).toContain(title)
  })
})
