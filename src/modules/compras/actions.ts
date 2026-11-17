'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireCompras, notificacionesCompras, ComprasError } from './service.server'
import { mutationSchema } from './validation'
import { z } from 'zod'

export async function mutarCompra(input: unknown): Promise<{id?: string; error?: string}> {
  const parsed = mutationSchema.safeParse(input)
  if (!parsed.success) return {error:'Revisa los campos obligatorios y sus longitudes.'}
  const {accion,...datos} = parsed.data
  try {
    await requireCompras(['crear','proveedor','reasignar','devolver','cerrar'].includes(accion))
    const db = await createClient()
    const {data,error} = await db.rpc('compras_mutar',{p_accion:accion,p_datos:datos})
    if (error) return {error:error.code==='23505' ? 'Ya existe ese proveedor o esa factura para el proveedor seleccionado.' :
      ['P0001','40001','42501'].includes(error.code) ? error.message : 'No se pudo guardar. Actualiza y verifica el registro antes de intentar nuevamente.'}
    revalidatePath('/compras','layout')
    return {id:data}
  } catch (error) {
    return {error:error instanceof ComprasError ? error.message : 'No se pudo completar la solicitud. Intenta nuevamente.'}
  }
}
export async function cargarNotificacionesCompras() {
  try { return {data:await notificacionesCompras()} }
  catch { return {error:'No se pudieron actualizar las notificaciones.'} }
}

export async function guardarMesaCompras(input: unknown): Promise<{error?:string;success?:boolean}> {
  const parsed=z.object({id:z.string().uuid(),mesa_id:z.number().int().min(1).max(5).nullable(),activo:z.boolean(),version:z.number().int().positive()}).safeParse(input)
  if(!parsed.success)return {error:'Revisa la mesa y el encargado seleccionados.'}
  try {
    await requireCompras(true)
    const db=await createClient();const p=parsed.data
    const {error}=await db.rpc('compras_guardar_mesa',{p_id:p.id,p_mesa:p.mesa_id,p_activo:p.activo,p_version:p.version})
    if(error)return {error:['42501','40001','P0001'].includes(error.code)?error.message:'No se pudo guardar la asignación.'}
    revalidatePath('/compras','layout')
    return {success:true}
  }catch(error){return {error:error instanceof ComprasError?error.message:'No se pudo guardar. Actualiza antes de intentar nuevamente.'}}
}
