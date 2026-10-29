'use client'

import { PanelLeftOpen } from 'lucide-react'
import { useSidebar } from './SidebarContext'

// The external trigger is shown only while the corresponding sidebar is hidden.
export function Navbar() {
  const { toggle, isOpen, desktopHidden, toggleDesktop } = useSidebar()
  return (
    <div className={`mb-5 items-center gap-2 ${isOpen?'hidden':'flex'} ${desktopHidden?'lg:flex':'lg:hidden'}`}>
      <button id="sidebar-trigger" onClick={toggle} className="icon-button -ml-2 lg:hidden" aria-label="Mostrar menú lateral" title="Mostrar menú lateral" aria-controls="app-sidebar" aria-expanded={isOpen}>
        <PanelLeftOpen className="size-5" aria-hidden="true" />
      </button>
      <button id="sidebar-desktop-trigger" onClick={()=>{toggleDesktop();requestAnimationFrame(()=>document.getElementById('sidebar-desktop-close')?.focus())}} className="icon-button hidden lg:inline-flex" aria-label="Mostrar menú lateral" title="Mostrar menú lateral" aria-controls="app-sidebar" aria-expanded={!desktopHidden}>
        <PanelLeftOpen className="size-5" aria-hidden="true"/>
      </button>
      <span className="text-sm font-medium lg:hidden">Landimotos</span>
    </div>
  )
}
