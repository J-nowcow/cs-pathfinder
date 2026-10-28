'use client'

import { useEffect, useId, useState } from 'react'
import {
  calculateFloat,
  parseFloatDuration,
  type FloatConfig,
} from '@/lib/pmp/float'

const positions: Record<string, [number, number]> = {
  A: [65, 145],
  B: [350, 50],
  C: [255, 240],
  E: [455, 240],
  D: [655, 145],
}
const labels = [
  ['es', '조기 시작 ES'],
  ['ef', '조기 종료 EF'],
  ['ls', '지연 시작 LS'],
  ['lf', '지연 종료 LF'],
  ['tf', '총 여유 TF'],
  ['ff', '자유 여유 FF'],
] as const
const fields = (durations: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(durations).map(([id, value]) => [id, String(value)]),
  )

export function PmpFloatLab({
  config,
  source,
}: {
  config: FloatConfig
  source: { title: string; url: string }
}) {
  const [ready, setReady] = useState(false)
  const [input, setInput] = useState(() => fields(config.defaults))
  const marker = useId().replace(/:/g, '')
  useEffect(() => setReady(true), [])
  const durations = Object.fromEntries(
    config.order.map((id) => [id, parseFloatDuration(input[id]) ?? NaN]),
  )
  const result = calculateFloat(config, durations)
  const baseline = calculateFloat(config, config.defaults)!.total
  return (
    <section
      className="pmp-float-lab"
      id="float-lab"
      aria-labelledby="float-title"
    >
      <p className="study-meta">직접 바꿔 보는 일정 · 5작업 예제</p>
      <h2 id="float-title">임계경로와 여유시간 실습</h2>
      <p>{config.assumptions}</p>
      <div className="pmp-float-inputs">
        {config.order.map((id) => (
          <label key={id}>
            {id} 기간 (일)
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="100"
              step="1"
              value={input[id]}
              disabled={!ready}
              aria-invalid={parseFloatDuration(input[id]) === null}
              aria-describedby="float-input-help"
              onChange={(event) =>
                setInput({ ...input, [id]: event.target.value })
              }
            />
          </label>
        ))}
      </div>
      <div
        className="pmp-float-presets"
        role="group"
        aria-label="기본 예제에서 시작하는 실험"
      >
        {config.presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={!ready}
            aria-pressed={config.order.every(
              (id) => durations[id] === preset.durations[id],
            )}
            onClick={() => setInput(fields(preset.durations))}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="study-meta" id="float-input-help">
        각 버튼은 기본 예제에서 시작합니다. 현재 값에 누적하지 않으며 입력한
        기간은 저장하지 않습니다.
      </p>
      <noscript>
        <p>
          JavaScript가 꺼져 있어 기본 예제의 계산 결과를 표시합니다. 기간 변경은
          JavaScript를 켠 뒤 이용할 수 있습니다.
        </p>
      </noscript>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pmp-float-summary"
      >
        {result ? (
          <>
            <p>
              <strong>프로젝트 종료 {result.total}일</strong> · 기본 예제{' '}
              {baseline}일 대비 {result.total - baseline > 0 ? '+' : ''}
              {result.total - baseline}일
            </p>
            <p>
              임계 경로 {result.critical.length}개:{' '}
              {result.critical.map((path) => path.ids.join(' → ')).join(' / ')}
            </p>
          </>
        ) : (
          <p>
            각 기간을 1~100 사이 정수로 입력하세요. 빈칸·소수는 계산하지
            않습니다.
          </p>
        )}
      </div>
      {result && (
        <>
          <figure className="pmp-float-figure">
            <svg
              viewBox="0 0 720 290"
              role="img"
              aria-label={`A 다음 B 또는 C·E, 두 경로가 끝나면 D. 임계 경로 ${result.critical.map((path) => path.ids.join('→')).join(', ')}. 실선은 임계 연결, 점선은 여유가 있는 연결.`}
            >
              <defs>
                <marker
                  id={marker}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0 0L10 5L0 10Z" fill="currentColor" />
                </marker>
              </defs>
              {config.order.flatMap((id) =>
                config.predecessors[id].map((previous) => {
                  const [x, y] = positions[previous],
                    [xx, yy] = positions[id]
                  const critical = result.critical.some((path) =>
                    path.ids.some(
                      (node, i) => node === previous && path.ids[i + 1] === id,
                    ),
                  )
                  return (
                    <path
                      key={previous + id}
                      className={critical ? 'is-critical' : 'has-float'}
                      markerEnd={`url(#${marker})`}
                      d={`M${x + 51} ${y} L${xx - 55} ${yy}`}
                    />
                  )
                }),
              )}
              {config.order.map((id) => {
                const [x, y] = positions[id]
                return (
                  <g
                    key={id}
                    className={result.rows[id].tf === 0 ? 'is-critical' : ''}
                  >
                    <rect
                      x={x - 50}
                      y={y - 24}
                      width="100"
                      height="48"
                      rx="10"
                    />
                    <text x={x} y={y + 7} textAnchor="middle">
                      {id} · {durations[id]}일
                    </text>
                  </g>
                )
              })}
            </svg>
            <figcaption>
              실선: 임계 연결 · 점선: 여유가 있는 연결. A 뒤에서 갈라지고 D
              앞에서 합쳐집니다.
            </figcaption>
          </figure>
          <ul className="pmp-float-paths">
            {result.paths.map((path) => (
              <li key={path.ids.join('')}>
                {path.ids.join(' → ')} = {path.days}일
              </li>
            ))}
          </ul>
          <div className="pmp-float-explanation">
            <h3>작업 C의 총여유·자유여유</h3>
            <p>
              총 여유 = LS {result.rows.C.ls} − ES {result.rows.C.es} ={' '}
              <strong>{result.rows.C.tf}일</strong>
            </p>
            <p>
              자유 여유 = E의 ES {result.rows.E.es} − C의 EF {result.rows.C.ef}{' '}
              = <strong>{result.rows.C.ff}일</strong>
            </p>
          </div>
          <div
            className="pmp-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="작업별 전진·후진 계산 결과"
          >
            <table>
              <caption>전진·후진 계산 · 모든 시점과 여유의 단위는 일</caption>
              <thead>
                <tr>
                  <th scope="col">작업</th>
                  {labels.map(([key, label]) => (
                    <th scope="col" key={key}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.order.map((id) => (
                  <tr key={id} data-float-row={id}>
                    <th scope="row">
                      {id}
                      {result.rows[id].tf === 0 ? ' · 임계' : ''}
                    </th>
                    {labels.map(([key]) => (
                      <td key={key} data-value={key}>
                        {result.rows[id][key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="pmp-float-formulas">
            <summary>계산식을 확인하려면</summary>
            <p>
              ES=max(선행 EF), EF=ES+기간 · LF=min(후속 LS), LS=LF−기간 ·
              TF=LS−ES · FF=min(후속 ES)−EF.
            </p>
            <p>
              끝 작업 D의 LF는 전체 조기 종료이며 FF도 이 종료를 기준으로
              계산합니다.
            </p>
          </details>
        </>
      )}
      <h3>작업 기간 변경과 여유시간 예측</h3>
      <ol>
        {config.guide.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <p>{config.limits}</p>
      <p className="study-meta">
        정의·계산 참고:{' '}
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          {source.title} ↗
        </a>{' '}
        · 2006년 자료 · 원문 확인 2026.10.28. 가상 예제와 그림은 자체
        제작했습니다.
      </p>
    </section>
  )
}
