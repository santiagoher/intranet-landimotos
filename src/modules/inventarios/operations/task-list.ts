import type { Context, OperationData, Task } from './types'
import { progress } from './types'

export type Priority='alta'|'media'|'baja'
export type StoredPriority=Priority|'normal'|'urgente'
export const priorities:Priority[]=['alta','media','baja']
export const priorityLabels:Record<Priority,string>={alta:'Alta',media:'Media',baja:'Baja'}
export function normalizePriority(value:StoredPriority):Priority {return value==='urgente'?'alta':value==='normal'?'media':value}
// Compatible with the deployed RPC and the reviewed migration (which accepts this
// transitional alias and persists 'media'). No production migration is implied.
export const priorityForRpc=(value:Priority)=>value==='media'?'normal':value
export function assignedByName(task:Task,context:Context):string {
  if(task.origen_creacion==='creado_por_operador')return 'Autoiniciado'
  if(!task.asignado_por)return 'No registrado'
  return [...context.people,...context.members,...context.users].find(p=>p.id===task.asignado_por)?.name?.trim() || 'No registrado'
}
export function taskOrigin(task:Task):string {
  return task.origen_creacion==='creado_por_operador'?'Autoiniciado':'Asignado'
}
export type TaskSortKey='ticket'|'warehouse'|'author'|'state'|'priority'|'progress'|'date'
export interface TaskSort {key:TaskSortKey;direction:'asc'|'desc'}
export interface TaskFilters {search:string;state:string;priority:Priority|'';warehouse:string;origin?:''|'assigned'|'self'}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase()
export function operatorTasks(data:OperationData,filters:TaskFilters,sort:TaskSort):Task[] {
  const warehouseIds=new Set(data.context.warehouses.filter(w=>w.role==='operador').map(w=>w.id))
  const category=(t:Task)=>data.categories.find(c=>c.id===t.categoria_id)?.nombre??''
  const collation=new Intl.Collator('es',{numeric:true,sensitivity:'base'})
  const value=(t:Task):string|number=>{
    switch(sort.key){
      case 'ticket':return t.numero
      case 'warehouse':return data.context.warehouses.find(w=>w.id===t.bodega_id)?.name??''
      case 'author':return assignedByName(t,data.context)
      case 'state':return t.estado
      case 'priority':return priorities.indexOf(normalizePriority(t.prioridad))
      case 'progress':return progress(t)
      default:return Date.parse(t.asignado_at)
    }
  }
  return data.tasks.filter(t=>t.asignado_a===data.context.userId && warehouseIds.has(t.bodega_id)
    && (!filters.warehouse||t.bodega_id===filters.warehouse) && (!filters.state||t.estado===filters.state)
    && (!filters.priority||normalizePriority(t.prioridad)===filters.priority)
    && (!filters.origin||(filters.origin==='self'?t.origen_creacion==='creado_por_operador':t.origen_creacion!=='creado_por_operador'))
    && normalize(`${t.numero} ${category(t)}`).includes(normalize(filters.search.trim())))
    .sort((a,b)=>{
      const av=value(a),bv=value(b)
      const comparison=typeof av==='number'&&typeof bv==='number'?av-bv:collation.compare(String(av),String(bv))
      return comparison*(sort.direction==='asc'?1:-1)||a.id.localeCompare(b.id)
    })
}
