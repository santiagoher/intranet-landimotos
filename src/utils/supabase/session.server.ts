import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './server'
import { invalidSession } from './auth-errors'

// Request-local only: no authorization or user data is cached across requests.
export const getAuthUser = cache(async () => (await createClient()).auth.getUser())
export const getProfile = cache(async (id: string) => (await createClient()).from('perfiles')
  .select('nombre, rol, estado, modulos_permitidos').eq('id',id).single())
export const requireUser = cache(async () => {
  const { data: { user }, error } = await getAuthUser()
  if (error) {
    if (invalidSession(error)) redirect('/login')
    throw new Error('No se pudo verificar la sesión temporalmente. Intenta de nuevo.')
  }
  if (!user) redirect('/login')
  return user
})
