'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
import { useNavigationHash } from './useNavigationHash'

// Role checks may finish after the browser's initial fragment scroll. Retry when
// the real section mounts, without changing the page's loading or data logic.
export function NavigationSection({ id, children, ...props }: ComponentProps<'section'> & { id: string }) {
  const ref = useRef<HTMLElement>(null)
  const hash = useNavigationHash()
  useEffect(() => {
    if (hash === `#${id}`) ref.current?.scrollIntoView({ block: 'start' })
  }, [hash, id])
  return <section {...props} id={id} ref={ref} tabIndex={-1}>{children}</section>
}

