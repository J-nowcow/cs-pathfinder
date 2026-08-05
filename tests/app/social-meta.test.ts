import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '@/lib/db/client'
import { insertNode } from '@/lib/expand/nodes'
import { createSharedTree } from '@/lib/db/trees'
import { socialMeta, OG_IMAGE_PATH } from '@/lib/site'
import type { Snapshot } from '@/lib/tree/snapshot'

/**
 * 공유 태그가 페이지마다 빠지는 사고를 막는다.
 *
 * generateMetadata가 openGraph를 반환하면 Next는 파일 규약(app/opengraph-image.png)을
 * 합쳐주지 않는다. 그래서 페이지가 이미지를 직접 넣어야 하는데, 두 번 빠뜨렸다.
 * 실패 모양이 고약하다 — 화면은 멀쩡하고 카톡에 붙였을 때만 썸네일이 없다.
 * 개발 중에는 아무도 모른다.
 */

describe('socialMeta', () => {
  it('always carries an image on both sides', () => {
    const m = socialMeta({ title: '제목', description: '설명' })
    expect(m.openGraph.images).toEqual([OG_IMAGE_PATH])
    expect(m.twitter.images).toEqual([OG_IMAGE_PATH])
  })

  it('uses a card type that shows the image large', () => {
    // summary만 쓰면 카톡·트위터가 작은 정사각 썸네일로 줄여 그린다
    expect(socialMeta({ title: 'a', description: 'b' }).twitter.card).toBe('summary_large_image')
  })

  it('marks korean locale', () => {
    expect(socialMeta({ title: 'a', description: 'b' }).openGraph.locale).toBe('ko_KR')
  })

  it('defaults to website and takes article when asked', () => {
    expect(socialMeta({ title: 'a', description: 'b' }).openGraph.type).toBe('website')
    expect(socialMeta({ title: 'a', description: 'b', type: 'article' }).openGraph.type).toBe(
      'article',
    )
  })
})

/**
 * 페이지가 실제로 그것을 쓰는지 본다.
 *
 * socialMeta만 테스트하면 페이지가 안 쓰는 경우를 못 잡는다. 그게 실제로 난 사고다.
 */
describe('page metadata', () => {
  beforeEach(truncateAll)

  async function makeNode(): Promise<string> {
    return insertNode({
      identityScope: 'network',
      normalizedQuestion: 'TIME_WAIT이 필요한 이유는?',
      body: '마지막 ACK가 유실될 수 있기 때문이다.\n\n두 번째 문단이다.',
      primaryCategory: '네트워크',
      status: 'ready',
      origin: 'on_demand',
    })
  }

  it('gives the reading view a share image', async () => {
    const { generateMetadata } = await import('@/app/q/[nodeId]/page')
    const nodeId = await makeNode()

    const meta = await generateMetadata({ params: Promise.resolve({ nodeId }) })

    expect(meta.title).toBe('TIME_WAIT이 필요한 이유는?')
    expect(meta.openGraph?.images).toEqual([OG_IMAGE_PATH])
    expect(meta.twitter?.images).toEqual([OG_IMAGE_PATH])
    // 미리보기 둘째 줄은 해설 첫 문단이다
    expect(meta.description).toContain('마지막 ACK')
  })

  it('gives the shared tree a share image', async () => {
    const { generateMetadata } = await import('@/app/t/[slug]/page')
    const nodeId = await makeNode()

    const snapshot: Snapshot = {
      rootNodeId: nodeId,
      rows: [{ tempId: 't0', nodeId, parentTempId: null, position: 0 }],
    }
    const created = await createSharedTree({ snapshot, title: '내가 판 트리' })
    if (!created.ok) throw new Error(created.reason)

    const meta = await generateMetadata({ params: Promise.resolve({ slug: created.slug }) })

    expect(meta.title).toBe('내가 판 트리')
    expect(meta.openGraph?.images).toEqual([OG_IMAGE_PATH])
    expect(meta.twitter?.images).toEqual([OG_IMAGE_PATH])
  })

  /** 없는 것에는 제목만 준다. 이미지를 붙이면 없는 페이지가 그럴듯해 보인다 */
  it('does not dress up a missing page', async () => {
    const { generateMetadata } = await import('@/app/t/[slug]/page')
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'zzzzzzzzzzzz' }) })
    expect(meta.openGraph).toBeUndefined()
  })
})
