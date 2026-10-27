export type FloatNetwork = {
  order: string[]
  predecessors: Record<string, string[]>
  paths: string[][]
}
export type FloatConfig = FloatNetwork & {
  defaults: Record<string, number>
  presets: { id: string; label: string; durations: Record<string, number> }[]
  assumptions: string
  guide: string[]
  limits: string
}
export type FloatRow = {
  duration: number
  es: number
  ef: number
  ls: number
  lf: number
  tf: number
  ff: number
}

export function parseFloatDuration(value: string): number | null {
  if (!/^\d{1,3}$/.test(value.trim())) return null
  const number = Number(value)
  return number >= 1 && number <= 100 ? number : null
}

/** Authored topological FS network; no calendars, lags, resources or deadlines. */
export function calculateFloat(
  network: FloatNetwork,
  durations: Readonly<Record<string, number>>,
) {
  if (
    !network.order.every(
      (id) =>
        Number.isInteger(durations[id]) &&
        durations[id] >= 1 &&
        durations[id] <= 100,
    )
  )
    return null
  const rows: Record<string, FloatRow> = {}
  const successors = Object.fromEntries(
    network.order.map((id) => [id, [] as string[]]),
  )
  for (const id of network.order) {
    const before = network.predecessors[id]
    for (const previous of before) successors[previous].push(id)
    const es = Math.max(0, ...before.map((previous) => rows[previous].ef))
    rows[id] = {
      duration: durations[id],
      es,
      ef: es + durations[id],
      ls: 0,
      lf: 0,
      tf: 0,
      ff: 0,
    }
  }
  const total = Math.max(...Object.values(rows).map((row) => row.ef))
  for (const id of [...network.order].reverse()) {
    const row = rows[id],
      after = successors[id]
    row.lf = after.length
      ? Math.min(...after.map((next) => rows[next].ls))
      : total
    row.ls = row.lf - row.duration
    row.tf = row.ls - row.es
    row.ff =
      (after.length ? Math.min(...after.map((next) => rows[next].es)) : total) -
      row.ef
  }
  const paths = network.paths.map((ids) => ({
    ids,
    days: ids.reduce((sum, id) => sum + durations[id], 0),
  }))
  return {
    rows,
    total,
    paths,
    critical: paths.filter((path) => path.days === total),
  }
}
