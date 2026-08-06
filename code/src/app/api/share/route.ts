import { z } from 'zod'
import { ensureSeeded } from '@/lib/db/bootstrap'
import { buildSnapshot, MAX_SNAPSHOT_NODES, type SnapshotReason } from '@/lib/tree/snapshot'
import { createSharedTree } from '@/lib/db/trees'
import { MAX_TITLE_LENGTH } from '@/lib/tree/title'

/**
 * 경로를 공유 트리로 박제한다. 설계 §9의 `POST /api/share`.
 *
 * 익명 전용이라 경로가 서버에 없다. 클라이언트 sessionStorage의 발자국을 통째로
 * 받아서 검증한 뒤 심는다. 인증이 붙으면 여기가 journey_id 하나를 받는 모양으로 줄어든다.
 *
 * 응답은 캐시하지 않는다. 매번 새 trie를 만드는 쓰기 요청이다.
 */

// 발자국 하나. 클라이언트 JourneyState의 Occurrence와 같은 모양이다.
//
// question·category는 받지 않는다. 클라이언트가 보낸 문장을 그대로 저장하면
// 남의 화면에 임의 텍스트를 띄우는 통로가 된다. 화면에 쓸 문장은 서버가
// qnode에서 다시 읽는다.
const occurrenceSchema = z.object({
  id: z.string().min(1).max(64),
  node_id: z.string().uuid(),
  parent_id: z.string().min(1).max(64).nullable(),
})

const bodySchema = z.object({
  occurrences: z.array(occurrenceSchema).min(1).max(MAX_SNAPSHOT_NODES),
  current_id: z.string().min(1).max(64),
  // 비어 있으면 루트 질문이 제목이 된다. 넘치는 건 서버가 자른다
  title: z.string().max(MAX_TITLE_LENGTH * 4).optional().nullable(),
})

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

/**
 * 스냅샷 거절 사유를 사람이 읽을 문장으로 바꾼다.
 *
 * 대부분은 저장소가 손상된 경우라 사용자가 고칠 수 있는 게 없다. 그래서 원인을
 * 설명하는 대신 다음에 뭘 하면 되는지 말한다.
 */
const REASON_TEXT: Record<SnapshotReason, string> = {
  empty: '아직 판 길이 없어요.',
  no_current: '지금 읽고 있는 자리를 못 찾았어요. 새로고침하고 다시 해주세요.',
  no_root: '경로가 어디서 시작했는지 알 수 없어요. 새로고침하고 다시 해주세요.',
  duplicate_id: '경로 기록이 꼬였어요. 새로고침하고 다시 해주세요.',
  invalid_node_id: '경로 기록이 꼬였어요. 새로고침하고 다시 해주세요.',
  too_large: `한 번에 공유할 수 있는 질문은 ${MAX_SNAPSHOT_NODES}개까지예요.`,
}

export async function POST(request: Request): Promise<Response> {
  await ensureSeeded()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return json({ error: 'invalid_input', detail: 'JSON 본문을 읽을 수 없습니다.' }, 400)
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return json({ error: 'invalid_input', detail: parsed.error.issues[0]?.message ?? '' }, 400)
  }

  const body = parsed.data

  // 클라이언트 타입으로 되돌린다. question·category는 스냅샷 계산에 안 쓰여서
  // 빈 문자열로 채운다. 저장되는 값이 아니다.
  const built = buildSnapshot({
    occurrences: body.occurrences.map((o) => ({
      id: o.id,
      nodeId: o.node_id,
      parentId: o.parent_id,
      question: '',
      category: '',
    })),
    currentId: body.current_id,
  })

  if (!built.ok) {
    return json({ error: 'invalid_path', reason: built.reason, detail: REASON_TEXT[built.reason] }, 400)
  }

  const created = await createSharedTree({ snapshot: built.snapshot, title: body.title })

  if (!created.ok) {
    if (created.reason === 'unknown_node') {
      return json(
        { error: 'unknown_node', detail: '경로에 지금은 없는 질문이 섞여 있어요.' },
        400,
      )
    }
    // slug를 세 번 연속 놓쳤다. 2^59분의 1이 세 번 겹칠 확률이라 사실상
    // 무작위성이 깨졌다는 신호다. 그대로 500으로 올려 로그에 남긴다.
    return json({ error: 'server_error', detail: '공유 링크를 만들지 못했어요.' }, 500)
  }

  return json({ slug: created.slug, title: created.title, url: `/t/${created.slug}` }, 201)
}
