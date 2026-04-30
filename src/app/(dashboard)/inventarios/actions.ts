'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const containerSchema = z.object({
  codigo: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
  descripcion: z.string().optional(),
  estado: z.enum(['disponible', 'en_uso', 'mantenimiento']).default('disponible'),
})

export async function getContenedores() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contenedores')
    .select('*')
    .neq('estado', 'mantenimiento') // Usamos mantenimiento como una forma de "sacar de circulación" sin borrar
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createContenedor(formData: any) {
  const supabase = await createClient()
  
  const validatedFields = containerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('contenedores')
    .insert([validatedFields.data])

  if (error) return { error: error.message }

  revalidatePath('/inventarios')
  return { success: true }
}

export async function updateContenedor(id: string, formData: any) {
  const supabase = await createClient()
  
  const validatedFields = containerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('contenedores')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/inventarios')
  return { success: true }
}

export async function deleteContenedor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contenedores')
    .update({ estado: 'mantenimiento' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/inventarios')
  return { success: true }
}
