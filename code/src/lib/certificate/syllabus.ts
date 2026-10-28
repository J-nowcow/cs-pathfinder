import source from '../../../learning-content/certificate/syllabus.json'
export const certificateSyllabus = source
export function certificateLocation(id: string) {
  for (const subject of source.written.subjects) {
    const unit = subject.units.find((unit) => unit.lessons.includes(id))
    if (unit) return { subject, unit }
  }
  return undefined
}
