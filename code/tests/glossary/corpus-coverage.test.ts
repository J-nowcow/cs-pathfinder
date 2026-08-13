import { describe, expect, it } from 'vitest'
import { GLOSSARY } from '../../data/glossary'
import { EXAMPLE_NODES } from '../../data/example-nodes'
import { GENERATED_NODES } from '../../data/generated-nodes'
import { AUTHORED_NODES } from '../../data/authored-nodes'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'
import { NODE_TAGS } from '../../data/node-tags'
import type { SearchableRootSummary } from '@/lib/db/roots'
import { questionsForConcept } from '@/lib/glossary/questions'

const tagsByQuestion = new Map(NODE_TAGS.map((item) => [item.question, item.tags]))
const nodes = [...EXAMPLE_NODES, ...GENERATED_NODES, ...AUTHORED_NODES, ...ON_DEMAND_NODES]
const roots: SearchableRootSummary[] = nodes.map((node, index) => ({
  id: String(index),
  question: node.question,
  category: node.category,
  excerpt: node.body.split('\n\n')[0],
  searchText: node.body,
  tags: tagsByQuestion.get(node.question) ?? [],
  level: null,
}))

describe('용어에서 면접 질문으로 가는 말뭉치 연결', () => {
  it('사전에 공개한 모든 용어에서 한 개 이상의 질문을 찾는다', () => {
    const disconnected = GLOSSARY.filter(
      (entry) => questionsForConcept(entry, roots).length === 0,
    ).map((entry) => entry.term)

    expect(disconnected, '눌렀는데 질문이 없는 용어').toEqual([])
  })

  it('한 용어에 추천하는 질문은 다섯 개를 넘지 않는다', () => {
    for (const entry of GLOSSARY) {
      expect(questionsForConcept(entry, roots).length).toBeLessThanOrEqual(5)
    }
  })
})
