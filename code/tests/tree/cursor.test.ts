import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor, cursorPredicate, orderClause } from '@/lib/tree/cursor'

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  publishedAt: '2026-08-05T09:30:00.000Z',
  upvotes: 7,
}

describe('cursor', () => {
  it('survives a round trip', () => {
    expect(decodeCursor(encodeCursor(ROW))).toEqual(ROW)
  })

  it('is url safe', () => {
    // 게시판 커서는 쿼리스트링에 그대로 붙는다. +, /, = 가 섞이면 인코딩이 한 겹 더 필요해진다
    expect(encodeCursor(ROW)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('reads a missing cursor as the first page', () => {
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('reads a tampered cursor as the first page instead of throwing', () => {
    // 커서는 사용자가 주소창에서 손댈 수 있다. 여기서 던지면 게시판이 통째로 죽는다
    expect(decodeCursor('not-base64!!')).toBeNull()
    expect(decodeCursor(Buffer.from('{"nope":1}').toString('base64url'))).toBeNull()
    expect(decodeCursor(Buffer.from('[]').toString('base64url'))).toBeNull()
    expect(decodeCursor(Buffer.from('{"id":5}').toString('base64url'))).toBeNull()
  })

  it('rejects a cursor whose id is not a uuid', () => {
    const forged = Buffer.from(
      JSON.stringify({ i: "' or 1=1 --", t: ROW.publishedAt, u: 0 }),
    ).toString('base64url')
    expect(decodeCursor(forged)).toBeNull()
  })

  it('orders recent by time then id', () => {
    // id가 없으면 같은 순간에 발행된 두 트리에서 페이지가 겹치거나 빠진다
    expect(orderClause('recent')).toBe('order by t.published_at desc, t.id desc')
  })

  it('orders popular by votes first and still breaks ties deterministically', () => {
    expect(orderClause('popular')).toBe('order by t.upvotes desc, t.published_at desc, t.id desc')
  })

  it('gives no predicate on the first page', () => {
    expect(cursorPredicate('recent', null, 1)).toEqual({ sql: null, params: [] })
  })

  it('compares the whole sort key as a tuple, not just the timestamp', () => {
    const got = cursorPredicate('recent', ROW, 3)
    expect(got.sql).toBe('(t.published_at, t.id) < ($3, $4)')
    expect(got.params).toEqual([ROW.publishedAt, ROW.id])
  })

  it('includes upvotes in the popular tuple', () => {
    const got = cursorPredicate('popular', ROW, 1)
    expect(got.sql).toBe('(t.upvotes, t.published_at, t.id) < ($1, $2, $3)')
    expect(got.params).toEqual([ROW.upvotes, ROW.publishedAt, ROW.id])
  })
})
