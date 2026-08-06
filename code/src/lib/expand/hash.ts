import { createHash } from 'node:crypto'

const ZERO_WIDTH = /[​-‏﻿]/g

/**
 * 해시 직전 최소 정규화.
 *
 * 표현 차이를 흡수하는 일은 정규화 게이트(LLM)가 맡는다.
 * 여기서는 눈에 보이지 않는 차이만 제거한다.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function questionHash(scope: string, normalizedQuestion: string): string {
  const payload = `${normalizeText(scope)}\n${normalizeText(normalizedQuestion)}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}
