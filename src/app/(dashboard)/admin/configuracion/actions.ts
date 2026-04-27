'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const configSchema = z.object({
  categoria: z.enum(['area', 'revisor', 'mesa']),
  punto: z.enum(['Principal', 'Sucursal']),
  valor: z.string().min(1, 'El valor no puede estar vacío'),
})

  export async function getConfiguraciones() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('configuracion_campos')
    .select('*')
    .order('categoria', { ascending: true })
    .order('valor', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function addConfiguracion(formData: { categoria: string, punto: string, valor: string }) {
  const supabase = await createClient()
  
  const validatedFields = configSchema.safeParse(formData)
  if (!validatedFields.success) {
    return { error: 'Datos inválidos' }
  }

  const { error } = await supabase
    .from('configuracion_campos')
    .insert([validatedFields.data])

  if (error) return { error: error.message }

  revalidatePath('/admin/configuracion')
  revalidatePath('/despachos')
  return { success: true }
}

export async function deleteConfiguracion(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('configuracion_campos')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/configuracion')
  revalidatePath('/despachos')
  return { success: true }
}
