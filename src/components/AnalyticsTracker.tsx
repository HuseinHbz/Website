'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function AnalyticsTracker({ locale }: { locale: string }) {
  const pathname = usePathname()
  const sessionId = useRef<string>('')

  useEffect(() => {
    if (!sessionId.current) {
      sessionId.current = Math.random().toString(36).slice(2)
    }
  }, [])

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pageview', page: pathname, locale, sessionId: sessionId.current }),
    }).catch(() => {})
  }, [pathname, locale])

  return null
}
