'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Package, 
  LayoutDashboard, 
  Users, 
  Truck, 
  Archive, 
  X,
  LogOut
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useSidebar } from './SidebarContext'

interface SidebarProps {
  rol: 'Admin' | 'Operativo'
  modulosPermitidos?: string[]
}

export function Sidebar({ rol, modulosPermitidos = [] }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isOpen, close } = useSidebar()

  const links = [
    { id: 'despachos', name: 'Despachos', href: '/despachos', icon: Package, roles: ['Admin', 'Operativo'] },
    { id: 'mensajeros', name: 'Mensajeros', href: '/mensajeros', icon: Truck, roles: ['Admin', 'Operativo'] },
    { id: 'admin-mensajeros', name: 'Conductores', href: '/admin/mensajeros', icon: Truck, roles: ['Admin'] },
    { id: 'usuarios', name: 'Usuarios', href: '/admin/usuarios', icon: Users, roles: ['Admin'] },
    { id: 'configuracion', name: 'Campos', href: '/admin/configuracion', icon: Archive, roles: ['Admin'] },
  ]

  const filteredLinks = links.filter(link => {
    const userRole = rol?.toLowerCase()
    if (userRole === 'admin') return true
    if (link.id === 'dashboard') return true
    return modulosPermitidos.includes(link.id)
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleLinkClick = () => {
    // Cierra el sidebar en móvil/tablet al navegar
    close()
  }

  return (
    <>
      {/* Overlay — solo visible en móvil/tablet cuando el sidebar está abierto */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 w-64 h-screen transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
      >
        <div className="h-full px-4 py-8 overflow-y-auto bg-neutral-900 border-r border-neutral-800 flex flex-col">
          
          {/* Logo Area */}
          <div className="flex items-center justify-between gap-3 mb-12 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Logística<span className="text-blue-500">Pro</span></h2>
                <p className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">{rol}</p>
              </div>
            </div>

            {/* Botón cerrar — solo en móvil/tablet */}
            <button
              onClick={close}
              className="lg:hidden p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <ul className="space-y-2 font-medium flex-1">
            {filteredLinks.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/')
              
              return (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    onClick={handleLinkClick}
                    className={`flex items-center p-3 rounded-xl transition-all group ${
                      isActive 
                        ? 'bg-blue-600/10 text-blue-500' 
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-blue-500' : 'text-neutral-500 group-hover:text-white'
                    }`} />
                    <span className="ms-3">{link.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Bottom Actions */}
          <div className="mt-auto pt-4 border-t border-neutral-800">
            <button 
              onClick={handleLogout}
              className="flex items-center w-full p-3 text-neutral-400 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all group"
            >
              <LogOut className="w-5 h-5 flex-shrink-0 text-neutral-500 group-hover:text-red-500 transition-colors" />
              <span className="ms-3">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
