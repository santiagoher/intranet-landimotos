import { formatInventoryDate } from '../types'
import type { OperationData, Task } from './types'
import { assignedByName, taskOrigin, type TaskSort, type TaskSortKey } from './task-list'
import { AssignmentAuthor, PriorityBadge, TaskProgress, TaskStatus } from './TaskPresentation'
import {Eye,Play,ArrowRight} from 'lucide-react'

export function TaskTable({data,tasks,onOpen,supervisor=false,sort,onSort}:{data:OperationData;tasks:Task[];onOpen:(id:string)=>void;supervisor?:boolean;sort?:TaskSort;onSort?:(key:TaskSortKey)=>void}) {
  const category=(t:Task)=>data.categories.find(c=>c.id===t.categoria_id)?.nombre??'Categoría'
  const warehouse=(t:Task)=>data.context.warehouses.find(w=>w.id===t.bodega_id)?.name??'Bodega'
  const operator=(t:Task)=>[...data.context.people,...data.context.members].find(p=>p.id===t.asignado_a)?.name??'Sin asignar'
  const action=(t:Task)=>{
    const label=!supervisor&&t.estado==='asignado'?'Iniciar':!supervisor&&t.estado==='en_proceso'?'Continuar':'Ver detalle'
    const Icon=label==='Iniciar'?Play:label==='Continuar'?ArrowRight:Eye
    return <button className={`${supervisor?'btn-secondary':'inv-action'} whitespace-nowrap`} data-primary={label!=='Ver detalle'} onClick={()=>onOpen(t.id)} aria-label={`${label} ${t.numero}`} title={`${label} ${t.numero}`}><Icon aria-hidden="true" className="size-4"/>{label==='Ver detalle'?<span className="sr-only">Ver detalle</span>:label}</button>
  }
  const date=(t:Task)=>{const [day,...time]=formatInventoryDate(t.asignado_at).split(',');return <time dateTime={t.asignado_at} className="block whitespace-nowrap text-xs"><span className="block font-medium">{day}</span><span className="mt-1 block text-muted">{time.join(',').trim()}</span></time>}
  const columns:[TaskSortKey,string][]=[['ticket','Ticket / Categoría'],['warehouse','Bodega'],['author','Asignado por'],['state','Estado'],['priority','Prioridad'],['progress','Avance'],['date','Fecha de asignación']]
  return <>
    <div className="inv-table-shell hidden overflow-x-auto rounded-xl border border-border bg-surface md:block"><table className="data-table w-full min-w-[1050px]">
      <thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort?.key===key?(sort.direction==='asc'?'ascending':'descending'):undefined}>{onSort?<button className="flex items-center gap-2 whitespace-nowrap" onClick={()=>onSort(key)}>{label}<span aria-hidden="true">{sort?.key===key?(sort.direction==='asc'?'↑':'↓'):'↕'}</span></button>:label}</th>)}{supervisor&&<th scope="col">Asignado a</th>}<th scope="col">Acciones</th></tr></thead>
      <tbody>{tasks.map(t=><tr key={t.id} className="transition-colors hover:bg-subtle"><td><span className="inv-ticket font-medium">{t.numero}</span><span className="mt-1 block max-w-48 text-xs text-secondary">{category(t)}</span><span className="inv-tag text-xs text-muted">{taskOrigin(t)}</span>{t.es_prueba&&<span className="inv-tag text-xs text-muted">DEMO · Prueba</span>}</td><td><span className="whitespace-nowrap text-xs font-semibold">{warehouse(t)}</span></td><td><AssignmentAuthor name={assignedByName(t,data.context)}/></td><td><TaskStatus state={t.estado} differences={t.cierre_con_diferencias}/></td><td><PriorityBadge value={t.prioridad}/></td><td className="min-w-44"><TaskProgress task={t}/></td><td>{date(t)}</td>{supervisor&&<td>{operator(t)}</td>}<td>{action(t)}</td></tr>)}</tbody>
    </table></div>
    <div className="space-y-3 md:hidden">{tasks.map(t=><article key={t.id} className="inv-panel inv-enter space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{t.numero}</h2><p className="mt-1 text-xs text-muted">{category(t)} · {warehouse(t)}</p></div><PriorityBadge value={t.prioridad}/></div>
      <p className="text-xs text-muted">{taskOrigin(t)}</p><TaskStatus state={t.estado} differences={t.cierre_con_diferencias}/><div><p className="mb-1 text-xs text-muted">Asignado por</p><AssignmentAuthor name={assignedByName(t,data.context)}/></div>{supervisor&&<p className="text-xs">Asignado a: {operator(t)}</p>}<TaskProgress task={t}/>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">{formatInventoryDate(t.asignado_at)}{t.es_prueba?' · Prueba':''}</p>{action(t)}</div>
    </article>)}</div>
  </>
}
