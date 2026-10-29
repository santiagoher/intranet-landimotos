import type { Event, Task } from './types'
import { displayQuantity } from './quantity'

// Older assignments produced two audit rows in the same transaction. Present one
// business event without deleting evidence or hiding unrelated reference events.
export function readableHistory(events:Event[]):Event[] {
  const assignments=events.filter(e=>e.evento==='asignado')
  const assignmentFor=(e:Event)=>assignments.find(a=>a.actor_id===e.actor_id && a.created_at===e.created_at)
  return events.filter(e=>e.evento!=='referencia_registrada'||!assignmentFor(e)).map(e=>{
    if(e.evento!=='asignado')return e
    const extra=events.filter(r=>r.evento==='referencia_registrada'&&assignmentFor(r)?.id===e.id).map(r=>r.motivo).filter(Boolean)
    return {...e,contexto:[e.contexto,...extra].filter(Boolean).join('\n')||null}
  })
}
export function historyTitle(event:Event,recipient:string):string {
  if(event.evento==='producto_contado'){const change=quantityChange(event);return !change||change.before==='Sin conteo'?'Cantidad registrada':'Cantidad actualizada'}
  if(event.evento==='evidencia_adjunta')return 'Evidencia subida'
  if(event.evento==='evidencia_retirada')return 'Evidencia retirada'
  if(event.evento==='observacion_guardada')return event.motivo?.startsWith(' → ')?'Observación agregada':'Observación actualizada'
  if(event.evento==='verificado_cerrado_con_diferencias')return 'Inventario verificado y cerrado con diferencias'
  if(event.evento==='verificado_cerrado_sin_diferencias')return 'Inventario verificado y cerrado sin diferencias'
  if(event.evento==='asignado')return `Inventario creado y asignado a ${event.destinatario_nombre||recipient}`
  const labels:Record<string,string>={autoiniciado:'Inventario propio creado e iniciado',iniciar:'Conteo iniciado',avance:'Avance registrado',producto_contado:'Cantidad contada registrada',finalizar:'Conteo enviado a revisión',revisar:'Verificación iniciada',verificar:'Inventario verificado',diferencias:'Diferencias registradas',devolver:'Reconteo solicitado al operador',cerrar:'Inventario cerrado',cerrar_diferencias:'Inventario cerrado con diferencias confirmadas',referencia_registrada:'Referencia de inventario registrada',miembro_actualizado:'Integrante actualizado'}
  return labels[event.evento]??event.evento.replaceAll('_',' ')
}
export const historyRole:Record<string,string>={lider:'Líder',operador:'Operador',administrador:'Administración',sistema:'Sistema'}

export function quantityChange(event:Event) {
  if(event.evento!=='producto_contado')return null
  const match=event.motivo?.match(/^(.+):\s*(sin contar|\d+(?:\.\d+)?)\s*→\s*(\d+(?:\.\d+)?)$/i)
  return match ? {code:match[1],before:match[2].toLowerCase()==='sin contar'?'Sin conteo':displayQuantity(match[2]),after:displayQuantity(match[3])}:null
}
export type HistoryKind='Proceso'|'Conteo'|'Revisión'|'Evidencia'|'Observación'|'Sistema'
export function historyKind(event:Event):HistoryKind {
  if(event.evento.startsWith('evidencia_'))return 'Evidencia'
  if(event.evento==='observacion_guardada')return 'Observación'
  if(['producto_contado','avance'].includes(event.evento))return 'Conteo'
  if(['revisar','verificar','diferencias','devolver','cerrar_diferencias','verificado_cerrado_con_diferencias','verificado_cerrado_sin_diferencias'].includes(event.evento))return 'Revisión'
  if(['asignado','autoiniciado','iniciar','finalizar','cerrar','cancelar'].includes(event.evento))return 'Proceso'
  return 'Sistema'
}
export function groupHistory(events:Event[]):Event[][] {
  const groups:Event[][]=[]
  for(const event of readableHistory(events)) {
    const previous=groups.at(-1),first=previous?.[0]
    const gap=first?Date.parse(event.created_at)-Date.parse(first.created_at):NaN
    if(first&&first.evento==='producto_contado'&&event.evento===first.evento&&event.actor_id===first.actor_id&&event.actor_rol===first.actor_rol&&gap>=0&&gap<=300000)previous!.push(event)
    else groups.push([event])
  }
  return groups
}
export interface ProcessStep {key:string;label:string;status:'done'|'current'|'pending'|'skipped';actor:string|null;date:string|null}
// Reflect the current cycle. Earlier deliveries remain in the activity timeline.
export function inventoryProcess(task:Task,events:Event[]):ProcessStep[] {
  const last=(types:string[],source=events)=>source.filter(e=>types.includes(e.evento)).at(-1)
  const returned=last(['devolver']),cycle=returned?events.slice(events.indexOf(returned)+1):events
  const created=last(['asignado','autoiniciado']),started=last(['iniciar','autoiniciado'],cycle),sent=last(['finalizar'],cycle)
  const reviewed=last(['revisar','verificar','diferencias','verificado_cerrado_con_diferencias','verificado_cerrado_sin_diferencias'],cycle)
  const closed=last(['cerrar','cerrar_diferencias','verificado_cerrado_con_diferencias','verificado_cerrado_sin_diferencias'],cycle)
  const rank=({pendiente_asignacion:0,asignado:1,aceptado:1,en_proceso:2,enviado_verificacion:4,en_verificacion:4,verificado_sin_diferencias:5,verificado_con_diferencias:5,cerrado:6} as Record<string,number>)[task.estado]
  const status=(n:number):ProcessStep['status']=>rank===undefined?'pending':rank>n?'done':rank===n?'current':'pending'
  const step=(key:string,label:string,n:number,event:Event|undefined,actor:string|null,date:string|null):ProcessStep=>({key,label,status:status(n),actor:event?.actor_id??actor,date:event?.created_at??date})
  const steps=[step('created','Creado',0,created,task.creado_por??task.asignado_por??null,task.asignado_at)]
  steps.push({...step('assigned','Asignado',1,created,task.asignado_por??null,task.asignado_at),status:task.origen_creacion==='creado_por_operador'?'skipped':status(1)})
  if(returned)steps.push({key:'recount',label:'Reconteo solicitado',status:'done',actor:returned.actor_id,date:returned.created_at})
  steps.push(step('count',returned?'Nuevo conteo':'Conteo iniciado',2,started,!returned&&task.iniciado_at?task.asignado_a:null,returned?null:task.iniciado_at))
  steps.push(step('submitted','Conteo finalizado',3,sent,task.enviado_at?task.asignado_a:null,task.enviado_at))
  steps.push(step('review','Verificación',4,reviewed,task.verificacion_iniciada_at?task.lider_id:null,task.verificacion_iniciada_at))
  steps.push(step('closed',task.cierre_con_diferencias?'Cerrado con diferencias':task.estado==='cerrado'?'Verificado y cerrado':'Cierre',5,closed,task.cerrado_at?task.lider_id:null,task.cerrado_at))
  return steps
}
