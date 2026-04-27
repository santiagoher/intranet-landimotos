'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const userUpdateSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rol: z.enum(['Admin', 'Operativo']),
  estado: z.enum(['activo', 'inactivo']),
  modulos_permitidos: z.array(z.string()).optional(),
})

export async function getAllUsers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function updateUserProfile(id: string, formData: any) {
  const supabase = await createClient()
  
  const validatedFields = userUpdateSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('perfiles')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/usuarios')
  return { success: true }
}
