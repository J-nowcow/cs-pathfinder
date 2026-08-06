import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { loadMapData } from '@/lib/db/graph'
import { socialMeta } from '@/lib/site'

export const revalidate = 0

export const metadata: Metadata = socialMeta({
  title: '질문 지도 — 꼬리에 꼬리를 무는 CS 공부',
  description: '지금까지 올라온 CS 질문을 한눈에 본다.',
})

// React Flow는 무겁다. 지도를 열 때만 받는다
const GraphMap = dynamic(() => import('@/components/GraphMap').then((m) => m.GraphMap))

export default async function MapPage() {
  await ensureSeeded()
  const data = await loadMapData()
  return <GraphMap data={data} />
}
