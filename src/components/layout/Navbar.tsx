'use client'

import { Menu } from 'lucide-react'
import { useSidebar } from './SidebarContext'

interface NavbarProps {
  userName?: string
  rol?: string
}

export function Navbar({ userName, rol }: NavbarProps) {
  const { toggle } = useSidebar()

  return (
    <nav className="sticky top-0 z-30 w-full bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800">
      <div className="px-4 py-3 lg:px-8">
        <div className="flex items-center justify-between">
          
          <div className="flex items-center justify-start">
            {/* Botón hamburguesa — visible en móvil y tablet, oculto en desktop */}
            <button
              onClick={toggle}
              className="p-2 text-neutral-400 rounded-lg lg:hidden hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-colors"
              aria-label="Abrir menú"
            >
              <span className="sr-only">Abrir menú</span>
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-white">{userName || 'Usuario'}</p>
                <p className="text-xs text-neutral-400">{rol || 'Desconocido'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </nav>
  )
}
