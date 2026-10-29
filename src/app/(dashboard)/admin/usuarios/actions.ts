'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getAuthUser, getProfile } from '@/utils/supabase/session.server'

const userUpdateSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rol: z.enum(['Admin', 'Operativo']),
  estado: z.enum(['activo', 'inactivo']),
  modulos_permitidos: z.array(z.string()).optional(),
})

// Server Actions can be invoked independently of the admin page or sidebar.
// Authorization comes only from the authenticated user's stored profile.
async function adminAccessError(): Promise<string | null> {
  const { data: { user }, error } = await getAuthUser()
  if (error || !user) return 'No se pudo verificar tu sesión.'
  const { data: profile, error: profileError } = await getProfile(user.id)
  if (profileError || !profile) return 'No se pudo verificar tu perfil.'
  if (profile.rol !== 'Admin' || profile.estado !== 'activo') return 'Se requiere un administrador activo.'
  return null
}

export async function getAllUsers() {
  const accessError = await adminAccessError()
  if (accessError) throw new Error(accessError)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function updateUserProfile(id: string, formData: unknown) {
  const accessError = await adminAccessError()
  if (accessError) return { error: accessError }
  if (!z.string().uuid().safeParse(id).success) return { error: 'Usuario no válido.' }
  
  const validatedFields = userUpdateSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('perfiles')
    .update(validatedFields.data)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  if (!data) return { error: 'No se actualizó el usuario. Verifica que exista y conserves los permisos.' }

  revalidatePath('/admin/usuarios')
  return { success: true }
}
