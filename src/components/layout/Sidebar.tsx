'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Package, Users, Truck, Archive, X, ClipboardCheck, MessageSquare, Warehouse, SlidersHorizontal, PanelLeftClose } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useSidebar } from './SidebarContext'
import { UserMenu } from './UserMenu'
import { SidebarNavigation } from './SidebarNavigation'

interface SidebarProps {
  rol: 'Admin' | 'Operativo'
  modulosPermitidos?: string[]
  userName?: string
  email?: string
  inventoryNavigation?: { records: boolean; reports: boolean; configuration: boolean }
}

export function Sidebar({ rol, modulosPermitidos = [], userName, email, inventoryNavigation }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { isOpen, close, desktopHidden, toggleDesktop } = useSidebar()
  const sidebarRef = useRef<HTMLElement>(null)

  const links = [
    { id: 'despachos', name: 'Despachos', href: '/despachos', icon: Package, roles: ['Admin', 'Operativo'] },
    { id: 'mensajeros', name: 'Mensajeros', href: '/mensajeros', icon: Truck, roles: ['Admin', 'Operativo'] },
    { id: 'inventarios', name: 'Inventarios', href: '/inventarios', icon: Warehouse, roles: ['Admin', 'Operativo'] },
    { id: 'vehiculos', name: 'Inspecciones Preoperacionales', href: '/vehiculos', icon: ClipboardCheck, roles: ['Admin', 'Operativo'] },
    { id: 'atencion', name: 'Atención al Cliente', href: '/admin/atencion', icon: MessageSquare, roles: ['Admin'] },
    { id: 'admin-mensajeros', name: 'Conductores', href: '/admin/mensajeros', icon: Truck, roles: ['Admin'] },
    { id: 'usuarios', name: 'Usuarios', href: '/admin/usuarios', icon: Users, roles: ['Admin'] },
    { id: 'configuracion', name: 'Campos', href: '/admin/configuracion', icon: Archive, roles: ['Admin'] },
    { id: 'inventario-configuracion', name: 'Inventarios', href: '/admin/inventarios', icon: SlidersHorizontal, roles: ['Admin', 'Operativo'] },
  ]

  const filteredLinks = links.filter(link => {
    if (link.id === 'inventarios') return inventoryNavigation?.records === true
    if (link.id === 'inventario-configuracion') return inventoryNavigation?.configuration === true
    const userRole = rol?.toLowerCase()
    if (userRole === 'admin') return true
    if (link.id === 'dashboard') return true
    return modulosPermitidos.includes(link.id)
  })

  const handleLogout = async () => {
    const {error} = await supabase.auth.signOut({scope:'local'})
    if(error) throw new Error('No se pudo cerrar la sesión. Intenta nuevamente.')
    router.replace('/login')
    router.refresh()
  }

  useEffect(() => {
    if (!isOpen) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    if (desktop.matches) return
    const previousFocus = document.activeElement as HTMLElement | null
    const content = document.getElementById('dashboard-content')
    const previousOverflow = document.body.style.overflow
    if (content) content.inert = true
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close() }
      if (event.key !== 'Tab') return
      const elements = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length > 0 && !el.closest('[inert]'))
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    function onResize() { if (desktop.matches) close() }
    document.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onResize)
    return () => {
      if (content) content.inert = false
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onResize)
      if (!desktop.matches) previousFocus?.focus()
    }
  }, [isOpen, close])

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-black/35 lg:hidden" onClick={close} aria-hidden="true" />}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        aria-label="Navegación de Landimotos"
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 flex-col border-r border-border bg-sidebar transition-[transform,visibility] duration-200 motion-reduce:transition-none ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'} ${desktopHidden?'lg:invisible lg:-translate-x-full':'lg:visible lg:translate-x-0'}`}>
        <div className="flex shrink-0 items-center gap-3 px-5 py-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent">
            <Package className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight">Landimotos</p>
            <p className="mt-0.5 text-xs text-muted">Operativo</p>
          </div>
          <button onClick={close} className="icon-button lg:hidden" aria-label="Cerrar menú">
            <X className="size-5" />
          </button>
          <button id="sidebar-desktop-close" onClick={()=>{toggleDesktop();requestAnimationFrame(()=>document.getElementById('sidebar-desktop-trigger')?.focus())}} className="icon-button hidden lg:inline-flex" aria-label="Ocultar menú lateral" title="Ocultar menú lateral" aria-controls="app-sidebar" aria-expanded={!desktopHidden}>
            <PanelLeftClose className="size-5" aria-hidden="true"/>
          </button>
        </div>

        <SidebarNavigation links={filteredLinks} isAdmin={rol?.toLowerCase() === 'admin'} pathname={pathname} onNavigate={close}
          inventoryReports={inventoryNavigation?.reports === true} />

        <div className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <UserMenu userName={userName} email={email} rol={rol} onLogout={handleLogout} />
        </div>
      </aside>
    </>
  )
}
