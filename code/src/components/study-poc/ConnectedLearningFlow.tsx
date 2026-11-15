'use client'
import { useEffect, useRef, useState } from 'react'
import { ConnectionIntro } from './ConnectionIntro'
import { TransactionLesson } from './TransactionLesson'

export function ConnectedLearningFlow({ onExperiment, experimentDisabled = false }: { onExperiment?: () => void; experimentDisabled?: boolean }) {
  const [part, setPart] = useState<'connection' | 'transaction'>('connection')
  const container = useRef<HTMLDivElement>(null)
  const previous = useRef(part)
  useEffect(() => { if (previous.current !== part) container.current?.querySelector<HTMLHeadingElement>('h2')?.focus(); previous.current = part }, [part])
  return <div ref={container}>{part === 'connection'
    ? <ConnectionIntro connected onContinue={() => setPart('transaction')} />
    : <TransactionLesson onBack={() => setPart('connection')} onExperiment={onExperiment} experimentDisabled={experimentDisabled} />}</div>
}
