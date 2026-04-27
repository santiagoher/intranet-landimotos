'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const messengerSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  telefono: z.string().min(7, 'El teléfono debe tener al menos 7 dígitos'),
  estado: z.enum(['disponible', 'en_ruta', 'inactivo']).default('disponible'),
})

export async function getMensajeros() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mensajeros')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createMensajero(formData: any) {
  const supabase = await createClient()
  
  const validatedFields = messengerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('mensajeros')
    .insert([validatedFields.data])

  if (error) return { error: error.message }

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function updateMensajero(id: string, formData: any) {
  const supabase = await createClient()
  
  const validatedFields = messengerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('mensajeros')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function deleteMensajero(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mensajeros')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/mensajeros')
  return { success: true }
}
