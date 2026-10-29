import 'server-only'
import { createClient } from '@/utils/supabase/server'
import type { Context, OperationData, Task } from './types'
import { getAuthUser } from '@/utils/supabase/session.server'
import { selfStartEnabled, selfStartStatus, markSelfStartMissing, demoServerKey } from './features.server'
import { invalidSession } from '@/utils/supabase/auth-errors'

function loadError(status:number){return Object.assign(new Error('No se pudo validar el acceso al inventario.'),{status})}

export async function getOperationData(options: {reports?: boolean; signal?: AbortSignal; compact?:boolean} = {}): Promise<OperationData> {
  const db = await createClient()
  const { data: { user }, error: authError } = await getAuthUser()
  if(authError) throw loadError(invalidSession(authError)?401:503)
  if (!user) throw loadError(401)
  const signal=options.signal??new AbortController().signal
  const { data: context, error } = await db.rpc('inventario_contexto').abortSignal(signal)
  if (error || !context || context.userId !== user.id) throw loadError(error?.code==='42501'?403:503)
  if(options.reports && !context.globalAdmin && !context.warehouses.some((w:Context['warehouses'][number])=>w.role!=='operador'))throw loadError(403)
  // Paginate explicitly; PostgREST's row cap must never silently truncate a board.
  const categories = []
  const tasks:Task[] = []
  for (let offset = 0; ; offset += 500) {
    const page = await db.from('inventario_tickets').select('id,numero,bodega_id,categoria_id,asignado_a,asignado_por,lider_id,estado,prioridad,version,avance_parcial,asignado_at,iniciado_at,enviado_at,vencimiento_at,verificacion_iniciada_at,verificacion_finalizada_at,cerrado_at,observacion_inicial,total_productos,productos_contados,es_prueba,cierre_con_diferencias,justificacion_cierre')
      .eq('modo', 'categoria').order('id').range(offset, offset + 499).abortSignal(signal)
    if (page.error) throw new Error('No se pudieron cargar las tareas')
    tasks.push(...page.data)
    if (page.data.length < 500) break
  }
  // Poll only categories referenced by current tasks. Refresh the assignment
  // catalog separately; do not scan every authorized category every 30 seconds.
  const ids=[...new Set(tasks.map(t=>t.categoria_id))]
  const scopes:(string[]|null)[]=options.compact?Array.from({length:Math.ceil(ids.length/200)},(_,i)=>ids.slice(i*200,(i+1)*200)):[null]
  for(const ids of scopes)for(let offset=0;;offset+=500){
    let query=db.from('inventario_categorias').select('id,bodega_id,nombre').eq('activa',true).order('id').range(offset,offset+499)
    if(ids)query=query.in('id',ids)
    const page=await query.abortSignal(signal)
    if(page.error)throw new Error('No se pudieron cargar las categorías')
    categories.push(...page.data)
    if(page.data.length<500)break
  }
  let reconciliations=[]
  if(options.reports && (context as Context).warehouses.some(w=>w.role!=='operador')) {
    const summary=await db.rpc('inventario_resumen_conciliacion').abortSignal(signal)
    if(summary.error)throw new Error('No se pudo cargar el resumen de diferencias')
    reconciliations=summary.data ?? []
  }
  const status=selfStartStatus()
  const extra=selfStartEnabled()?await db.rpc('inventario_demo_contexto').setHeader('x-inventory-demo-key',demoServerKey()).abortSignal(signal):{data:null,error:null}
  // Rollout compatibility: only an absent RPC means a migration is pending.
  if(extra.error&&!['PGRST202','42883'].includes(extra.error.code))throw new Error('No se pudo validar la creación propia de inventarios')
  if(extra.error)markSelfStartMissing()
  if(extra.data?.tickets)for(const task of tasks){
    const meta=extra.data.tickets.find((t:{id:string})=>t.id===task.id)
    if(meta){task.origen_creacion=meta.origen_creacion;task.creado_por=meta.creado_por}
  }
  const notices=await db.from('inventario_notificaciones').select('id,ticket_id,tipo,created_at').order('created_at',{ascending:false}).limit(20).abortSignal(signal)
  if(notices.error)throw new Error('No se pudieron cargar las notificaciones de inventarios')
  return { context: context as Context, categories, catalogComplete:!options.compact, tasks, reconciliations, fetchedAt: Date.now(),
    selfStart:{enabled:extra.data?.enabled===true&&extra.data?.host===status.host,warehouses:extra.data?.warehouses??[],categories:extra.data?.categories??[],source:'demo',reason:selfStartStatus().reason||'La base de pruebas no ha sido validada para este destino.'},notifications:notices.data??[] }
}
