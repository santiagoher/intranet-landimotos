'use client'

import { useEffect } from 'react'
import { useTheme } from './useTheme'

export function ThemeSync() {
  const { theme } = useTheme()
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0f11' : '#ffffff')
  }, [theme])
  return null
}
