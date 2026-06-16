import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, modulos_permitidos')
    .eq('id', user.id)
    .single()

  const rol = perfil?.rol || 'Operativo'
  const modulosPermitidos = perfil?.modulos_permitidos || []

  if (rol === 'Admin') {
    redirect('/despachos')
    return
  }

  // Redireccionar al primer módulo que tenga permitido
  if (modulosPermitidos.includes('despachos')) {
    redirect('/despachos')
  } else if (modulosPermitidos.includes('mensajeros')) {
    redirect('/mensajeros')
  } else {
    // Si no tiene despachos ni mensajeros, redirige a vehículos (módulo general para operativos)
    redirect('/vehiculos')
  }
}
