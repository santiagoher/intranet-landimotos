'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { Event, CountProduct, ComparisonProduct, Context, Task } from './types'
import { isVersionConflict } from './conflicts'
import { getTrialCatalog, withoutReference } from './catalog.server'
import type { ReportProduct } from './report'
import { priorityForRpc } from './task-list'
import { authFailureMessage } from '@/utils/supabase/auth-errors'
import {demoServerKey} from './features.server'

const assignment = z.object({
  key: z.string().uuid(), warehouse: z.string().uuid(), category: z.string().uuid(), operator: z.string().uuid(),
  priority: z.enum(['baja','media','alta']),
  note: z.string().max(2000),
  source: z.enum(['report','trial']).default('report'),
  products: z.array(z.object({
    code:z.string().trim().min(1).max(300), name:z.string().trim().min(1).max(300),
    family:z.string().max(300), group:z.string().max(300), subgroup:z.string().max(300), brand:z.string().max(300),
    expectedQuantity:z.string().regex(/^\d{1,14}(\.\d{1,6})?$/).optional(),
  })).min(1).max(2000).optional(),
})
const update = z.object({
  ticket: z.string().uuid(), version: z.number().int().positive(),
  action: z.enum(['iniciar','avance','finalizar','verificar_cerrar','devolver']),
  progress: z.number().int().min(26).max(69).nullable(), note: z.string().max(2000),
})
async function rpc(name: string, args: Record<string, unknown>) {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (error) return { error: authFailureMessage(error) }
  if (!user) return { error: 'La sesión ya no es válida. Inicia sesión nuevamente.' }
  const request=db.rpc(name,args)
  if(name==='inventario_revisar_conteo'&&demoServerKey())request.setHeader('x-inventory-demo-key',demoServerKey())
  const result = await request.retry(false)
  if (result.error) return { conflict:isVersionConflict(result.error), error: ['P0001','42501','40001','PT409'].includes(result.error.code) ? result.error.message : 'No se pudo confirmar el guardado. Consulta los datos actuales antes de reintentar.' }
  revalidatePath('/inventarios/registros')
  revalidatePath('/inventarios/reportes')
  revalidatePath('/admin/inventarios')
  return { ok: true as const }
}
export async function assignInventory(input: unknown) {
  const parsed = assignment.safeParse(input)
  if (!parsed.success) return { error: 'Revisa bodega, categoría, operador y prioridad.' }
  const p = {...parsed.data,priority:priorityForRpc(parsed.data.priority)}
  if(p.source==='trial') {
    const selected=p.products?.map(p=>p.code) ?? []
    const catalog=getTrialCatalog()
    if(!selected.length || new Set(selected).size!==selected.length || selected.some(code=>!catalog.some(p=>p.code===code)))return {error:'Selecciona productos válidos del catálogo de prueba.'}
    // Resolve names and reference balances on the server, never trust client balances for trial data.
    return rpc('inventario_asignar_con_saldos',{p_clave:p.key,p_bodega:p.warehouse,p_categoria:p.category,p_operador:p.operator,
      p_prioridad:p.priority,p_observacion:p.note,p_productos:catalog.filter(p=>selected.includes(p.code)),p_es_prueba:true})
  }
  if(p.products?.some(p=>p.expectedQuantity!==undefined))return rpc('inventario_asignar_con_saldos',{p_clave:p.key,p_bodega:p.warehouse,p_categoria:p.category,p_operador:p.operator,
    p_prioridad:p.priority,p_observacion:p.note,p_productos:p.products,p_es_prueba:false})
  if (p.products) return rpc('inventario_asignar_reporte', { p_clave:p.key,p_bodega:p.warehouse,p_categoria:p.category,p_operador:p.operator,
    p_prioridad:p.priority,p_observacion:p.note,p_productos:p.products })
  return rpc('inventario_asignar', { p_clave: p.key, p_bodega: p.warehouse, p_categoria: p.category, p_operador: p.operator,
    p_prioridad: p.priority, p_vencimiento: null, p_observacion: p.note })
}
export async function getTrialProducts(warehouse: string): Promise<{products?:ReportProduct[];error?:string}> {
  if(!z.string().uuid().safeParse(warehouse).success)return {error:'Selecciona una bodega válida.'}
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)return {error:'Sesión requerida'}
  const {data,error}=await db.rpc('inventario_contexto')
  const context=data as Context | null
  if(error || !context || context.userId!==user.id || !context.warehouses.some(w=>w.id===warehouse && w.role==='lider'))return {error:'Solo el líder puede preparar una asignación.'}
  return {products:getTrialCatalog().map(withoutReference)}
}
export async function getTaskComparison(ticket:string):Promise<{products?:ComparisonProduct[];error?:string}> {
  if(!z.string().uuid().safeParse(ticket).success)return {error:'Tarea inválida'}
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user)return {error:'Sesión requerida'}
  const {data,error}=await db.rpc('inventario_comparacion_tarea',{p_ticket:ticket})
  return error?{error:'No se pudo consultar la comparación de esta tarea.'}:{products:data}
}
export async function saveCountProduct(input: unknown) {
  const parsed = z.object({ item:z.string().uuid(), version:z.number().int().positive(), quantity:z.string().regex(/^\d{1,14}(\.\d{1,6})?$/) }).safeParse(input)
  if (!parsed.success) return { error:'Ingresa una cantidad válida (cero también es válido), con hasta seis decimales.' }
  return rpc('inventario_contar_producto',{p_item:parsed.data.item,p_version:parsed.data.version,p_cantidad:parsed.data.quantity})
}
export async function getCountProducts(ticket: string): Promise<{ products?: CountProduct[]; error?: string }> {
  if (!z.string().uuid().safeParse(ticket).success) return {error:'Tarea inválida'}
  const db=await createClient()
  const {data:{user}}=await db.auth.getUser()
  if(!user) return {error:'Sesión requerida'}
  const {data,error}=await db.rpc('inventario_productos_tarea',{p_ticket:ticket})
  return error ? {error:'No se pudieron cargar los productos'} : {products:data}
}
export async function getTaskSnapshot(ticket:string,supervisor:boolean):Promise<{task?:Task;products?:CountProduct[];comparison?:ComparisonProduct[];error?:string}> {
  if(!z.string().uuid().safeParse(ticket).success)return {error:'Tarea inválida'}
  const db=await createClient()
  const auth=await db.auth.getUser()
  if(auth.error)return {error:authFailureMessage(auth.error)}
  if(!auth.data.user)return {error:'Sesión requerida'}
  // RLS and each existing RPC enforce scope; supervisor is only a view choice.
  const current=await db.from('inventario_tickets').select('id,numero,bodega_id,categoria_id,asignado_a,asignado_por,lider_id,estado,prioridad,version,avance_parcial,asignado_at,iniciado_at,enviado_at,vencimiento_at,verificacion_iniciada_at,verificacion_finalizada_at,cerrado_at,observacion_inicial,total_productos,productos_contados,es_prueba,cierre_con_diferencias,justificacion_cierre').eq('id',ticket).single()
  if(current.error||!current.data)return {error:'No se pudo consultar la tarea o ya no tienes acceso.'}
  const items=await db.rpc(supervisor?'inventario_comparacion_tarea':'inventario_productos_tarea',{p_ticket:ticket}).retry(false)
  if(items.error)return {error:'No se pudieron consultar los datos actuales. Tu borrador se conserva.'}
  // Do not combine product rows with a version read before a concurrent write.
  const check=await db.from('inventario_tickets').select('version').eq('id',ticket).single()
  if(check.error||check.data?.version!==current.data.version)return {error:'La tarea volvió a cambiar durante la consulta. Consulta de nuevo antes de guardar.'}
  return {task:current.data as Task,...(supervisor?{comparison:items.data??[]}:{products:items.data??[]})}
}
export async function updateInventory(input: unknown) {
  const parsed = update.safeParse(input)
  if (!parsed.success) return { error: 'Revisa la acción y el avance registrado.' }
  const p = parsed.data
  if(['verificar_cerrar','devolver'].includes(p.action)) {
    if(!p.note.trim())return {error:'Escribe la observación de revisión antes de continuar.'}
    return rpc('inventario_revisar_conteo',{p_ticket:p.ticket,p_version:p.version,p_accion:p.action,p_nota:p.note})
  }
  return rpc('inventario_actualizar', { p_ticket: p.ticket, p_version: p.version, p_accion: p.action, p_avance: p.progress, p_nota: p.note })
}
export async function getTaskEvents(ticket: string): Promise<{ events?: Event[]; error?: string }> {
  if (!z.string().uuid().safeParse(ticket).success) return { error: 'Tarea inválida' }
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Sesión requerida' }
  const task=await db.from('inventario_tickets').select('bodega_id').eq('id',ticket).single()
  const context=await db.rpc('inventario_contexto')
  if(task.error||context.error||!(context.data as Context)?.warehouses.some(w=>w.id===task.data?.bodega_id&&['lider','administrador'].includes(w.role)))return {error:'El historial está disponible únicamente para supervisión autorizada.'}
  const events: Event[] = []
  for (let offset = 0; ; offset += 500) {
    const page = await db.from('inventario_auditoria').select('id,actor_id,actor_rol,evento,motivo,created_at,destinatario_nombre,contexto,entidad_id,entidad_tipo,estado_anterior,estado_nuevo')
      .eq('ticket_id', ticket).order('created_at').order('id').range(offset, offset + 499)
    if (page.error) return { error: 'No se pudo cargar el historial' }
    events.push(...page.data)
    if (page.data.length < 500) break
  }
  return { events }
}
