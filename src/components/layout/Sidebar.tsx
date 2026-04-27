'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Package, 
  LayoutDashboard, 
  Users, 
  Truck, 
  Archive, 
  ShieldCheck,
  LogOut
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

interface SidebarProps {
  rol: 'Admin' | 'Operativo'
  modulosPermitidos?: string[]
}

export function Sidebar({ rol, modulosPermitidos = [] }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const links = [
    { id: 'dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['Admin', 'Operativo'] },
    { id: 'despachos', name: 'Despachos', href: '/despachos', icon: Package, roles: ['Admin', 'Operativo'] },
    { id: 'mensajeros', name: 'Mensajeros', href: '/mensajeros', icon: Truck, roles: ['Admin', 'Operativo'] },
    { id: 'inventarios', name: 'Inventarios', href: '/inventarios', icon: Archive, roles: ['Admin', 'Operativo'] },
    { id: 'usuarios', name: 'Usuarios', href: '/admin/usuarios', icon: Users, roles: ['Admin'] },
    { id: 'configuracion', name: 'Campos', href: '/admin/configuracion', icon: Archive, roles: ['Admin'] },
  ]

  const filteredLinks = links.filter(link => {
    // Normalizamos el rol para evitar errores de mayúsculas/minúsculas
    const userRole = rol?.toLowerCase()

    // 1. Si eres Admin, tienes acceso TOTAL a todo sin restricciones
    if (userRole === 'admin') return true

    // 2. Si no eres admin (ej. Operativo):
    // El Dashboard siempre es visible
    if (link.id === 'dashboard') return true

    // Acceso restringido por módulos permitidos
    return modulosPermitidos.includes(link.id)
  })

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0">
      <div className="h-full px-4 py-8 overflow-y-auto bg-neutral-900 border-r border-neutral-800 flex flex-col">
        
        {/* Logo Area */}
        <div className="flex items-center gap-3 mb-12 px-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Logística<span className="text-blue-500">Pro</span></h1>
            <p className="text-[10px] text-neutral-400 font-medium tracking-wider uppercase">{rol}</p>
          </div>
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
  )
}
