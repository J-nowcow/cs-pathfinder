import type { Cell } from '@/lib/certificate/course'
export function CertificateTable({
  headers,
  rows,
  caption,
}: {
  headers: string[]
  rows: Cell[][]
  caption: string
}) {
  return (
    <div className="pmp-table-scroll">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((v, j) => (
                <td key={j}>
                  {v === null ? (
                    <span className="certificate-null">NULL</span>
                  ) : (
                    v
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
