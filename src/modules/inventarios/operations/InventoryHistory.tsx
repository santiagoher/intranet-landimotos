'use client'

import {Check, Circle, ClipboardList, PackageCheck, RotateCcw, Image as ImageIcon, MessageSquare, ShieldCheck, Settings2, ChevronRight, Clock3} from 'lucide-react'
import type {Event,Task} from './types'
import {stateLabels} from './types'
import {formatInventoryDate} from '../types'
import {groupHistory,historyKind,historyRole,historyTitle,inventoryProcess,quantityChange,type HistoryKind} from './history'

const kinds:Record<HistoryKind,{icon:typeof Check;tone:string}>={
  Proceso:{icon:ClipboardList,tone:'bg-accent-soft text-accent-foreground'},
  Conteo:{icon:PackageCheck,tone:'bg-success-soft text-success'},
  Revisión:{icon:ShieldCheck,tone:'bg-warning-soft text-warning'},
  Evidencia:{icon:ImageIcon,tone:'bg-info-soft text-info'},
  Observación:{icon:MessageSquare,tone:'bg-accent-soft text-accent-foreground'},
  Sistema:{icon:Settings2,tone:'bg-subtle text-muted'},
}
function EventContent({event,onEvidence}:{event:Event;onEvidence:(id:string)=>void}) {
  const change=quantityChange(event)
  const description=event.evento==='observacion_guardada'&&event.motivo?.startsWith(' → ')?event.motivo.slice(3):event.motivo
  return <div className="mt-3 space-y-3 text-sm">
    {change?<div className="rounded-lg bg-subtle p-3"><p className="break-words font-medium">Producto: {change.code}</p><dl className="mt-2 grid grid-cols-2 gap-3"><div><dt className="text-xs text-muted">Antes</dt><dd className="mt-1 break-all tabular-nums">{change.before}</dd></div><div><dt className="text-xs text-muted">Ahora</dt><dd className="mt-1 break-all font-semibold tabular-nums">{change.after}</dd></div></dl></div>
      :description&&<blockquote className="whitespace-pre-wrap break-words rounded-lg border-l-2 border-border bg-subtle px-3 py-2">{description}</blockquote>}
    {event.contexto&&<p className="whitespace-pre-wrap break-words text-xs text-muted">{event.contexto}</p>}
    {event.estado_nuevo&&<p className="flex flex-wrap items-center gap-1.5 text-xs text-muted"><span>Estado:</span>{event.estado_anterior&&<><span>{stateLabels[event.estado_anterior]??event.estado_anterior}</span><ChevronRight aria-hidden="true" className="size-3"/></>}<span className="font-medium text-foreground">{stateLabels[event.estado_nuevo]??event.estado_nuevo}</span></p>}
    {event.evento==='evidencia_adjunta'&&event.entidad_id&&<button type="button" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent" onClick={()=>onEvidence(event.entidad_id!)}><ImageIcon aria-hidden="true" className="size-4"/>Abrir evidencia</button>}
    {event.evento==='evidencia_retirada'&&<p className="text-xs text-muted">La fotografía fue retirada. Se conserva el registro de la acción.</p>}
  </div>
}
export function InventoryHistory({task,events,loading,error,name,warehouse,category,admin,onEvidence}:{task:Task;events:Event[];loading:boolean;error?:string;name:(id:string|null)=>string;warehouse:string;category:string;admin:boolean;onEvidence:(id:string)=>void}) {
  const groups=groupHistory(events),steps=inventoryProcess(task,events)
  return <section aria-label="Historial de cambios" className="min-w-0 space-y-6 border-t border-border pt-5">
    <div><h3 className="text-base font-semibold">Historial de cambios</h3><p className="mt-1 text-xs text-muted">Seguimiento del proceso y actividad registrada.</p></div>
    {loading?<p role="status" className="rounded-xl bg-subtle p-4 text-sm text-muted">Cargando historial…</p>:error?<p role="alert" className="rounded-xl border border-border p-4 text-sm text-danger">{error}</p>:<>
      <section aria-label="Proceso del inventario" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Proceso del inventario</h4><span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-foreground">{task.estado==='cerrado'&&task.cierre_con_diferencias?'Cerrado con diferencias':stateLabels[task.estado]??task.estado}</span></div>
        <p className="mt-2 break-words text-xs text-muted">{task.numero} · {warehouse} · {category}</p>
        <p className="mt-1 break-words text-xs text-muted">Operador: {name(task.asignado_a)} · Líder responsable: {name(task.lider_id)}</p>
        <ol className="mt-5 grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">{steps.map(step=>{
          const Icon=step.key==='recount'?RotateCcw:step.status==='done'?Check:step.status==='current'?Clock3:Circle
          const tone=step.status==='done'?'bg-success-soft text-success':step.status==='current'?'bg-accent-soft text-accent-foreground':'bg-subtle text-muted'
          return <li key={step.key} aria-current={step.status==='current'?'step':undefined} className="relative flex min-w-0 gap-3 pb-5 before:absolute before:bottom-0 before:left-4 before:top-8 before:w-px before:bg-border last:before:hidden sm:before:hidden">
            <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon aria-hidden="true" className="size-4"/></span>
            <div className="min-w-0 pt-0.5"><p className="text-sm font-medium">{step.label}</p><p className={`mt-0.5 text-[11px] ${step.status==='current'?'font-semibold text-accent-foreground':'text-muted'}`}>{({done:'Completado',current:'Etapa actual',pending:'Pendiente',skipped:'No aplica · inventario propio'})[step.status]}</p>
              {step.status!=='skipped'&&step.status!=='pending'&&<>{step.actor&&<p className="mt-1 break-words text-xs">{name(step.actor)}</p>}{step.date&&<time dateTime={step.date} className="mt-0.5 block text-[11px] text-muted">{formatInventoryDate(step.date)}</time>}</>}
            </div>
          </li>
        })}</ol>
        {task.estado==='enviado_verificacion'&&<p className="rounded-lg bg-subtle p-3 text-xs text-muted">El operador entregó el conteo. Pendiente de revisión y decisión del líder.</p>}
        {task.estado==='verificado_con_diferencias'&&<p className="rounded-lg bg-warning-soft p-3 text-xs text-warning">Hay diferencias registradas. El líder debe verificar y cerrar o solicitar un reconteo.</p>}
      </section>
      <section aria-label="Actividad en la app">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2"><h4 className="text-sm font-semibold">Actividad en la app</h4><span className="text-xs text-muted">Orden cronológico · {events.length} registros de auditoría</span></div>
        {!groups.length?<p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">Sin actividad registrada en este historial.</p>:<ol className="space-y-4">{groups.map(group=>{
          const first=group[0],kind=historyKind(first),{icon:Icon,tone}=kinds[kind],grouped=group.length>1
          return <li key={first.id} className="relative flex min-w-0 gap-2.5 sm:gap-3 before:absolute before:bottom-[-1rem] before:left-4 before:top-8 before:w-px before:bg-border last:before:hidden">
            <span className={`relative z-10 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}><Icon aria-hidden="true" className="size-4"/></span>
            <article className="min-w-0 flex-1 rounded-xl border border-border bg-surface p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><h5 className="min-w-0 break-words text-sm font-semibold">{grouped?`Conteo de productos · ${group.length} cambios`:historyTitle(first,name(task.asignado_a))}</h5><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{kind}</span></div>
              <p className="mt-1.5 break-words text-xs">{first.actor_id?name(first.actor_id):'Sistema'} <span className="text-muted">· {historyRole[first.actor_rol]??first.actor_rol}</span></p>
              <time dateTime={first.created_at} className="mt-1 block text-[11px] text-muted">{formatInventoryDate(first.created_at)}{grouped&&` — ${formatInventoryDate(group[group.length-1].created_at)}`}</time>
              {grouped?<details className="mt-3 rounded-lg bg-subtle p-3"><summary className="cursor-pointer text-xs font-medium">Ver {group.length} cambios de cantidades</summary><ol className="mt-3 space-y-4">{group.map(event=><li key={event.id} className="border-t border-border pt-3"><p className="text-xs font-medium">{historyTitle(event,name(task.asignado_a))}</p><time dateTime={event.created_at} className="text-[11px] text-muted">{formatInventoryDate(event.created_at)}</time><EventContent event={event} onEvidence={onEvidence}/>{admin&&<p className="mt-2 break-all text-[10px] text-muted">Registro: {event.id} · {event.evento}</p>}</li>)}</ol></details>:<EventContent event={first} onEvidence={onEvidence}/>}
              {admin&&<details className="mt-3 border-t border-border pt-2"><summary className="cursor-pointer text-[11px] text-muted">Datos del registro</summary><pre className="mt-2 whitespace-pre-wrap break-all text-[10px] text-muted">{JSON.stringify(events.filter(e=>group.some(g=>g.id===e.id||(g.evento==='asignado'&&e.evento==='referencia_registrada'&&e.actor_id===g.actor_id&&e.created_at===g.created_at))),null,2)}</pre></details>}
            </article>
          </li>
        })}</ol>}
      </section>
    </>}
  </section>
}
