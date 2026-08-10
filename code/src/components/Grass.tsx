'use client'

import { useState } from 'react'
import type { Cell } from '@/lib/streak/grass'

/**
 * 잔디.
 *
 * 한 칸이 하루고 세로가 요일이다. 색만으로 뜻을 전하는 그림이라 **낭독기가
 * 읽을 문장을 반드시 함께 둔다.** 색맹인 사람에게도 그 문장이 본문이다.
 *
 * 칸을 누르면 그 날짜와 편수를 잔디 아래 한 줄로 보여준다. title 속성은
 * 마우스 호버에서만 뜨고 **폰 터치에서는 아무것도 안 뜬다** — 그래서
 * 누르는 길을 따로 둔다. 같은 칸을 다시 누르면 닫힌다.
 *
 * 칸은 button이지만 tabIndex -1로 키보드 순회에서 뺀다. 격자가 aria-hidden
 * (낭독기에는 아래 문장이 본문)인데 포커스가 들어가면 낭독기 사용자가
 * 아무것도 안 읽히는 곳에 갇힌다. 날짜별 숫자는 눈으로 고르는 부가 정보다.
 *
 * SVG 문자열을 넣지 않는다. 칸은 그냥 사각형이라 요소로 그려도 똑같고,
 * 문자열을 넣는 길은 열어 둘 이유가 없다.
 *
 * 색은 `--color-accent`를 바탕색에 섞어 만든다. 단계마다 새 토큰을 만들면
 * 두 벌(밝은/어두운 테마)을 손으로 맞춰야 하는데, 섞으면 저절로 따라간다.
 */
const MIX: Record<Cell['level'], number> = { 0: 0, 1: 28, 2: 50, 3: 74, 4: 100 }

function colorOf(level: Cell['level']): string {
  if (level === 0) return 'var(--color-line)'
  return `color-mix(in oklab, var(--color-accent) ${MIX[level]}%, var(--color-raised))`
}

/** '2026-08-09' → '2026년 8월 9일'. 잔디 아래 한 줄에 쓴다 */
function readableDay(day: string): string {
  const [y, m, d] = day.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

export function Grass({
  weeks,
  summary,
}: {
  weeks: Array<Array<Cell | null>>
  summary: string
}) {
  const [picked, setPicked] = useState<Cell | null>(null)

  return (
    <figure className="m-0">
      {/*
        가로로 넘칠 수 있다. 폰에서 26주면 칸이 3px가 되어 아무것도 안 보이므로
        칸 크기를 지키고 이 상자만 옆으로 굴린다. 몸통은 절대 안 굴린다.
      */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]" aria-hidden="true">
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {week.map((cell, d) =>
                cell === null ? (
                  <div key={d} className="h-[11px] w-[11px]" />
                ) : (
                  <button
                    key={d}
                    type="button"
                    tabIndex={-1}
                    onClick={() => setPicked((p) => (p?.day === cell.day ? null : cell))}
                    className="h-[11px] w-[11px] cursor-pointer rounded-[2px] border-0 p-0"
                    style={{
                      background: colorOf(cell.level),
                      // 고른 칸이 어딘지 보여야 아래 문장과 이어진다
                      outline: picked?.day === cell.day ? '2px solid var(--color-accent)' : 'none',
                      outlineOffset: '1px',
                    }}
                    title={`${cell.day} · ${cell.count}편`}
                  />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      {picked && (
        <p className="mt-2 text-sm">
          <span className="font-medium">{readableDay(picked.day)}</span> —{' '}
          {picked.count === 0 ? '판 질문이 없습니다.' : `${picked.count}편 팠습니다.`}
        </p>
      )}
      <figcaption className="mt-2 text-sm text-muted">{summary}</figcaption>
    </figure>
  )
}
