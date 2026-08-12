'use client'

import { useState } from 'react'
import type { Cell } from '@/lib/streak/grass'
import {
  GRASS_IMAGE_TITLE,
  drawGrassImage,
  grassImageSize,
  type GrassImageStats,
} from '@/lib/streak/grass-image'

/**
 * 잔디를 그림으로 내보낸다.
 *
 * 자랑은 카톡에서 일어난다. 링크를 주면 받은 사람이 열어야 하고, 열어도
 * 기록이 브라우저에 있으니 **자기 잔디**가 뜬다. 그림이면 그냥 보인다.
 *
 * 길이 둘이다. 폰에는 OS 공유 시트로 파일을 바로 넘기고(카톡이 목적지라
 * 이게 제일 짧다), 데스크톱처럼 파일 공유를 못 받는 곳에서는 내려받는다.
 * `navigator.share`가 있어도 파일은 못 받는 브라우저가 있어서 `canShare`로
 * **파일을 넣어 물어본 뒤** 갈라진다.
 *
 * 어떤 경우에도 던지지 않는다. 여기서 터지면 내 기록 화면 전체가 사라진다.
 */
type Phase = { kind: 'idle' } | { kind: 'creating' } | { kind: 'failed'; message: string }

const FILE_NAME = 'cs-길라잡이-학습기록.png'
const FAILED = '그림을 만들지 못했습니다. 잠시 뒤에 다시 시도해 주세요.'

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  a.click()
  /*
   * 바로 거두면 다운로드가 시작되기 전에 주소가 사라지는 브라우저가 있다.
   * 잠깐 두었다 거둔다 — 안 거두면 탭이 닫힐 때까지 메모리에 남는다.
   */
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function GrassShare({
  weeks,
  stats,
}: {
  weeks: Array<Array<Cell | null>>
  stats: GrassImageStats
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const run = async () => {
    setPhase({ kind: 'creating' })
    try {
      const { width, height } = grassImageSize(weeks)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setPhase({ kind: 'failed', message: FAILED })
        return
      }
      drawGrassImage(ctx, weeks, stats)

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png')
      })
      if (!blob) {
        setPhase({ kind: 'failed', message: FAILED })
        return
      }

      const file = new File([blob], FILE_NAME, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] }) && typeof navigator.share === 'function') {
        try {
          await navigator.share({ files: [file], title: GRASS_IMAGE_TITLE })
        } catch {
          /*
           * 대개 사용자가 시트를 닫은 것이다. 닫았는데 파일이 내려받아지면
           * 취소가 취소가 아니게 된다. 조용히 돌아간다.
           */
        }
        setPhase({ kind: 'idle' })
        return
      }

      download(blob)
      setPhase({ kind: 'idle' })
    } catch {
      setPhase({ kind: 'failed', message: FAILED })
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={phase.kind === 'creating'}
        aria-busy={phase.kind === 'creating' || undefined}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-line bg-raised px-4 text-[14px] font-medium text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          phase.kind === 'creating'
            ? 'cursor-wait disabled:opacity-100'
            : 'disabled:opacity-60'
        }`}
      >
        {phase.kind === 'creating' && (
          <span
            aria-hidden
            className="size-3.5 animate-spin rounded-full border-2 border-ink/25 border-t-ink"
          />
        )}
        {phase.kind === 'creating' ? '만드는 중' : '이미지로 공유'}
      </button>

      {phase.kind === 'failed' && (
        <p
          role="status"
          className="mt-2 rounded-md border border-warn/30 bg-warn-soft px-3 py-2.5 text-[13px] leading-[1.6] text-ink"
        >
          {phase.message}
        </p>
      )}
    </div>
  )
}
