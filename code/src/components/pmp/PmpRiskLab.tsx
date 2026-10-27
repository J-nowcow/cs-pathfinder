'use client'
import { useEffect, useState } from 'react'
import {
  calculateRisk,
  EQUAL_EXPECTATION_EXAMPLES,
  formatRisk,
  parseRiskAmount,
  RISK_DEFAULTS,
  type RiskInput,
} from '@/lib/pmp/risk'
const fields = (input: RiskInput) =>
  Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, String(value)]),
  )
const inputs = [
  ['fixed', 'A 확정 비용'],
  ['probability', 'B 사건 발생 확률 (%)'],
  ['loss', 'B 사건 발생 시 손실'],
  ['limit', '비교할 금액 한도'],
] as const
const presets = [
  { label: '기본 예제', input: RISK_DEFAULTS },
  { label: '같은 기대손실 · 10%·200', input: EQUAL_EXPECTATION_EXAMPLES[1] },
  { label: '같은 기대손실 · 40%·50', input: EQUAL_EXPECTATION_EXAMPLES[2] },
  { label: '발생 확률 0%', input: { ...RISK_DEFAULTS, probability: 0 } },
  { label: '발생 확률 100%', input: { ...RISK_DEFAULTS, probability: 100 } },
  { label: 'A도 한도를 넘으면', input: { ...RISK_DEFAULTS, fixed: 60 } },
]
export function PmpRiskLab() {
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState(() => fields(RISK_DEFAULTS))
  useEffect(() => setReady(true), [])
  const values = Object.fromEntries(
    inputs.map(([key]) => [
      key,
      parseRiskAmount(input[key], key === 'probability' ? 100 : 1_000_000) ??
        NaN,
    ]),
  ) as RiskInput
  const result = calculateRisk(values)
  const comparison =
    result?.lowerExpectedCost === 'equal'
      ? '두 대안의 기대 비용이 같습니다.'
      : result?.lowerExpectedCost === 'b'
        ? 'B의 기대손실이 A의 확정 비용보다 작습니다.'
        : 'A의 확정 비용이 B의 기대손실보다 작습니다.'
  return (
    <section
      id="risk-lab"
      className="pmp-risk-lab"
      aria-labelledby="risk-title"
    >
      <p className="study-meta">직접 비교하는 기대손실과 한도</p>
      <h2 id="risk-title">평균 손실이 작으면 감당할 수 있을까요?</h2>
      <p>
        A는 확정 비용을 지출합니다. B는 사건 발생 시 입력한 손실, 미발생 시 손실
        0이라는 두 경우만 둡니다. 비용과 손실을 같은 가상 금액 단위의 양수로
        표시합니다.
      </p>
      <div className="pmp-risk-inputs">
        {inputs.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max={key === 'probability' ? '100' : '1000000'}
              step="0.01"
              value={input[key]}
              disabled={!ready}
              aria-invalid={!Number.isFinite(values[key])}
              aria-describedby="risk-input-help"
              onChange={(event) =>
                setInput({ ...input, [key]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div
        className="pmp-risk-presets"
        role="group"
        aria-label="기본 예제에서 시작하는 위험 실험"
      >
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.label}
            disabled={!ready}
            onClick={() => setInput(fields(preset.input))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="study-meta" id="risk-input-help">
        빈칸 없이 금액은 0~100만, 확률은 0~100%로 입력하세요. 소수 둘째 자리까지
        받습니다. 버튼은 네 값을 모두 예제로 재설정하며 입력은 저장하지
        않습니다.
      </p>
      <noscript>
        <p>
          JavaScript가 꺼져 있어 기본 예제의 계산과 비교표를 표시합니다. 입력과
          실험 버튼은 JavaScript를 켜야 사용할 수 있습니다.
        </p>
      </noscript>
      <div
        className="pmp-risk-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {result ? (
          <p>
            {comparison} 이 모형에서 B의 금액 한도 초과 확률은{' '}
            <strong>{formatRisk(result.bExceedPercent)}%</strong>입니다.
          </p>
        ) : (
          <p>
            입력값을 확인하세요. 빈칸·음수·금액 100만 초과·확률 100% 초과·소수
            셋째 자리 이하는 계산하지 않습니다.
          </p>
        )}
      </div>
      {result && (
        <>
          <div className="pmp-risk-results">
            <section>
              <h3>A 확정 비용</h3>
              <p className="pmp-risk-value">{formatRisk(values.fixed)}</p>
              <p>정한 한도를 넘을 확률: {formatRisk(result.aExceedPercent)}%</p>
            </section>
            <section>
              <h3>B 기대손실</h3>
              <p className="pmp-risk-value">
                {formatRisk(result.expectedLoss)}
              </p>
              <p>사건 발생 시 손실: {formatRisk(values.loss)}</p>
            </section>
          </div>
          <figure className="pmp-risk-outcomes">
            <figcaption>B에서 가능한 두 사건</figcaption>
            <div>
              <span>사건 미발생 · 손실 0</span>
              <strong>{formatRisk(result.noEventPercent)}%</strong>
              <span className="pmp-risk-track" aria-hidden="true">
                <i style={{ width: `${result.noEventPercent}%` }} />
              </span>
            </div>
            <div>
              <span>사건 발생 · 손실 {formatRisk(values.loss)}</span>
              <strong>{formatRisk(values.probability)}%</strong>
              <span className="pmp-risk-track" aria-hidden="true">
                <i style={{ width: `${values.probability}%` }} />
              </span>
            </div>
            <p>
              기대손실 = {formatRisk(values.probability)}% ×{' '}
              {formatRisk(values.loss)} + {formatRisk(result.noEventPercent)}% ×
              0 = <strong>{formatRisk(result.expectedLoss)}</strong>
            </p>
          </figure>
          <section className="pmp-risk-limit">
            <h3>평균과 한도를 따로 읽기</h3>
            <p>
              {values.probability === 0 ? (
                '이 입력은 사건 발생 확률을 0으로 가정합니다. 따라서 모형 안의 기대손실과 한도 초과 확률도 0입니다. 현실에서 사건이 불가능하다는 증명은 아닙니다.'
              ) : result.bExceedPercent > 0 ? (
                <>
                  사건이 발생하면 손실 {formatRisk(values.loss)}이 한도{' '}
                  {formatRisk(values.limit)}을 넘습니다. 기대손실만 작다고 이
                  손실을 감당할 수 있는 것은 아닙니다.
                </>
              ) : (
                <>
                  B의 사건 발생 시 손실은 한도 {formatRisk(values.limit)}{' '}
                  이내입니다. 이 사실만으로 대안의 적합성이나 안전성을 보장하지
                  않습니다.
                </>
              )}
            </p>
            {result.aExceedPercent > 0 && (
              <p>
                A의 확정 비용도 한도를 넘습니다. 한도 내 대안으로 표시하지
                않습니다.
              </p>
            )}
            <p>
              한도는 이 실습에서 두 대안의 비용·손실과 비교하려고 직접 정한
              금액입니다. ‘초과’는 한도보다 큰 경우이며 같은 금액은 포함하지
              않습니다.
            </p>
          </section>
        </>
      )}
      <section>
        <h3>기대손실은 20인데 어떤 점이 다를까요?</h3>
        <p>
          아래는 한도를 50으로 고정한 비교 예제입니다. 입력값에 따라 바뀌는 표가
          아닙니다. 위의 같은 기대손실 버튼으로 각각 실험해 보세요.
        </p>
        <div
          className="pmp-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="같은 기대손실의 다른 결과 비교"
        >
          <table>
            <caption>B의 사건 발생 확률과 손실 비교 · 가상 금액 단위</caption>
            <thead>
              <tr>
                {[
                  '발생 확률',
                  '발생 시 손실',
                  '기대손실',
                  '한도 50 초과 확률',
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EQUAL_EXPECTATION_EXAMPLES.map((example) => {
                const r = calculateRisk(example)!
                return (
                  <tr key={example.probability}>
                    <th scope="row">{example.probability}%</th>
                    <td>{example.loss}</td>
                    <td>{formatRisk(r.expectedLoss)}</td>
                    <td>{formatRisk(r.bExceedPercent)}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p>
          20%·100과 10%·200의 기대손실은 모두 20입니다. 두 번째는 드물게
          발생하지만 발생 시 손실이 더 큽니다. 40%·50은 기대손실이 같아도 이
          모형에서 한도를 초과하지 않습니다. 어떤 차이를 중요하게 볼지 먼저
          정해야 합니다.
        </p>
      </section>
      <details>
        <summary>이 계산의 가정과 한계</summary>
        <p>
          기대값은 가능한 결과에 확률을 곱해 더한 값입니다. 한 번의 프로젝트에서
          그 금액만 손실 난다는 뜻이 아닙니다. 이 실습은 입력한 확률과 손실을
          확정된 모형 값으로 다루며 추정의 불확실성이나 반복 노출은 계산하지
          않습니다.
        </p>
        <p>
          금액 한도는 조직의 위험 선호도나 효용함수를 대신하지 않습니다. 공통
          비용·보험·다른 편익은 생략했습니다. 기대손실이 작은 대안을 자동으로
          추천하지 않으며 안전·규제 조건과 승인 기준은 별도로 확인합니다.
        </p>
        <p>
          금액·확률은 소수 둘째 자리까지 받고 기대손실은 더 작은 값도
          표시합니다. 표시는 최대 6자리 유효숫자로 반올림하지만 대안 비교는
          표시값으로 하지 않습니다.
        </p>
      </details>
      <p className="study-meta">
        기초 원리 참고:{' '}
        <a
          href="https://www.pmi.org/learning/library/decision-tree-analysis-expected-utility-8214"
          target="_blank"
          rel="noopener noreferrer"
        >
          Hulett · PMI, Decision tree analysis for the risk averse organization
        </a>{' '}
        (2006, 페이지 표시 10월). 2026.10.28 원문 확인. 기대값과 위험 태도의
        차이를 참고한 역사적 자료이며 최신 시험 정책의 근거가 아닙니다. 가상
        대안·금액 한도·그림은 자체 제작했습니다.
      </p>
    </section>
  )
}
