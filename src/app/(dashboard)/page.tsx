import { requireUser, getProfile } from '@/utils/supabase/session.server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await requireUser()
  const { data: perfil, error } = await getProfile(user.id)
  if(error || !perfil) throw new Error('No se pudo consultar el perfil. Intenta de nuevo.')

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
  } else if (modulosPermitidos.includes('inventarios') && !modulosPermitidos.includes('vehiculos')) {
    redirect('/inventarios/registros')
  } else {
    // Si no tiene despachos ni mensajeros, redirige a vehículos (módulo general para operativos)
    redirect('/vehiculos')
  }
}
