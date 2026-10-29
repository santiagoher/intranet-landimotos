import { requireUser, getProfile } from '@/utils/supabase/session.server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { SidebarProvider, DashboardContent } from '@/components/layout/SidebarContext'
import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { RoleProvider } from '@/components/layout/RoleProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const { data: perfil, error } = await getProfile(user.id)
  if(error || !perfil) throw new Error('No se pudo consultar el perfil. Reintenta sin cerrar sesión.')
  if(perfil.estado === 'inactivo') redirect('/login?error=cuenta_desactivada')
  const rol = perfil.rol === 'Admin' ? 'Admin' : 'Operativo'
  const nombre = perfil?.nombre || user.email
  const modulosPermitidos = perfil?.modulos_permitidos || []
  const inventoryAccess = await getInventoryAccess()

  return (
    <RoleProvider value={{rol,modulosPermitidos}}><SidebarProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:p-3">Saltar al contenido</a>
        <Sidebar rol={rol} modulosPermitidos={modulosPermitidos} userName={nombre} email={user.email}
          inventoryNavigation={{ records: inventoryAccess.canEnter, reports: inventoryAccess.canViewReports, configuration: inventoryAccess.canConfigure }} />

        <DashboardContent>
          <Navbar />
          <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px]">
            {children}
          </main>
        </DashboardContent>
      </div>
    </SidebarProvider></RoleProvider>
  )
}
