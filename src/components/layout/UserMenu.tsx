'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme/useTheme'

interface UserMenuProps {
  userName?: string
  email?: string
  rol: string
  onLogout: () => Promise<void>
}

export function UserMenu({ userName, email, rol, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { theme, setTheme } = useTheme()
  const name = userName || email || 'Usuario'

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  return (
    <div ref={containerRef} className="relative" onKeyDown={event => {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
    }}>
      <button ref={triggerRef} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="user-preferences"
        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${open ? 'bg-active' : 'hover:bg-hover'}`}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-sm font-medium" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium" title={name}>{name}</span>
          <span className="mt-0.5 block text-[11px] text-muted">{rol}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open && (
        <section id="user-preferences" aria-label="Cuenta y apariencia" className="absolute bottom-full left-0 z-50 mb-3 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-lg max-h-[calc(100dvh-100px)]">
          <div className="border-b border-border px-3 py-3">
            <p className="text-[11px] text-muted">Mi cuenta</p>
            <p className="mt-1 break-words text-sm font-medium">{name}</p>
            {email && <p className="mt-1 break-all text-xs text-muted">{email}</p>}
            <p className="mt-1 text-xs text-muted">{rol}</p>
          </div>
          <div className="px-3 py-3">
            <p id="appearance-label" className="mb-2 text-xs font-medium text-secondary">Apariencia</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1" role="group" aria-labelledby="appearance-label">
              {([{ value: 'light', label: 'Claro', icon: Sun }, { value: 'dark', label: 'Oscuro', icon: Moon }] as const).map(option => {
                const Icon = option.icon
                return <button key={option.value} onClick={() => setTheme(option.value)} aria-pressed={theme === option.value}
                  className={`flex min-h-9 items-center justify-center gap-1.5 rounded-md text-xs transition-colors ${theme === option.value ? 'bg-surface text-foreground shadow-sm ring-1 ring-border' : 'text-muted hover:text-foreground'}`}>
                  <Icon className="size-3.5" aria-hidden="true" />{option.label}
                </button>
              })}
            </div>
          </div>
          <div className="border-t border-border pt-1.5">
            <button onClick={onLogout} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-xs text-danger hover:bg-danger-soft">
              <LogOut className="size-4" aria-hidden="true" />Cerrar sesión
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
