'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const storageKey = 'landimotos-theme'

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0f11' : '#ffffff')
}

function subscribe(callback: () => void) {
  function syncStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return
    applyTheme(event.newValue === 'dark' ? 'dark' : 'light')
    callback()
  }
  window.addEventListener('storage', syncStorage)
  window.addEventListener('landimotos-theme-change', callback)
  return () => {
    window.removeEventListener('storage', syncStorage)
    window.removeEventListener('landimotos-theme-change', callback)
  }
}

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function getServerSnapshot(): Theme { return 'light' }

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function setTheme(value: Theme) {
    applyTheme(value)
    try { localStorage.setItem(storageKey, value) } catch { /* Still works for this session. */ }
    window.dispatchEvent(new Event('landimotos-theme-change'))
  }

  return { theme, setTheme }
}

// Canvas charts need resolved colors; CSS variables work directly in SVG charts.
export function useChartColors() {
  useTheme()
  const styles = typeof window === 'undefined' ? null : getComputedStyle(document.documentElement)
  return {
    text: styles?.getPropertyValue('--foreground').trim() || '#18181b',
    muted: styles?.getPropertyValue('--muted-foreground').trim() || '#686873',
    border: styles?.getPropertyValue('--border').trim() || '#e9eaec',
    surface: styles?.getPropertyValue('--surface').trim() || '#ffffff',
  }
}
