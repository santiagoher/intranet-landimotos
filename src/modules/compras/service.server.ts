import 'server-only'
import { cache } from 'react'
import { getAuthUser, getProfile } from '@/utils/supabase/session.server'
import { createClient } from '@/utils/supabase/server'
import { filtersSchema } from './validation'
import type { Catalogos, Detalle, Encargado, Filtros, Movimiento, Notificacion, Observacion, Proveedor, Resumen, Revision } from './types'

export class ComprasError extends Error {
  constructor(message: string, public status = 403) { super(message) }
}
export const requireCompras = cache(async (adminOnly = false) => {
  const {data: {user}, error} = await getAuthUser()
  if (error || !user) throw new ComprasError('No se pudo verificar tu sesión.', 401)
  const {data: profile, error: profileError} = await getProfile(user.id)
  if (profileError || !profile) throw new ComprasError('No se pudo verificar tu perfil. Intenta nuevamente.', 503)
  let admin = profile.rol === 'Admin'
  if (profile.estado !== 'activo' || (!admin && (profile.rol !== 'Operativo' || !profile.modulos_permitidos?.includes('compras')))) {
    throw new ComprasError(adminOnly ? 'Los reportes de Compras son exclusivos del administrador.' : 'No tienes acceso a Compras. Solicita la asignación del módulo al administrador.')
  }
  if (!admin) {
    const db = await createClient()
    const {data,error} = await db.rpc('compras_es_admin')
    if(error) throw new ComprasError('No se pudo verificar el rol de Compras. Intenta nuevamente.',503)
    admin = data === true
  }
  if (adminOnly && !admin) throw new ComprasError('Esta sección es exclusiva del administrador de Compras.')
  return {userId: user.id, admin}
})

export async function consultarCompras(filtros: Filtros = {}, pagina = 1, tamano = 25): Promise<Resumen> {
  await requireCompras()
  const parsed = filtersSchema.safeParse(filtros)
  if (!parsed.success || !Number.isInteger(pagina) || pagina < 1 || tamano < 1 || tamano > 500) throw new ComprasError('Filtros no válidos.', 400)
  const db = await createClient()
  const {data,error} = await db.rpc('compras_consultar', {p_filtros: parsed.data,p_pagina: pagina,p_tamano: tamano})
  if (error) throw new ComprasError(['PGRST202','42883'].includes(error.code) ? 'Compras está pendiente de activar en la base de datos.' : 'No se pudieron consultar las revisiones.',503)
  return data as Resumen
}

// Explicit pagination avoids silently losing rows to the PostgREST row cap.
async function allRows<T>(table: string, columns: string, revisionId?: string): Promise<T[]> {
  const db = await createClient(); const rows: T[] = []
  for (let offset=0; ; offset+=500) {
    let query = db.from(table).select(columns).order('id').range(offset,offset+499)
    if (revisionId) query = query.eq('revision_id',revisionId)
    const {data,error} = await query
    if (error) throw new ComprasError('No se pudo cargar la información de Compras.',503)
    rows.push(...data as T[])
    if (data.length < 500) break
  }
  return rows
}
export async function catalogosCompras(): Promise<Catalogos> {
  const access = await requireCompras(); const db = await createClient()
  const [proveedores, operadores] = await Promise.all([
    allRows<Proveedor>('compras_proveedores','id,nombre,nit,activo'),
    access.admin ? db.rpc('compras_operadores') : Promise.resolve({data:[],error:null}),
  ])
  if (operadores.error) throw new ComprasError('No se pudieron cargar los encargados.',503)
  return {proveedores:proveedores.sort((a,b)=>a.nombre.localeCompare(b.nombre)),operadores:operadores.data ?? []}
}
export async function equipoCompras(): Promise<Encargado[]> {
  await requireCompras(true)
  return (await allRows<Encargado>('compras_encargados','id,perfil_id,nombre,mesa_id,activo,version')).sort((a,b)=>a.nombre.localeCompare(b.nombre))
}
export async function detalleCompras(id: string): Promise<Detalle | null> {
  await requireCompras(); const db = await createClient()
  const {data,error} = await db.from('compras_revisiones').select('*').eq('id',id).maybeSingle()
  if (error) throw new ComprasError('No se pudo cargar la revisión.',503)
  if (!data) return null
  const [observaciones,historial,tiempo] = await Promise.all([
    allRows<Observacion>('compras_observaciones','*',id),allRows<Movimiento>('compras_historial','*',id),
    db.rpc('compras_tiempo',{p_id:id}),
  ])
  if(tiempo.error || !tiempo.data) throw new ComprasError('No se pudo calcular el tiempo laboral.',503)
  return {registro:{...data,...tiempo.data} as Revision,observaciones:observaciones.sort((a,b)=>a.creado_at.localeCompare(b.creado_at)),
    historial:historial.sort((a,b)=>a.datos.version-b.datos.version)}
}
export async function notificacionesCompras(): Promise<Notificacion[]> {
  await requireCompras(); const db = await createClient()
  const {data,error} = await db.from('compras_notificaciones').select('*').is('leido_at',null).order('creado_at',{ascending:false}).order('id').limit(50)
  if (error) throw new ComprasError('No se pudieron cargar las notificaciones.',503)
  return data as Notificacion[]
}
