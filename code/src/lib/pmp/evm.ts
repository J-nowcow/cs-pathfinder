export const EVM_LIMIT = 100_000_000
export type EvmInput = {
  bac: number
  pv: number
  ev: number
  ac: number
  etc: number | null
}
export const EVM_DEFAULTS: EvmInput = {
  bac: 100,
  pv: 50,
  ev: 40,
  ac: 50,
  etc: 70,
}
/** Educational budget units, at most two decimal places in the UI. */
export function parseEvmAmount(text: string): number | null {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text.trim())) return null
  const value = Number(text)
  return Number.isFinite(value) && value <= EVM_LIMIT ? value : null
}
const validAmount = (value: number) =>
  Number.isFinite(value) &&
  value >= 0 &&
  value <= EVM_LIMIT &&
  (value === 0 || value >= 0.01)
export function calculateEvm(input: EvmInput) {
  const { bac, pv, ev, ac, etc } = input
  if (
    ![bac, pv, ev, ac].every(validAmount) ||
    bac <= 0 ||
    pv > bac ||
    ev > bac ||
    (etc !== null && !validAmount(etc))
  )
    return null
  const remaining = bac - ev
  const cpi = ac > 0 ? ev / ac : null
  const spi = pv > 0 ? ev / pv : null
  const eacCpi = cpi !== null && cpi > 0 ? bac / cpi : null
  return {
    cpi,
    spi,
    cv: ev - ac,
    sv: ev - pv,
    remaining,
    eacCpi,
    etcCpi: eacCpi === null ? null : remaining / cpi!,
    vacCpi: eacCpi === null ? null : bac - eacCpi,
    eacPlan: ac + remaining,
    eacBottomUp: etc === null ? null : ac + etc,
    tcpiBac: bac > ac ? remaining / (bac - ac) : null,
  }
}
/** Display rounding never feeds back into calculations. Tiny ratios stay nonzero. */
export function formatEvm(value: number | null): string {
  return value === null
    ? '계산 불가'
    : new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 6 }).format(
        Object.is(value, -0) ? 0 : value,
      )
}
