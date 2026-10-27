import { certificateCoverageEdges } from '@/lib/certificate/testing-graph'

export function CertificateCoverageGraph() {
  return (
    <figure className="certificate-coverage-figure">
      <figcaption>분모를 먼저 정한 창작 제어흐름 · 간선 6개</figcaption>
      <div className="certificate-coverage-scroll">
        <svg
          viewBox="0 0 780 300"
          role="img"
          aria-labelledby="certificate-graph-title certificate-graph-description"
        >
          <title id="certificate-graph-title">
            같은 반환 지점으로 모이는 참·거짓 경로
          </title>
          <desc id="certificate-graph-description">
            시작에서 S1과 D1을 지난다. 참이면 S2 뒤 S3으로, 거짓이면 바로 S3으로
            간다. S3 뒤 종료한다. 여섯 간선 중 참 경로는 e1·e2·e3·e5·e6이며 거짓
            경로는 e1·e2·e4·e6이다.
          </desc>
          <defs>
            <marker
              id="certificate-coverage-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0 0L8 4L0 8Z" fill="currentColor" />
            </marker>
          </defs>
          {certificateCoverageEdges.map((edge) => (
            <g key={edge.id}>
              <path
                className="certificate-coverage-edge"
                d={edge.d}
                markerEnd="url(#certificate-coverage-arrow)"
              />
              <text
                className="certificate-coverage-edge-label"
                x={edge.x}
                y={edge.y}
                textAnchor="middle"
              >
                {edge.label}
              </text>
            </g>
          ))}
          <g className="certificate-coverage-node">
            <rect x="20" y="135" width="70" height="50" rx="20" />
            <text x="55" y="167">
              시작
            </text>
            <rect x="120" y="135" width="110" height="50" rx="8" />
            <text x="175" y="167">
              S1 · 7
            </text>
            <polygon points="290,120 340,160 290,200 240,160" />
            <text x="290" y="167">
              D1
            </text>
            <rect x="390" y="55" width="110" height="45" rx="8" />
            <text x="445" y="85">
              S2 · 21
            </text>
            <rect x="560" y="135" width="100" height="50" rx="8" />
            <text x="610" y="167">
              S3 반환
            </text>
            <rect x="690" y="135" width="70" height="50" rx="20" />
            <text x="725" y="167">
              종료
            </text>
          </g>
        </svg>
      </div>
      <p>
        무조건 흐름도 간선으로 셉니다. D1의 두 결과만 세는 비율과 분모가
        다릅니다.
      </p>
    </figure>
  )
}
