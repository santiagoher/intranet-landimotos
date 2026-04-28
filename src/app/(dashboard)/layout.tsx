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
      <div className="min-h-screen bg-neutral-950 text-neutral-50 selection:bg-blue-500/30">
        <Sidebar rol={rol} modulosPermitidos={modulosPermitidos} />

        <div className="p-4 lg:ml-64 relative min-h-screen flex flex-col min-w-0 overflow-x-hidden">
          {/* Main bg glow decorative */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full mix-blend-screen filter blur-[120px] opacity-70 pointer-events-none z-0"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full mix-blend-screen filter blur-[120px] opacity-70 pointer-events-none z-0"></div>

          <Navbar userName={nombre} rol={rol} />

          <main className="flex-1 mt-6 relative z-10">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
