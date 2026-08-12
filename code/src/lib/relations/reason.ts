/**
 * 관련 질문 아래에 보이는 한 줄을 서비스의 평어체로 맞춘다.
 *
 * 새 판정뿐 아니라 이미 DB에 심긴 옛 근거에도 적용한다. 데이터 파일을 고쳐도
 * 운영 DB의 문장은 다음 시드 전까지 남기 때문이다.
 */
export function normalizeRelationReason(reason: string): string {
  return reason
    .replace(/(필요|가능|중요|유용|적합|불가능)합니다([.!?]?)$/, '$1하다$2')
    .replace(/(합니다|됩니다|있습니다|없습니다|입니다)([.!?]?)$/, (_, ending: string, mark: string) => {
      const plain: Record<string, string> = {
        합니다: '한다',
        됩니다: '된다',
        있습니다: '있다',
        없습니다: '없다',
        입니다: '이다',
      }
      return `${plain[ending]}${mark}`
    })
    .trim()
}
