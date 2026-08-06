/**
 * 게시판 페이지네이션.
 *
 * **offset을 쓰지 않는다.** 게시판은 새 트리가 계속 위로 쌓이는 목록이라, 2페이지를
 * 여는 사이에 하나가 발행되면 1페이지 마지막 항목이 2페이지 첫 항목으로 다시 나온다.
 * 반대로 upvote가 오르내리면 아예 건너뛴 항목이 생긴다. 커서는 "이 값 다음"이라
 * 목록이 흔들려도 같은 자리를 가리킨다.
 *
 * offset은 성능도 나쁘다. Postgres는 건너뛸 행을 세어가며 읽는다.
 */

export type SortMode = 'recent' | 'popular'

export type Cursor = {
  id: string
  /** ISO 8601. Date 객체를 그대로 넣으면 직렬화 왕복에서 밀리초가 깎인다 */
  publishedAt: string
  upvotes: number
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 필드명을 한 글자로 줄인다. 커서가 주소창에 그대로 보이는 값이라 짧을수록 낫다 */
type Wire = { i: string; t: string; u: number }

export function encodeCursor(c: Cursor): string {
  const wire: Wire = { i: c.id, t: c.publishedAt, u: c.upvotes }
  return Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url')
}

/**
 * 커서를 읽는다. 이상하면 null이다.
 *
 * 던지지 않는다. 이 값은 주소창에 노출되고 사용자가 언제든 고칠 수 있다.
 * 여기서 예외가 나면 게시판이 통째로 죽는다. 첫 페이지로 떨어지는 편이 낫다.
 *
 * id를 uuid로 검사하는 건 형식 문제가 아니라 이 값이 그대로 SQL 파라미터로
 * 나가기 때문이다. 파라미터 바인딩이라 주입은 막히지만, 형식이 틀리면 Postgres가
 * 타입 캐스팅에서 에러를 던져 500이 난다.
 */
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

    const w = parsed as Record<string, unknown>
    if (typeof w.i !== 'string' || !UUID_RE.test(w.i)) return null
    if (typeof w.t !== 'string' || Number.isNaN(Date.parse(w.t))) return null
    if (typeof w.u !== 'number' || !Number.isFinite(w.u)) return null

    return { id: w.i, publishedAt: w.t, upvotes: w.u }
  } catch {
    return null
  }
}

/**
 * 정렬 순서.
 *
 * 마지막에 id를 붙이는 게 핵심이다. published_at만으로 정렬하면 같은 순간에 발행된
 * 두 트리의 순서가 매 질의마다 달라져서, 커서가 가리키는 "다음"이 흔들린다.
 * id는 유일하므로 동점을 반드시 깬다.
 */
export function orderClause(sort: SortMode): string {
  return sort === 'popular'
    ? 'order by t.upvotes desc, t.published_at desc, t.id desc'
    : 'order by t.published_at desc, t.id desc'
}

/**
 * 커서 다음 구간을 자르는 조건.
 *
 * 컬럼을 하나씩 비교하면 안 된다. `upvotes < $1 or (upvotes = $1 and ...)`를 손으로
 * 펼치면 괄호 하나 틀리는 순간 조용히 행을 흘린다. 행 생성자 비교는 정렬 순서와
 * 같은 의미를 한 줄로 쓴다.
 *
 * 정렬이 전부 desc라 부등호는 `<`다.
 */
export function cursorPredicate(
  sort: SortMode,
  cursor: Cursor | null,
  firstParamIndex: number,
): { sql: string | null; params: unknown[] } {
  if (!cursor) return { sql: null, params: [] }

  const p = (offset: number) => `$${firstParamIndex + offset}`

  if (sort === 'popular') {
    return {
      sql: `(t.upvotes, t.published_at, t.id) < (${p(0)}, ${p(1)}, ${p(2)})`,
      params: [cursor.upvotes, cursor.publishedAt, cursor.id],
    }
  }

  return {
    sql: `(t.published_at, t.id) < (${p(0)}, ${p(1)})`,
    params: [cursor.publishedAt, cursor.id],
  }
}
