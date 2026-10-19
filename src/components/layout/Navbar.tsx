'use client'

import { Menu } from 'lucide-react'
import { useSidebar } from './SidebarContext'

// Only the compact mobile menu trigger remains; desktop has no top navigation bar.
export function Navbar() {
  const { toggle, isOpen } = useSidebar()
  return (
    <div className="mb-5 flex items-center gap-2 lg:hidden">
      <button id="sidebar-trigger" onClick={toggle} className="icon-button -ml-2" aria-label="Abrir menú" aria-controls="app-sidebar" aria-expanded={isOpen}>
        <Menu className="size-5" />
      </button>
      <span className="text-sm font-medium">Landimotos <span className="ml-1 font-normal text-muted">/ Operativo</span></span>
    </div>
  )
}
