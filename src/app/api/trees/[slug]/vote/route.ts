import { cookies } from 'next/headers'
import { toggleVote } from '@/lib/db/votes'
import { isValidSlug } from '@/lib/tree/slug'
import {
  VOTER_COOKIE,
  VOTER_COOKIE_MAX_AGE,
  isVoterId,
  newVoterId,
  voterKey,
} from '@/lib/vote/identity'

// 표는 매번 실제 상태를 봐야 한다. 캐시 대상이 아니다.
export const dynamic = 'force-dynamic'

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  })
}

/**
 * 추천 토글.
 *
 * 누르면 켜지고 다시 누르면 꺼진다. 취소가 없으면 잘못 누른 사람이 되돌릴 방법이
 * 없고, 그 한 표가 정렬에 영원히 남는다.
 *
 * 식별자가 없으면 여기서 발급한다. 페이지는 서버 컴포넌트라 쿠키를 못 쓰는데,
 * 라우트 핸들러는 쓸 수 있다. 처음 누르는 사람은 이 응답으로 식별자를 받는다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params
  if (!isValidSlug(slug)) return json({ error: 'not_found' }, 404)

  const jar = await cookies()
  const existing = jar.get(VOTER_COOKIE)?.value
  const id = isVoterId(existing) ? existing : newVoterId()

  const result = await toggleVote(slug, voterKey(id))
  if (!result) return json({ error: 'not_found' }, 404)

  if (id !== existing) {
    jar.set(VOTER_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      // 로컬 http에서도 붙어야 개발 중에 확인이 된다
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: VOTER_COOKIE_MAX_AGE,
    })
  }

  return json(result, 200)
}
