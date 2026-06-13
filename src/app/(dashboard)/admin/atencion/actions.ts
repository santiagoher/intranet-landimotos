'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// =========================================================================
// 1. GESTIÓN DE ASESORES
// =========================================================================

export async function getAsesores() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('atencion_asesores')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addAsesor(nombre: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_asesores')
    .insert([{ nombre: nombre.trim(), activo: true }])

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

export async function toggleAsesorActivo(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_asesores')
    .update({ activo })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

export async function deleteAsesor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_asesores')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

// =========================================================================
// 2. GESTIÓN DE ETIQUETAS
// =========================================================================

export async function getEtiquetas() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('atencion_etiquetas')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function addEtiqueta(nombre: string, color: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_etiquetas')
    .insert([{ nombre: nombre.trim(), color: color.trim(), activo: true }])

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

export async function deleteEtiqueta(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_etiquetas')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

// =========================================================================
// 3. GESTIÓN DE ATENCIÓN DIARIA
// =========================================================================

export async function getAtencionDiaria(startDate?: string, endDate?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('atencion_diaria')
    .select(`
      *,
      asesor:atencion_asesores(nombre)
    `)
    .order('fecha', { ascending: false })

  if (startDate) {
    query = query.gte('fecha', startDate)
  }
  if (endDate) {
    query = query.lte('fecha', endDate)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export async function saveAtencionDiaria(payload: {
  id?: string
  fecha: string
  asesor_id: string
  etiquetas: Record<string, number>
  total_clientes: number
  observaciones?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const record = {
    fecha: payload.fecha,
    asesor_id: payload.asesor_id,
    etiquetas: payload.etiquetas,
    total_clientes: payload.total_clientes,
    observaciones: payload.observaciones || '',
    usuario_id: user?.id || null
  }

  if (payload.id) {
    // Actualización
    const { error } = await supabase
      .from('atencion_diaria')
      .update(record)
      .eq('id', payload.id)

    if (error) return { error: error.message }
  } else {
    // Creación (Upsert sobre unique_fecha_asesor)
    const { error } = await supabase
      .from('atencion_diaria')
      .upsert([record], { onConflict: 'fecha,asesor_id' })

    if (error) {
      if (error.code === '23505') {
        return { error: 'Ya existe un reporte de atención registrado para este asesor en la fecha seleccionada.' }
      }
      return { error: error.message }
    }
  }

  revalidatePath('/admin/atencion')
  return { success: true }
}

export async function deleteAtencionDiaria(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_diaria')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}

// =========================================================================
// 4. PROGRAMACIÓN DE ESTADOS DE WHATSAPP
// =========================================================================

export async function getEstadosWhatsapp(startDate?: string, endDate?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('atencion_estados_whatsapp')
    .select(`
      *,
      asesor:atencion_asesores(nombre)
    `)
    .order('fecha', { ascending: true })

  if (startDate) {
    query = query.gte('fecha', startDate)
  }
  if (endDate) {
    query = query.lte('fecha', endDate)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export async function saveEstadoWhatsapp(payload: {
  id?: string
  fecha: string
  asesor_id: string
  tematica: string
  cantidad_requerida: number
  estado?: 'pendiente' | 'cumplido' | 'incumplido'
  observaciones?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const record = {
    fecha: payload.fecha,
    asesor_id: payload.asesor_id,
    tematica: payload.tematica.trim(),
    cantidad_requerida: payload.cantidad_requerida,
    estado: payload.estado || 'pendiente',
    observaciones: payload.observaciones || '',
    usuario_id: user?.id || null
  }

  if (payload.id) {
    const { error } = await supabase
      .from('atencion_estados_whatsapp')
      .update(record)
      .eq('id', payload.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('atencion_estados_whatsapp')
      .insert([record])

    if (error) return { error: error.message }
  }

  revalidatePath('/admin/atencion')
  return { success: true }
}

export async function deleteEstadoWhatsapp(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('atencion_estados_whatsapp')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/admin/atencion')
  return { success: true }
}
