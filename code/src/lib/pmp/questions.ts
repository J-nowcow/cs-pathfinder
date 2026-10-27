import questions from '../../../data/pmp-native-questions.json'
export type PmpQuestion = {
  id: string
  node: string
  scene: string
  options: { text: string; why: string; correct: boolean }[]
  recall?: string
}
export const pmpQuestions = new Map<string, PmpQuestion>(
  questions.map((q) => [q.id, q]),
)
export const isPmpLesson = (id: string) => pmpQuestions.get(id)?.node === id
