'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const orderSchema = z.object({
  punto: z.enum(['Principal', 'Sucursal']),
  numero_factura: z.string().min(1, 'Debe ingresar al menos una factura'),
  area: z.string().min(1, 'Seleccione un área'),
  revisado_por: z.string().min(1, 'Seleccione quién revisó el pedido'),
  mesa: z.string().min(1, 'Seleccione una mesa'),
  detalles: z.string().optional(),
  estado: z.enum(['pendiente', 'enviado', 'entregado', 'cancelado']).default('pendiente'),
})

const shipmentSchema = z.object({
  pedido_id: z.string().uuid('Pedido inválido'),
  mensajero_id: z.string().uuid('Mensajero inválido'),
  direccion: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
  estado: z.enum(['asignado', 'en_camino', 'entregado', 'fallido']).default('asignado'),
})

export async function getPedidos() {
  const supabase = await createClient()
  
  // Obtener el primer día del mes actual a las 00:00:00
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  startOfMonth.setHours(0, 0, 0, 0)
  
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .neq('estado', 'cancelado')
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createPedido(formData: any) {
  const supabase = await createClient()
  const validatedFields = orderSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('pedidos')
    .insert([validatedFields.data])

  if (error) return { error: error.message }

  revalidatePath('/despachos')
  return { success: true }
}

export async function getEnvios() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('envios')
    .select(`
      *,
      pedido:pedidos(numero_factura, detalles),
      mensajero:mensajeros(nombre_conductor)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function createEnvio(formData: any) {
  const supabase = await createClient()
  const validatedFields = shipmentSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  // Al crear el envío, actualizamos el estado del pedido a 'enviado'
  const { error: shipmentError } = await supabase
    .from('envios')
    .insert([validatedFields.data])

  if (shipmentError) return { error: shipmentError.message }

  await supabase
    .from('pedidos')
    .update({ estado: 'enviado' })
    .eq('id', validatedFields.data.pedido_id)

  revalidatePath('/despachos')
  return { success: true }
}

export async function deletePedido(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'cancelado' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/despachos')
  return { success: true }
}

export async function getDespachosStats(startDate: string, endDate: string) {
  const supabase = await createClient()
  
  const start = new Date(startDate + 'T00:00:00').toISOString()
  const end = new Date(endDate + 'T23:59:59').toISOString()
  
  // Para el año, tomamos el año de la fecha de inicio
  const year = new Date(startDate).getFullYear()
  const startOfYear = new Date(year, 0, 1).toISOString()
  const endOfYear = new Date(year, 11, 31, 23, 59, 59).toISOString()

  // 1. Datos anuales (Enero a Diciembre del año del rango)
  const { data: yearlyData } = await supabase
    .from('pedidos')
    .select('created_at')
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear)

  // 2. Datos del rango para áreas y revisores
  const { data: rangeData } = await supabase
    .from('pedidos')
    .select('created_at, area, revisado_por, punto')
    .gte('created_at', start)
    .lte('created_at', end)

  // 3. Pico de horas para el mismo rango
  const { data: hourlyData } = await supabase
    .from('pedidos')
    .select('created_at')
    .gte('created_at', start)
    .lte('created_at', end)

  return {
    yearly: yearlyData || [],
    monthly: rangeData || [], // Reutilizamos la clave 'monthly' para no romper el frontend, pero representa el rango
    hourly: hourlyData || []
  }
}

export async function getDetailedReportData(startDate: string, endDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .gte('created_at', new Date(startDate + 'T00:00:00').toISOString())
    .lte('created_at', new Date(endDate + 'T23:59:59').toISOString())
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

export async function searchPedidoByFactura(numeroFactura: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .ilike('numero_factura', `%${numeroFactura}%`)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  return data ? data[0] : null
}
