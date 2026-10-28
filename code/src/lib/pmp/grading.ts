import grading from '../../../data/pmp-grading.json'

// Every authored identity remains available to local storage validation without
// shipping unrelated scenarios, choice text or explanations to each lesson.
export const pmpGrading = new Map(grading.map((q) => [q.id, q]))
export const isPmpLesson = (id: string) => pmpGrading.get(id)?.node === id
