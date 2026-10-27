export type RiskInput = {
  fixed: number
  probability: number
  loss: number
  limit: number
}
export const RISK_DEFAULTS: RiskInput = {
  fixed: 30,
  probability: 20,
  loss: 100,
  limit: 50,
}
export const EQUAL_EXPECTATION_EXAMPLES: RiskInput[] = [
  RISK_DEFAULTS,
  { ...RISK_DEFAULTS, probability: 10, loss: 200 },
  { ...RISK_DEFAULTS, probability: 40, loss: 50 },
]
export function parseRiskAmount(text: string, max = 1_000_000): number | null {
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text.trim())) return null
  const value = Number(text)
  return Number.isFinite(value) && value <= max ? value : null
}
const valid = (value: number, max: number) =>
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max &&
  Math.round(value * 100) / 100 === value
/** Two exclusive events: loss L with probability p, otherwise loss0. Costs are positive. */
export function calculateRisk(input: RiskInput) {
  const { fixed, probability, loss, limit } = input
  if (
    ![fixed, loss, limit].every((v) => valid(v, 1_000_000)) ||
    !valid(probability, 100)
  )
    return null
  const fixedCents = Math.round(fixed * 100),
    lossCents = Math.round(loss * 100)
  const basisPoints = Math.round(probability * 100)
  // Products are at most1e12, safely exact integers; comparison uses no display rounding.
  const weightedLoss = lossCents * basisPoints,
    weightedFixed = fixedCents * 10_000
  return {
    expectedLoss: weightedLoss / 1_000_000,
    lowerExpectedCost:
      weightedLoss === weightedFixed
        ? ('equal' as const)
        : weightedLoss < weightedFixed
          ? ('b' as const)
          : ('a' as const),
    noEventPercent: (10_000 - basisPoints) / 100,
    bExceedPercent: loss > limit ? probability : 0,
    aExceedPercent: fixed > limit ? 100 : 0,
  }
}
export const formatRisk = (value: number) =>
  new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 6 }).format(value)
