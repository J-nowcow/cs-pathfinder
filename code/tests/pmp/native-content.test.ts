import { describe, it, expect } from 'vitest'
import {
  pmpCourse,
  lessonById,
  pmpOrder,
  nativePmpHtml,
} from '@/lib/pmp/course'
import { pmpQuestions } from '@/lib/pmp/questions'
describe('검증된 PMP 원천의 네이티브 읽기', () => {
  it('74stable lessons,14chapters,83questions and321terms retain complete source identity', () => {
    expect(lessonById.size).toBe(74)
    expect(pmpCourse.tracks).toHaveLength(14)
    expect(new Set(pmpOrder).size).toBe(74)
    expect(pmpQuestions.size).toBe(83)
    for (const q of pmpQuestions.values())
      expect(q.scene.trim().length).toBeGreaterThan(0)
    expect(pmpCourse.glossary).toHaveLength(321)
    expect(new Set(pmpCourse.tracks.flatMap((t) => t.order))).toEqual(
      new Set(pmpOrder),
    )
    for (const n of pmpCourse.nodes) {
      expect(pmpQuestions.get(n.id)?.options).toEqual(n.options)
      expect(n.body.length).toBeGreaterThan(0)
      for (const id of n.links) expect(lessonById.has(id)).toBe(true)
    }
  })
  it('authored rich explanations and case debriefs contain no active controls and internal links resolve natively', () => {
    const rich = [
      ...pmpCourse.nodes
        .map((n) => ('supplement' in n ? n.supplement : ''))
        .filter(Boolean),
      ...pmpCourse.cases.map((c) => c.debrief),
    ]
    for (const h of rich) {
      const out = nativePmpHtml(h!)
      expect(out).not.toContain('pmp-lesson:')
      for (const m of out.matchAll(/href="\/learn\/pmp\/(n\d+)"/g))
        expect(lessonById.has(m[1])).toBe(true)
    }
    expect(() => nativePmpHtml('<img onerror="bad()">')).toThrow()
    expect(() => nativePmpHtml('<iframe src="bad">')).toThrow()
    expect(() => nativePmpHtml('<a href="javascript:bad()">')).toThrow()
  })
})
