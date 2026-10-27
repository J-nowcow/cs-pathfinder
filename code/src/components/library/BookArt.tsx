export function BookArt({
  kind,
}: {
  kind: 'cs' | 'pmp' | 'jira' | 'engineer' | 'certificate'
}) {
  return (
    <svg
      className="book-cover-art"
      viewBox="0 0 180 100"
      fill="none"
      aria-hidden="true"
    >
      {kind === 'cs' && (
        <g stroke="currentColor" strokeWidth="1.8">
          <path
            d="M30 27h38l28 46h52M68 27l28 46M68 27l39-10 41 33M96 73l52-23"
            opacity=".6"
          />
          <circle cx="30" cy="27" r="9" fill="var(--book-paper)" />
          <circle cx="68" cy="27" r="9" fill="var(--book-paper)" />
          <circle cx="96" cy="73" r="9" fill="var(--book-paper)" />
          <circle cx="148" cy="50" r="9" fill="var(--book-paper)" />
          <circle cx="148" cy="73" r="4" fill="currentColor" />
          <circle cx="107" cy="17" r="4" fill="currentColor" />
        </g>
      )}
      {kind === 'pmp' && (
        <g stroke="currentColor" strokeWidth="1.8">
          <path d="M18 79h35V55h40V33h47V14" opacity=".7" />
          <path d="M140 14h27l-8 10 8 10h-27Z" fill="var(--book-paper)" />
          <circle cx="53" cy="55" r="7" fill="var(--book-paper)" />
          <circle cx="93" cy="33" r="7" fill="var(--book-paper)" />
          <path d="m49 55 3 3 5-6m32-19 3 3 5-6" />
          <path d="M18 91h149" opacity=".25" />
        </g>
      )}
      {kind === 'jira' && (
        <g stroke="currentColor" strokeWidth="1.6">
          {[20, 74, 128].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="10"
                width="40"
                height="79"
                rx="4"
                fill="var(--book-paper)"
              />
              <path d={`M${x + 9} 23h22`} opacity=".5" />
              <rect
                x={x + 8}
                y={35 + i * 9}
                width="24"
                height="18"
                rx="2"
                fill="currentColor"
                opacity=".15"
              />
              <path d={`M${x + 13} ${43 + i * 9}h14`} opacity=".7" />
            </g>
          ))}
          <path d="m63 55 5 4-5 4m53-8 5 4-5 4" />
        </g>
      )}
      {kind === 'certificate' && (
        <g stroke="currentColor" strokeWidth="1.7">
          <ellipse cx="75" cy="21" rx="43" ry="12" fill="var(--book-paper)" />
          <path d="M32 21v47c0 16 86 16 86 0V21M32 44c0 16 86 16 86 0" />
          <path d="m121 66 12 12 26-33" strokeWidth="3" />
          <path d="M49 25h17m-17 23h17m-17 23h17" opacity=".6" />
        </g>
      )}
      {kind === 'engineer' && (
        <g stroke="currentColor" strokeWidth="1.7">
          <path d="M47 10h70l18 18v61H47Z" fill="var(--book-paper)" />
          <path
            d="M117 10v18h18M61 35h41M61 48h60M61 60h60M61 72h39"
            opacity=".6"
          />
          <path d="m119 75 27-34 8 7-27 34-12 4Z" fill="var(--book-paper)" />
          <path d="m141 47 8 7M119 75l8 7" />
        </g>
      )}
    </svg>
  )
}
export function OpenBookArt() {
  return (
    <div className="desk-open-book" aria-hidden="true">
      <svg viewBox="0 0 220 180" fill="none">
        <ellipse
          cx="112"
          cy="151"
          rx="80"
          ry="10"
          fill="currentColor"
          opacity=".07"
        />
        <path
          d="M24 46c31-6 57-2 86 13 29-15 55-19 86-13v99c-31-4-57 0-86 13-29-13-55-17-86-13Z"
          fill="#e8d6bd"
          stroke="#c3ad90"
          strokeWidth="1.4"
        />
        <path
          d="M30 38c27-4 54 1 80 17 26-16 53-21 80-17v98c-28-4-55 2-80 16-25-14-52-20-80-16Z"
          fill="var(--book-open-paper)"
          stroke="#c3ad90"
          strokeWidth="1.4"
        />
        <path d="M110 55v97" stroke="#d8c6ac" />
        <path d="M141 35v38l10-7 10 7V32" fill="#c96b48" />
        <g
          stroke="#a99b84"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity=".65"
        >
          <path d="m47 65 43 10m-43 8 43 10m-43 8 43 10m-43 8 27 6m55-41 42-9m-42 27 42-9m-42 27 31-7" />
        </g>
        <path
          d="m17 23 3-7m-10 14-7-2m197 0 6-5m-4 18 9 1"
          stroke="#c18a55"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
