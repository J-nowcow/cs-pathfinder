/**
 * 아직 안 만들어진 표를 읽었을 때인지 가른다.
 *
 * 2026-08-06에 실제로 겪었다. 의미 관계 표(마이그레이션 0009)를 만들고 코드는
 * 배포했는데 프로덕션 DB에 적용을 안 했다. 빌드는 성공했고 배포도 READY였는데
 * 홈·목록·지도가 전부 500이었다. `relation "semantic_relation" does not exist`다.
 *
 * 두 가지가 겹쳤다. 마이그레이션 적용을 잇는 자리가 없는 것이 하나고, **덤으로
 * 얹은 기능 하나가 본체를 죽인 것**이 다른 하나다. 앞의 것은 배포 절차 문제라
 * 사람이 고쳐야 하지만, 뒤의 것은 코드가 막을 수 있다.
 *
 * Postgres의 `undefined_table` 오류 코드다. 문자열이 아니라 코드로 본다 —
 * 메시지는 서버 로케일에 따라 달라진다.
 */
const UNDEFINED_TABLE = '42P01'

export function isMissingTable(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === UNDEFINED_TABLE
}
