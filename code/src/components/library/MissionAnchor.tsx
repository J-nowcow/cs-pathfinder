'use client'
import { useEffect } from 'react'
export function MissionAnchor() {
  useEffect(() => {
    const open = () => {
      const id = location.hash.slice(1)
      const e = document.getElementById(id)
      if (e instanceof HTMLDetailsElement) {
        e.open = true
        e.scrollIntoView({ block: 'start' })
      }
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  return null
}
