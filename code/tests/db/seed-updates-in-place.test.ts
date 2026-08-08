import { describe, it, expect, beforeEach } from 'vitest'
import { getDb, resetDb } from '@/lib/db/client'
import { ensureSeeded, resetSeedCache } from '@/lib/db/bootstrap'
import { ON_DEMAND_NODES } from '../../data/on-demand-nodes'

/**
 * 부팅 시드가 **있는 행을 고치는가, 새 행을 만드는가.**
 *
 * 시드는 id를 질문 해시에서 만든다. 그런데 사용자가 물어봐서 생긴 행은 그
 * 경로가 아니라 임의의 uuid로 만들어졌다. 같은 질문인데 id가 달라
 * `on conflict (id)`가 안 걸린다.
 *
 * 그래서 26편을 파일로 꺼내 시드에 넣었더니 **291행이 317행이 됐다.** 화면은
 * 옛 행(`/q/21`)을 계속 내보내고 고친 글은 새 행(`/q/292`)에만 들어갔다.
 * 사실 오류를 고쳤는데 사이트는 그대로였다. 배포하고 화면을 보고서야 알았다.
 *
 * 꼬리질문도 같은 결이다. 예전에는 새로 만든 행에서만 쓰고 충돌하면
 * `do nothing`이었다. 단추 44개를 고쳤는데 옛 글자가 그대로 나왔다.
 *
 * 둘 다 **눈으로 안 잡힌다.** 화면은 멀쩡하고 글도 멀쩡하다. 옛 글일 뿐이다.
 */
beforeEach(async () => {
  await resetDb()
  resetSeedCache()
})

const SAMPLE = ON_DEMAND_NODES[0]

describe('부팅 시드는 있는 행을 고친다', () => {
  it('id가 다른 같은 질문이 이미 있으면 새 행을 만들지 않는다', async () => {
    const db = await getDb()

    /*
     * 물어봐서 생긴 행을 흉내 낸다 -- 질문은 같고 id는 시드가 만들 값이
     * 아니다. 이것이 실제 운영에 있던 모양이다.
     */
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number)
       values ('11111111-2222-3333-4444-555555555555', $1, $2, '옛 글이다', $3, 'ready', 'on_demand', 9001)`,
      [SAMPLE.identityScope, SAMPLE.question, SAMPLE.category],
    )

    await ensureSeeded()

    const rows = await db.query<{ id: string; body: string; number: number }>(
      `select id, body, number from qnode where normalized_question = $1`,
      [SAMPLE.question],
    )

    /* 행이 둘이면 목록에 같은 질문이 두 번 뜨고 짧은 주소가 옛 글을 가리킨다 */
    expect(rows.length).toBe(1)
    expect(rows[0].id).toBe('11111111-2222-3333-4444-555555555555')
    /* 번호를 지켜야 한다. 새로 매기면 옛 주소가 죽는다 */
    expect(rows[0].number).toBe(9001)
    /* 그리고 파일의 글로 고쳐져 있어야 한다 */
    expect(rows[0].body).toBe(SAMPLE.body)
  })

  it('꼬리질문 글자가 바뀌면 갱신한다', async () => {
    const db = await getDb()
    await ensureSeeded()

    const before = await db.query<{ id: string }>(
      `select id from qnode where normalized_question = $1`,
      [SAMPLE.question],
    )
    const nodeId = before[0].id

    /* 옛 글자를 흉내 내 하나를 망가뜨린다 */
    await db.query(`update qnode_suggestion set text = '옛 단추다' where qnode_id = $1 and position = 0`, [
      nodeId,
    ])

    resetSeedCache()
    await ensureSeeded()

    const after = await db.query<{ text: string }>(
      `select text from qnode_suggestion where qnode_id = $1 and position = 0`,
      [nodeId],
    )
    expect(after[0].text).toBe(SAMPLE.suggestions[0])
  })
})

/**
 * 파일에 담긴 글은 **목록에 나와야 한다.**
 *
 * `origin`은 목록·지도·공개 말뭉치가 "내보내도 되는가"를 판단하는 열이다.
 * 물어봐서 생긴 행은 `on_demand`이고 그 셋에서 전부 빠진다.
 *
 * 사람이 읽고 고쳐 정적 파일에 옮겼으면 그 판단은 끝난 것이다. 시드가 그
 * 표시를 올려 주지 않으면 17편이 주소로만 닿는 유령이 된다.
 */
describe('파일에 담긴 글은 공개 목록에 오른다', () => {
  it('물어봐서 생긴 행도 파일에 있으면 origin이 batch로 오른다', async () => {
    const db = await getDb()
    await db.query(
      `insert into qnode (id, identity_scope, normalized_question, body, primary_category, status, origin, number)
       values ('99999999-8888-7777-6666-555555555555', $1, $2, $3, $4, 'ready', 'on_demand', 9002)`,
      [SAMPLE.identityScope, SAMPLE.question, SAMPLE.body, SAMPLE.category],
    )

    await ensureSeeded()

    const rows = await db.query<{ origin: string }>(
      `select origin from qnode where normalized_question = $1`,
      [SAMPLE.question],
    )
    expect(rows.length).toBe(1)
    expect(rows[0].origin).toBe('batch')
  })
})
