import catalog from '../../../data/certificate-catalog.json'

// Exact authored checklist strings remain storage identifiers. Full lesson
// explanations, examples stay in the server course module; only the active recall answer
// is serialized by the lesson page for its practice component.
export const certificateCatalog = new Map(catalog.map((lesson) => [lesson.id, lesson]))
