import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Navbar } from '@/components/layout/Navbar'
import { SidebarProvider } from '@/components/layout/SidebarContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile securely on server
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, modulos_permitidos')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol || 'Operativo'
  const nombre = perfil?.nombre || user.email
  const modulosPermitidos = perfil?.modulos_permitidos || []

  return (
    <SidebarProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:p-3">Saltar al contenido</a>
        <Sidebar rol={rol} modulosPermitidos={modulosPermitidos} userName={nombre} email={user.email} />

        <div id="dashboard-content" className="min-w-0 px-4 py-4 sm:px-6 lg:ml-64 lg:px-8 lg:py-8 xl:px-10">
          <Navbar />
          <main id="main-content" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
