import { progress, stateLabels, type Task } from './types'
import { normalizePriority, priorityLabels, type StoredPriority } from './task-list'

export function TaskProgress({task}:{task:Task}) {
  const value=progress(task)
  const label=task.total_productos?`${task.productos_contados??0} / ${task.total_productos} productos`:'Progreso por etapas'
  return <div className="min-w-36 space-y-2"><div className="flex items-baseline justify-between gap-3 text-xs text-muted"><span className="inv-progress-label">{label}</span><span className="inv-progress-percent tabular-nums">{value} %</span></div>
    <div role="progressbar" aria-label={task.total_productos?'Progreso del conteo':'Progreso por etapas'} aria-valuetext={`${label}: ${value} %`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="inv-progress-track h-1.5 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-blue-500 transition-[width] duration-300 motion-reduce:transition-none" style={{width:`${value}%`}}/></div></div>
}
export function TaskStatus({state,differences=false}:{state:string;differences?:boolean}) {
  const style=differences||state==='verificado_con_diferencias'?'bg-amber-500/10 text-amber-800 dark:text-amber-200'
    :['cerrado','verificado_sin_diferencias'].includes(state)?'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
    :state==='asignado'||state==='cancelado'?'bg-subtle text-secondary':'bg-blue-500/10 text-blue-800 dark:text-blue-200'
  const tone=differences||state==='verificado_con_diferencias'?'warning':['cerrado','verificado_sin_diferencias'].includes(state)?'success':['asignado','cancelado'].includes(state)?'neutral':'info'
  return <span data-tone={tone} className={`inv-badge badge ${style}`}>{differences?'Cerrado con diferencias':stateLabels[state]??state}</span>
}
export function PriorityBadge({value}:{value:StoredPriority}) {
  const priority=normalizePriority(value)
  const style=priority==='alta'?'bg-red-500/10 text-red-800 dark:text-red-200':priority==='media'?'bg-amber-500/10 text-amber-800 dark:text-amber-200':'bg-subtle text-secondary'
  return <span data-tone={priority==='alta'?'danger':priority==='media'?'warning':'neutral'} className={`inv-badge badge ${style}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>{priorityLabels[priority]}</span>
}
export function AssignmentAuthor({name}:{name:string}) {
  const parts=name.trim().split(/\s+/)
  const initials=name==='No registrado'?'—':`${parts[0]?.[0]??''}${parts.length>1?parts[parts.length-1][0]:''}`.toUpperCase()
  return <span className="inv-author flex items-center gap-2"><span aria-hidden="true" className="inv-avatar flex size-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[10px] font-semibold text-blue-800 dark:text-blue-200">{initials}</span><span className="max-w-44 break-words text-xs leading-5">{name}</span></span>
}
