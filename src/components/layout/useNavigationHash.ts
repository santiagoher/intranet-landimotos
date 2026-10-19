'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'

const navigationEvent = 'landimotos-navigation'

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback)
  window.addEventListener('popstate', callback)
  window.addEventListener(navigationEvent, callback)
  return () => {
    window.removeEventListener('hashchange', callback)
    window.removeEventListener('popstate', callback)
    window.removeEventListener(navigationEvent, callback)
  }
}

function getHash() { return window.location.hash }
function getServerHash() { return '' }

export function useNavigationHash() {
  return useSyncExternalStore(subscribe, getHash, getServerHash)
}

// The existing report dialog can also be opened directly from navigation.
// Preserve Next's history state and any existing query parameters.
export function useReportDialog(): [boolean, (open: boolean) => void] {
  const hash = useNavigationHash()
  const pathname = usePathname()
  function setOpen(open: boolean) {
    const url = new URL(window.location.href)
    if (url.pathname !== pathname || (!open && url.hash !== '#reportes') || (open && url.hash === '#reportes')) return
    url.hash = open ? 'reportes' : ''
    if (open) window.history.pushState(window.history.state, '', url)
    else window.history.replaceState(window.history.state, '', url)
    window.dispatchEvent(new Event(navigationEvent))
  }
  return [hash === '#reportes', setOpen]
}
