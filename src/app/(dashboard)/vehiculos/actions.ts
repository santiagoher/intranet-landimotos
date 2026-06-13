'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const vehicleSchema = z.object({
  placa: z.string().min(1, 'La placa es requerida').transform(val => val.toUpperCase().trim()),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().optional().default(''),
  tipo: z.enum(['Moto', 'Carro', 'Camión', 'Otro']),
  kilometraje: z.coerce.number().min(0, 'El kilometraje debe ser mayor o igual a 0'),
  estado: z.enum(['activo', 'mantenimiento', 'inactivo']).default('activo'),
})

const checklistSchema = z.object({
  vehiculo_id: z.string().uuid('Por favor, selecciona un vehículo'),
  conductor_nombre: z.string().min(3, 'Nombres y Apellidos completos es requerido'),
  conductor_cedula: z.string().min(3, 'N° de Cédula es requerido'),
  conductor_cargo: z.enum(['Conductor', 'Mensajero']),
  kilometraje: z.coerce.number().min(0, 'El kilometraje debe ser mayor o igual a 0'),
  evaluaciones: z.record(z.string(), z.enum(['b', 'm', 'na'])),
  observaciones: z.string().optional().default(''),
})

export async function getVehiculos() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehiculos')
    .select('*')
    .order('placa', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createVehiculo(formData: unknown) {
  const supabase = await createClient()
  const validatedFields = vehicleSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('vehiculos')
    .insert([validatedFields.data])

  if (error) {
    if (error.code === '23505') {
      return { error: { placa: ['Ya existe un vehículo registrado con esta placa'] } }
    }
    return { error: error.message }
  }

  revalidatePath('/vehiculos')
  return { success: true }
}

export async function updateVehiculo(id: string, formData: unknown) {
  const supabase = await createClient()
  const validatedFields = vehicleSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('vehiculos')
    .update(validatedFields.data)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: { placa: ['Ya existe un vehículo registrado con esta placa'] } }
    }
    return { error: error.message }
  }

  revalidatePath('/vehiculos')
  return { success: true }
}

export async function deleteVehiculo(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('vehiculos')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/vehiculos')
  return { success: true }
}

export async function createChecklist(formData: unknown) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuario no autenticado' }

  const validatedFields = checklistSchema.safeParse(formData)
  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors }
  }

  const checklistData = validatedFields.data

  // Validar kilometraje respecto al actual
  const { data: vehiculo, error: vehError } = await supabase
    .from('vehiculos')
    .select('kilometraje, placa')
    .eq('id', checklistData.vehiculo_id)
    .single()

  if (vehError || !vehioInfo(vehiculo)) {
    return { error: 'Vehículo no encontrado' }
  }

  function vehioInfo(v: unknown): v is { kilometraje: number; placa: string } {
    return typeof v === 'object' && v !== null && 'kilometraje' in v && typeof (v as { kilometraje: unknown }).kilometraje === 'number'
  }

  if (checklistData.kilometraje < vehiculo.kilometraje) {
    return { 
      error: { 
        kilometraje: [`El kilometraje ingresado (${checklistData.kilometraje}) no puede ser menor al kilometraje actual registrado del vehículo (${vehiculo.kilometraje})`] 
      } 
    }
  }

  // Verificar si hay novedades (si algún elemento está en 'm' de mal)
  const evaluationsList = Object.values(checklistData.evaluaciones)
  const tieneNovedad = evaluationsList.includes('m')

  // Si tiene novedad, la observación es obligatoria
  if (tieneNovedad && (!checklistData.observaciones || checklistData.observaciones.trim() === '')) {
    return {
      error: {
        observaciones: ['Es obligatorio registrar una observación detallando la falla cuando reportas un componente como MALO (M).']
      }
    }
  }

  // Insertar checklist (mapeado a las columnas específicas de la DB)
  const getStatusForKeys = (evals: Record<string, string>, keys: string[]): 'b' | 'm' | 'na' => {
    let hasMal = false
    let allNa = true
    for (const k of keys) {
      const v = evals[k]
      if (v === 'm') hasMal = true
      if (v !== 'na') allNa = false
    }
    if (hasMal) return 'm'
    if (allNa) return 'na'
    return 'b'
  }

  const lucesVal = getStatusForKeys(checklistData.evaluaciones, ['luz_freno', 'direccionales', 'luz_reversa', 'luz_cabina', 'luces_estacionarias', 'luces_altas_bajas'])
  const frenosVal = getStatusForKeys(checklistData.evaluaciones, ['pastillas_delanteras', 'pastillas_traseras', 'freno_estacionamiento', 'freno_trasero_tensionado'])
  const llantasVal = getStatusForKeys(checklistData.evaluaciones, ['labrado_llantas', 'presion_aire', 'amortiguadores', 'ballestas', 'desgaste_llantas', 'terminales', 'cauchos_bujes'])
  const espejosVal = checklistData.evaluaciones['espejos'] || 'b'
  const aceiteMotorVal = checklistData.evaluaciones['aceite_motor'] || 'b'
  const liquidoFrenosVal = checklistData.evaluaciones['liquido_frenos'] || 'b'
  const carroceriaVal = getStatusForKeys(checklistData.evaluaciones, ['plumillas', 'vidrios_panoramico', 'estado_carroceria', 'cinturones', 'silla', 'puertas', 'vidrios_puertas', 'orden_aseo', 'kit_arrastre', 'tension_cadena', 'buje_tijera'])
  const documentosVal = getStatusForKeys(checklistData.evaluaciones, ['licencia_transito', 'licencia_conduccion', 'vigencia_soat', 'revision_tecnomecanica'])

  const { data: insertedChecklist, error: insertError } = await supabase
    .from('vehiculo_checklists')
    .insert([{
      vehiculo_id: checklistData.vehiculo_id,
      usuario_id: user.id,
      conductor_nombre: checklistData.conductor_nombre,
      conductor_cedula: checklistData.conductor_cedula,
      conductor_cargo: checklistData.conductor_cargo,
      kilometraje: checklistData.kilometraje,
      luces: lucesVal,
      frenos: frenosVal,
      llantas: llantasVal,
      espejos: espejosVal,
      aceite_motor: aceiteMotorVal,
      liquido_frenos: liquidoFrenosVal,
      carroceria: carroceriaVal,
      documentos: documentosVal,
      tiene_novedad: tieneNovedad,
      observaciones: checklistData.observaciones,
      evaluaciones: checklistData.evaluaciones
    }])
    .select()
    .single()

  if (insertError) {
    return { error: insertError.message }
  }

  // Actualizar kilometraje del vehículo
  const { error: vehUpdateErr } = await supabase
    .from('vehiculos')
    .update({ kilometraje: checklistData.kilometraje })
    .eq('id', checklistData.vehiculo_id)
  
  if (vehUpdateErr) {
    console.error('Error al actualizar kilometraje del vehículo:', vehUpdateErr.message)
  }

  // Crear alerta si tiene novedad
  if (tieneNovedad && insertedChecklist) {
    const { error: alertInsertErr } = await supabase
      .from('vehiculo_alertas')
      .insert([{
        checklist_id: insertedChecklist.id,
        vehiculo_id: checklistData.vehiculo_id,
        usuario_id: user.id,
        estado: 'pendiente'
      }])
    
    if (alertInsertErr) {
      console.error('Error al insertar alerta en public.vehiculo_alertas:', alertInsertErr.message)
    }
  }

  revalidatePath('/vehiculos')
  return { success: true }
}

export async function getChecklists(startDate?: string, endDate?: string, vehiculoId?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('vehiculo_checklists')
    .select(`
      *,
      vehiculo:vehiculos(placa, marca, modelo, tipo),
      usuario:perfiles(nombre)
    `)
    .order('created_at', { ascending: false })

  if (startDate) {
    query = query.gte('created_at', new Date(startDate + 'T00:00:00').toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', new Date(endDate + 'T23:59:59').toISOString())
  }
  if (vehiculoId && vehiculoId !== 'all') {
    query = query.eq('vehiculo_id', vehiculoId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export async function getAlertas() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehiculo_alertas')
    .select(`
      *,
      vehiculo:vehiculos(placa, marca, modelo, tipo, kilometraje),
      checklist:vehiculo_checklists(*),
      usuario:perfiles(nombre)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function resolveAlerta(alertaId: string, comentarios: string) {
  const supabase = await createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('vehiculo_alertas')
    .update({
      estado: 'solucionado',
      comentarios_admin: comentarios,
      resolved_at: now
    })
    .eq('id', alertaId)

  if (error) return { error: error.message }

  revalidatePath('/vehiculos')
  return { success: true }
}

export async function getVehiculosStats() {
  const supabase = await createClient()

  // 1. Total vehículos activos
  const { count: totalVehicles } = await supabase
    .from('vehiculos')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'activo')

  // 2. Alertas pendientes
  const { count: pendingAlerts } = await supabase
    .from('vehiculo_alertas')
    .select('*', { count: 'exact', head: true })
    .eq('estado', 'pendiente')

  // 3. Checklists hoy
  const today = new Date()
  today.setHours(0,0,0,0)
  const { count: checklistsToday } = await supabase
    .from('vehiculo_checklists')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  return {
    totalVehicles: totalVehicles || 0,
    pendingAlerts: pendingAlerts || 0,
    checklistsToday: checklistsToday || 0
  }
}
