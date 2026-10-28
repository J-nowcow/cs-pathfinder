import catalog from '../../../data/certificate-catalog.json'

// Exact authored checklist strings remain storage identifiers. Full lesson
// explanations, examples and recall answers stay in the server course module.
export const certificateCatalog = new Map(catalog.map((lesson) => [lesson.id, lesson]))
