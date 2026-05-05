'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

const messengerSchema = z.object({
  nombre_conductor: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  placa_conductor: z.string().min(1, 'La placa es requerida'),
  foto_url: z.string().optional(),
  estado: z.enum(['disponible', 'en_ruta', 'en_almuerzo', 'inactivo', 'eliminado']).default('disponible'),
})

const routeSchema = z.object({
  mensajero_id: z.string().uuid(),
  lugar_entrega: z.string().min(1, 'Especifique el lugar'),
  numero_pedidos: z.number().min(1),
  numero_factura: z.string().min(1, 'Debe ingresar facturas'),
  revisor: z.string().min(1),
  hora_salida: z.string().optional(),
})

export async function getMensajeros() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mensajeros')
    .select('*')
    .neq('estado', 'eliminado')
    .order('nombre_conductor', { ascending: true })

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
  revalidatePath('/admin/mensajeros')
  return { success: true }
}

export async function uploadPhoto(formData: FormData) {
  const supabase = await createClient()
  const file = formData.get('file') as File
  if (!file) return { error: 'No se seleccionó ningún archivo' }

  const fileExt = file.name.split('.').pop()
  const fileName = `${uuidv4()}.${fileExt}`
  const filePath = `fotos/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('perfiles')
    .upload(filePath, file)

  if (uploadError) return { error: uploadError.message }

  const { data } = supabase.storage
    .from('perfiles')
    .getPublicUrl(filePath)

  return { url: data.publicUrl }
}

export async function deleteMensajero(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mensajeros')
    .update({ estado: 'eliminado' })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/mensajeros')
  revalidatePath('/mensajeros')
  return { success: true }
}

export async function updateMensajeroStatus(id: string, estado: 'disponible' | 'en_ruta' | 'en_almuerzo' | 'inactivo' | 'eliminado') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('mensajeros')
    .update({ estado })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/mensajeros')
  return { success: true }
}

export async function getActiveRoutes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mensajeros_rutas')
    .select(`
      *,
      mensajero:mensajeros(nombre_conductor, foto_url, placa_conductor)
    `)
    .eq('estado', 'activo')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createRoute(formData: any) {
  const supabase = await createClient()
  const validatedFields = routeSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  // 1. Crear la ruta
  const { error: routeError } = await supabase
    .from('mensajeros_rutas')
    .insert([{
      ...validatedFields.data,
      estado: 'activo',
      hora_salida: validatedFields.data.hora_salida || new Date().toISOString()
    }])

  if (routeError) return { error: routeError.message }

  // 2. Cambiar estado del mensajero a 'en_ruta'
  await supabase
    .from('mensajeros')
    .update({ estado: 'en_ruta' })
    .eq('id', validatedFields.data.mensajero_id)

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function finalizeRoute(routeId: string, mensajeroId: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // 1. Finalizar la ruta y registrar hora de llegada
  const { error: routeError } = await supabase
    .from('mensajeros_rutas')
    .update({
      estado: 'finalizado',
      hora_llegada: now
    })
    .eq('id', routeId)

  if (routeError) return { error: routeError.message }

  // 2. Cambiar estado del mensajero a 'disponible'
  await supabase
    .from('mensajeros')
    .update({ estado: 'disponible' })
    .eq('id', mensajeroId)

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function startLunch(mensajeroId: string) {
  const supabase = await createClient()

  // 1. Cambiar estado del mensajero
  const { error: userError } = await supabase
    .from('mensajeros')
    .update({ estado: 'en_almuerzo' })
    .eq('id', mensajeroId)

  if (userError) return { error: userError.message }

  // 2. Crear registro de almuerzo
  const { error: lunchError } = await supabase
    .from('mensajeros_almuerzos')
    .insert([{ mensajero_id: mensajeroId }])

  if (lunchError) return { error: lunchError.message }

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function endLunch(mensajeroId: string) {
  const supabase = await createClient()

  // 1. Cambiar estado del mensajero a disponible
  const { error: userError } = await supabase
    .from('mensajeros')
    .update({ estado: 'disponible' })
    .eq('id', mensajeroId)

  if (userError) return { error: userError.message }

  // 2. Actualizar hora de entrada (el registro que no tenga hora_entrada)
  const { error: lunchError } = await supabase
    .from('mensajeros_almuerzos')
    .update({ hora_entrada: new Date().toISOString() })
    .eq('mensajero_id', mensajeroId)
    .is('hora_entrada', null)

  if (lunchError) return { error: lunchError.message }

  revalidatePath('/mensajeros')
  return { success: true }
}

export async function getLunchHistory() {
  const supabase = await createClient()

  // Obtener el inicio del día actual a las 00:00:00
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('mensajeros_almuerzos')
    .select(`
      *,
      mensajero:mensajeros(nombre_conductor, placa_conductor)
    `)
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching lunch history:', error)
    return []
  }
  return data
}

export async function getFinishedRoutes() {
  const supabase = await createClient()

  // Obtener el inicio del día actual a las 00:00:00
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('mensajeros_rutas')
    .select(`
      *,
      mensajero:mensajeros(nombre_conductor, placa_conductor, foto_url)
    `)
    .eq('estado', 'finalizado')
    .gte('created_at', startOfDay.toISOString())
    .order('hora_llegada', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function getMensajerosStats(startDate: string, endDate: string) {
  const supabase = await createClient()
  
  const start = new Date(startDate + 'T00:00:00').toISOString()
  const end = new Date(endDate + 'T23:59:59').toISOString()
  
  const year = new Date(startDate).getFullYear()
  const startOfYear = new Date(year, 0, 1).toISOString()
  const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString()

  // 1. Datos anuales (Enero a Diciembre del año del rango)
  const { data: yearlyData } = await supabase
    .from('mensajeros_rutas')
    .select('created_at, numero_pedidos')
    .eq('estado', 'finalizado')
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear)

  // 2. Datos del rango
  const { data: rangeData } = await supabase
    .from('mensajeros_rutas')
    .select('created_at, numero_pedidos, numero_factura, lugar_entrega, hora_salida')
    .eq('estado', 'finalizado')
    .gte('created_at', start)
    .lte('created_at', end)

  return {
    yearly: yearlyData || [],
    monthly: rangeData || [], // Usamos monthly como nombre estándar para el rango
    hourly: rangeData || []
  }
}

export async function searchRouteByFactura(numeroFactura: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mensajeros_rutas')
    .select(`
      *,
      mensajero:mensajeros(nombre_conductor, placa_conductor, foto_url)
    `)
    .ilike('numero_factura', `%${numeroFactura}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  return data ? data[0] : null
}
