'use server'
import {createClient as supabaseClient} from '@supabase/supabase-js'
import {revalidatePath} from 'next/cache'
import {z} from 'zod'
import {createClient} from '@/utils/supabase/server'
import {validateEvidenceImage,safeImageName,IMAGE_LIMIT} from './evidence-image.server'
import type {Context} from './types'
import type {EvidenceResult} from './evidence-types'
import {isVersionConflict} from './conflicts'

const bucket='inventario-evidencias',uuid=z.string().uuid()
function storageAdmin(){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!key)throw new Error('Las fotografías están pendientes de configuración en el servidor.')
  return supabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false,autoRefreshToken:false}})
}
async function access(ticket:string,edit=false){
  if(!uuid.safeParse(ticket).success)throw new Error('Inventario inválido.')
  const db=await createClient(),{data:{user}}=await db.auth.getUser()
  if(!user)throw new Error('Inicia sesión para continuar.')
  const {data:task,error}=await db.from('inventario_tickets').select('id,bodega_id,asignado_a,estado').eq('id',ticket).single()
  if(error||!task)throw new Error('No tienes acceso a este inventario.')
  if(edit){
    const context=await db.rpc('inventario_contexto')
    if(context.error||task.asignado_a!==user.id||!(context.data as Context)?.warehouses.some(w=>w.id===task.bodega_id&&w.role==='operador'))throw new Error('Solo el operador asignado puede editar evidencias.')
    if(task.estado!=='en_proceso')throw new Error('El inventario debe estar en proceso.')
  }
  return {db,user}
}
const message=(e:unknown)=>e instanceof Error?e.message:'No se pudo completar la operación.'
const refresh=()=>revalidatePath('/inventarios/registros')
export async function getEvidence(ticket:string):Promise<EvidenceResult>{
  try{
    const {db}=await access(ticket)
    const rows=await db.from('inventario_evidencias').select('id,usuario_id,nombre_original,estado,created_at,uploaded_at,storage_path').eq('ticket_id',ticket).eq('tipo_evidencia','conteo_operador').neq('estado','eliminado').order('created_at')
    if(rows.error){if(['42P01','PGRST205'].includes(rows.error.code))return {enabled:false,items:[],note:null};throw new Error('No se pudieron consultar las evidencias.')}
    const note=await db.from('inventario_observaciones_conteo').select('texto,version,usuario_id,updated_at').eq('ticket_id',ticket).maybeSingle()
    if(note.error)throw new Error('No se pudo consultar la observación.')
    const enabled=Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
    const admin=enabled?storageAdmin():null
    const items=await Promise.all(rows.data.map(async row=>{
      const {storage_path,...metadata}=row
      if(row.estado!=='vigente'||!admin)return {...metadata,url:null}
      const signed=await admin.storage.from(bucket).createSignedUrl(storage_path,300)
      if(signed.error)throw new Error('No se pudo abrir una fotografía. Vuelve a intentarlo.')
      return {...metadata,url:signed.data.signedUrl}
    }))
    return {enabled:true,uploadsEnabled:enabled,items,note:note.data}
  }catch(e){return {error:message(e)}}
}
export async function uploadEvidence(form:FormData):Promise<{error?:string;ok?:boolean}>{
  let reserved:{id:string;storage_path:string}|undefined
  let admin:ReturnType<typeof storageAdmin>|undefined
  try{
    const ticket=String(form.get('ticket')??''),id=String(form.get('id')??''),file=form.get('file')
    if(!uuid.safeParse(id).success||!(file instanceof File)||file.size>IMAGE_LIMIT)throw new Error('Selecciona una fotografía de hasta 5 MB.')
    const {db}=await access(ticket,true)
    admin=storageAdmin()
    let image:Awaited<ReturnType<typeof validateEvidenceImage>>
    try{image=await validateEvidenceImage(Buffer.from(await file.arrayBuffer()))}catch{throw new Error('La fotografía no es válida. Usa JPEG, PNG o WebP de hasta 5 MB y 24 megapíxeles.')}
    const reservation=await db.rpc('inventario_evidencia_editar',{p_ticket:ticket,p_id:id,p_accion:'reservar',p_nombre:safeImageName(file.name),p_hash:image.hash,p_bytes:image.body.length})
    if(reservation.error)throw new Error(['P0001','42501'].includes(reservation.error.code)?reservation.error.message:'No se pudo reservar el espacio para la fotografía.')
    if(reservation.data.estado==='vigente')return {ok:true}
    reserved=reservation.data
    const upload=await admin.storage.from(bucket).upload(reserved!.storage_path,image.body,{contentType:image.mime,upsert:false})
    if(upload.error)throw new Error('No se pudo subir la fotografía. Retira la carga pendiente y vuelve a intentarlo.')
    const confirm=await admin.rpc('inventario_evidencia_confirmar',{p_id:id,p_accion:'confirmar'})
    if(confirm.error)throw new Error('No se pudo confirmar la fotografía guardada.')
    refresh();return {ok:true}
  }catch(e){
    // Never report success until object and metadata agree. A failed cleanup keeps
    // the reservation/path visible for an explicit retry; no anonymous orphan.
    if(reserved&&admin){
      const current=await admin.from('inventario_evidencias').select('estado').eq('id',reserved.id).single()
      if(current.data?.estado==='vigente')return {ok:true}
      if(!current.error){
        const removal=await admin.storage.from(bucket).remove([reserved.storage_path])
        if(!removal.error)await admin.rpc('inventario_evidencia_confirmar',{p_id:reserved.id,p_accion:'retirar'})
      }
    }
    return {error:message(e)}
  }
}
export async function deleteEvidence(ticket:string,id:string):Promise<{error?:string;ok?:boolean}>{
  try{
    if(!uuid.safeParse(id).success)throw new Error('Evidencia inválida.')
    const {db}=await access(ticket,true),admin=storageAdmin()
    const prepared=await db.rpc('inventario_evidencia_editar',{p_ticket:ticket,p_id:id,p_accion:'eliminar',p_nombre:null,p_hash:null,p_bytes:null})
    if(prepared.error)throw new Error('No se pudo autorizar la eliminación.')
    if(prepared.data.estado==='eliminado')return {ok:true}
    const removed=await admin.storage.from(bucket).remove([prepared.data.storage_path])
    if(removed.error)throw new Error('No se pudo retirar el archivo. Reintenta eliminarlo.')
    const confirmed=await admin.rpc('inventario_evidencia_confirmar',{p_id:id,p_accion:'retirar'})
    if(confirmed.error)throw new Error('El archivo se retiró; reintenta para completar el registro.')
    refresh();return {ok:true}
  }catch(e){return {error:message(e)}}
}
export async function saveCountNote(ticket:string,text:string,version:number):Promise<{error?:string;ok?:boolean;conflict?:boolean}>{
  try{
    if(!z.string().max(2000).safeParse(text).success||!z.number().int().nonnegative().safeParse(version).success)throw new Error('Revisa la observación.')
    const {db}=await access(ticket,true)
    const result=await db.rpc('inventario_observacion_guardar',{p_ticket:ticket,p_texto:text,p_version:version}).retry(false)
    if(result.error)return {conflict:isVersionConflict(result.error),error:['P0001','42501','40001','PT409'].includes(result.error.code)?result.error.message:'No se pudo confirmar el guardado. Consulta la observación actual antes de reintentar.'}
    refresh();return {ok:true}
  }catch(e){return {error:message(e)}}
}
