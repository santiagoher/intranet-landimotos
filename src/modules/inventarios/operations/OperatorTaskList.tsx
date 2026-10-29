'use client'
import { useState } from 'react'
import { TablePagination } from '@/components/TablePagination'
import { inventoryFieldClass as field } from '../components/InventoryPrimitives'
import { stateLabels, type OperationData } from './types'
import { operatorTasks, priorities, priorityLabels, type TaskFilters, type TaskSort, type TaskSortKey } from './task-list'
import { TaskTable } from './TaskTable'
import {Search,ClipboardList,Clock3,CheckCheck,MessageSquareWarning,SlidersHorizontal} from 'lucide-react'
import './operator-experience.css'

export function OperatorTaskList({data,onOpen}:{data:OperationData;onOpen:(id:string)=>void}) {
  const [filters,setFilters]=useState<TaskFilters>({search:'',state:'',priority:'',warehouse:''})
  const [sort,setSort]=useState<TaskSort>({key:'date',direction:'desc'})
  const [page,setPage]=useState(1)
  const tasks=operatorTasks(data,filters,sort)
  const all=operatorTasks(data,{search:'',state:'',priority:'',warehouse:''},sort)
  const stats=[{label:'Pendientes',value:all.filter(t=>['asignado','aceptado','pendiente_asignacion'].includes(t.estado)).length,icon:ClipboardList,tone:'info'},
    {label:'En proceso',value:all.filter(t=>t.estado==='en_proceso').length,icon:Clock3,tone:'info'},
    {label:'Finalizados',value:all.filter(t=>['enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias','cerrado'].includes(t.estado)).length,icon:CheckCheck,tone:'success'},
    {label:'Con diferencias',value:all.filter(t=>t.cierre_con_diferencias||t.estado==='verificado_con_diferencias').length,icon:MessageSquareWarning,tone:'warning'}]
  const warehouses=data.context.warehouses.filter(w=>w.role==='operador')
  const pages=Math.max(1,Math.ceil(tasks.length/15)),current=Math.min(page,pages)
  function filter(patch:Partial<TaskFilters>){setFilters(previous=>({...previous,...patch}));setPage(1)}
  function order(key:TaskSortKey){setSort(previous=>({key,direction:previous.key===key&&previous.direction==='asc'?'desc':'asc'}));setPage(1)}
  return <section className="inventory-operator space-y-5 pb-6">
    <header><h1 className="page-title">Mis inventarios</h1><p className="mt-2 text-sm text-muted">Abre una tarea para iniciar, continuar o consultar tu conteo.</p></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de mis inventarios">{stats.map(({label,value,icon:Icon,tone})=><div key={label} className="inv-stat inv-enter"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-secondary">{label}</span><span data-tone={tone} className="rounded-lg p-2"><Icon className="size-4" aria-hidden="true"/></span></div><p className="inv-stat-value mt-2">{value}</p></div>)}</div>
    <div className="inv-panel"><div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-semibold text-secondary"><SlidersHorizontal className="size-4" aria-hidden="true"/>Busca y organiza tus tareas</div><div className="inv-toolbar">
      <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted"/><input aria-label="Buscar tickets o categorías" placeholder="Buscar ticket o categoría…" className={`${field} pl-10`} value={filters.search} onChange={e=>filter({search:e.target.value})}/></div>
      <select aria-label="Filtrar estado" className={`${field} xl:w-52`} value={filters.state} onChange={e=>filter({state:e.target.value})}><option value="">Todos los estados</option>{Object.entries(stateLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      <select aria-label="Filtrar origen" className={`${field} xl:w-44`} value={filters.origin??''} onChange={e=>filter({origin:e.target.value as TaskFilters['origin']})}><option value="">Todos los orígenes</option><option value="assigned">Asignados</option><option value="self">Autoiniciados</option></select>
      <select aria-label="Filtrar prioridad" className={`${field} xl:w-40`} value={filters.priority} onChange={e=>filter({priority:e.target.value as TaskFilters['priority']})}><option value="">Toda prioridad</option>{priorities.map(p=><option key={p} value={p}>{priorityLabels[p]}</option>)}</select>
      <select aria-label="Ordenar por fecha" className={`${field} xl:w-44`} value={sort.key==='date'?sort.direction:''} onChange={e=>{setSort({key:'date',direction:e.target.value as TaskSort['direction']});setPage(1)}}><option value="" disabled>Orden por columna</option><option value="desc">Más recientes</option><option value="asc">Más antiguas</option></select>
      {warehouses.length>1&&<select aria-label="Filtrar bodega" className={`${field} xl:w-48`} value={filters.warehouse} onChange={e=>filter({warehouse:e.target.value})}><option value="">Todas mis bodegas</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}
    </div></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-secondary">{tasks.length} tareas</p><p className="flex items-center gap-1.5 text-xs text-muted"><Clock3 className="size-3" aria-hidden="true"/>Actualización cada 30 s</p></div>
    {tasks.length?<TaskTable data={data} tasks={tasks.slice((current-1)*15,current*15)} onOpen={onOpen} sort={sort} onSort={order}/>:<div className="rounded-xl border border-dashed border-border p-8 text-center"><p className="font-medium">Sin tareas en este alcance</p><p className="mt-2 text-sm text-muted">Aquí aparecerán tus inventarios asignados. Revisa los filtros si no encuentras una tarea.</p></div>}
    <TablePagination currentPage={current} totalPages={pages} totalItems={tasks.length} pageSize={15} onPageChange={setPage}/>
  </section>
}
