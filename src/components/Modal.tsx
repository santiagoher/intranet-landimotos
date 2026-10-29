'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Native modal semantics provide focus containment, Escape handling and focus return.
export function Modal({ children, onClose, titleId, size = 'large' }: {
  children: ReactNode
  onClose: () => void
  titleId: string
  size?: 'small' | 'medium' | 'large'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.showModal()
    return () => {
      dialog?.close()
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose() }}
    className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40 ${size === 'small' ? 'max-w-md' : size === 'medium' ? 'max-w-xl' : 'max-w-2xl'}`}>
    {children}
  </dialog>
}