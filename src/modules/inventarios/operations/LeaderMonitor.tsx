'use client'

import { useState, type ReactNode } from 'react'
import { Activity, ArrowDownUp, CheckCheck, ChevronDown, ClipboardList, Clock3, Eye, LayoutGrid, List, PackageCheck, Plus, Search, ShieldCheck, SlidersHorizontal, TriangleAlert, Users, Warehouse, X } from 'lucide-react'
import { TablePagination } from '@/components/TablePagination'
import { formatInventoryDate } from '../types'
import { isOverdue, stateLabels, type OperationData, type Task } from './types'
import { TaskProgress, PriorityBadge, AssignmentAuthor } from './TaskPresentation'
import { TaskTable } from './TaskTable'
import { assignedByName, priorities, priorityLabels } from './task-list'
import { closedToday, emptyMonitorFilters, filterMonitorTasks, groupMonitorTasks, lastKnownActivity, monitoredTasks, monitorName, statusTone, type MonitorFilters, type MonitorSort, type MonitorView } from './monitor'
import './leader-monitor.css'

function InventoryCard({ task, data, onOpen, byOperator }: { task: Task; data: OperationData; onOpen: (id: string) => void; byOperator: boolean }) {
  const activity = lastKnownActivity(task, data)
  const category = data.categories.find(c => c.id === task.categoria_id)?.nombre ?? 'Categoría no disponible'
  return <article className="monitor-card">
    <div className="monitor-card-top"><span className="monitor-ticket">{task.numero}</span><PriorityBadge value={task.prioridad}/></div>
    <div><h3>{category}</h3><p className="monitor-warehouse"><Warehouse size={13} aria-hidden="true"/>{data.context.warehouses.find(w => w.id === task.bodega_id)?.name ?? 'Bodega'}</p></div>
    <div className="monitor-tags"><span className="monitor-badge" data-tone={statusTone(task.estado,task.cierre_con_diferencias)}>{task.cierre_con_diferencias ? 'Cerrado con diferencias' : stateLabels[task.estado] ?? task.estado}</span>{task.es_prueba && <span className="monitor-trial">DEMO · Prueba</span>}{task.origen_creacion === 'creado_por_operador' && <span className="monitor-trial">Autoiniciado</span>}</div>
    <dl className="monitor-people">
      {!byOperator && <div><dt>Operador</dt><dd><AssignmentAuthor name={monitorName(data,task.asignado_a)}/></dd></div>}
      <div><dt>Asignado por</dt><dd>{assignedByName(task,data.context)}</dd></div>
    </dl>
    <TaskProgress task={task}/>
    <div className="monitor-card-bottom"><dl className="monitor-dates"><div><dt>Asignación</dt><dd><time dateTime={task.asignado_at}>{formatInventoryDate(task.asignado_at)}</time></dd></div><div><dt title="Último hito o aviso disponible; no incluye cada guardado de conteo.">Actividad conocida</dt><dd><time dateTime={activity}>{formatInventoryDate(activity)}</time></dd></div></dl>
      <button type="button" className="monitor-detail" title="Ver detalle" aria-label={`Ver detalle ${task.numero}`} onClick={() => onOpen(task.id)}><Eye size={17} aria-hidden="true"/></button>
    </div>
  </article>
}

export function MonitorGroups({ tasks, data, mode, onOpen }: { tasks: Task[]; data: OperationData; mode: 'state' | 'operator'; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string,boolean>>({})
  const groups = [...groupMonitorTasks(tasks,mode)]
  return <div className="monitor-groups">{groups.map(([key,list]) => {
    const all = !!expanded[key]
    const active = list.filter(t => !['cerrado','cancelado'].includes(t.estado)).length
    return <details key={key} className="monitor-group" data-size={list.length === 1 ? 'small' : list.length === 2 ? 'medium' : 'wide'} open>
      <summary><span className="monitor-group-heading">{mode === 'operator' ? <span className="monitor-group-icon"><Users size={16}/></span> : <span className="monitor-state-dot" data-tone={statusTone(key)}/>}
        <h2>{mode === 'operator' ? monitorName(data,key === 'unassigned' ? null : key) : stateLabels[key] ?? key}</h2><span className="monitor-count">{list.length}</span></span>
        <span className="monitor-group-meta">{mode === 'operator' && <span>{active} en curso</span>}<ChevronDown size={16} aria-hidden="true"/></span></summary>
      <div className="monitor-group-body"><div className="monitor-card-grid">{(all ? list : list.slice(0,6)).map(task => <InventoryCard key={task.id} task={task} data={data} onOpen={onOpen} byOperator={mode === 'operator'}/>)}</div>
        {list.length > 6 && <button type="button" className="monitor-more" onClick={() => setExpanded(value => ({...value,[key]:!all}))}>{all ? 'Mostrar menos' : `Ver los ${list.length - 6} inventarios restantes`}</button>}
      </div>
    </details>
  })}</div>
}

export function LeaderMonitor({ data, now, onOpen, onAssign, onTeam, team }: { data: OperationData; now: number; onOpen: (id: string) => void; onAssign?: () => void; onTeam?: () => void; team?: ReactNode }) {
  const [filters,setFilters] = useState<MonitorFilters>(emptyMonitorFilters)
  const [view,setView] = useState<MonitorView>('state')
  const [sort,setSort] = useState<MonitorSort>('activity')
  const [page,setPage] = useState(1)
  const [mobileFilters,setMobileFilters] = useState(false)
  const allowed = monitoredTasks(data)
  const warehouses = data.context.warehouses.filter(w => data.context.globalAdmin || w.role !== 'operador')
  const operatorIds = [...new Set([...data.context.members.filter(m => m.role === 'operador' && warehouses.some(w => w.id === m.warehouseId) && (!filters.warehouse || m.warehouseId === filters.warehouse)).map(m => m.id),...allowed.filter(t => !filters.warehouse || t.bodega_id === filters.warehouse).flatMap(t => t.asignado_a ? [t.asignado_a] : [])])]
    .sort((a,b) => monitorName(data,a).localeCompare(monitorName(data,b),'es'))
  const tasks = filterMonitorTasks(data,filters,sort)
  const change = <K extends keyof MonitorFilters>(key: K, value: MonitorFilters[K]) => {setFilters(f => ({...f,[key]:value,...(key === 'warehouse' ? {operator:''} : {})}));setPage(1)}
  const filtered = Object.values(filters).some(Boolean)
  const review = tasks.filter(t => ['enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias'].includes(t.estado))
  const overdue = tasks.filter(t => isOverdue(t,now))
  const activeOperators = new Set(tasks.filter(t => t.estado === 'en_proceso' && t.asignado_a).map(t => t.asignado_a)).size
  const stats = [
    {label:'Asignados',value:tasks.filter(t => t.estado === 'asignado').length,icon:ClipboardList,tone:'neutral'},
    {label:'En proceso',value:tasks.filter(t => t.estado === 'en_proceso').length,icon:Activity,tone:'info'},
    {label:'Finalizado por operador',value:tasks.filter(t => t.estado === 'enviado_verificacion').length,icon:PackageCheck,tone:'info'},
    {label:'En verificación',value:tasks.filter(t => t.estado === 'en_verificacion').length,icon:ShieldCheck,tone:'warning'},
    {label:'Con diferencias',value:tasks.filter(t => t.estado === 'verificado_con_diferencias' || t.cierre_con_diferencias).length,icon:TriangleAlert,tone:'danger'},
    {label:'Cerrados hoy',value:closedToday(tasks,now),icon:CheckCheck,tone:'success'},
  ]
  const notices = (data.notifications ?? []).filter(n => tasks.some(t => t.id === n.ticket_id)).sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at))
  const pages = Math.max(1,Math.ceil(tasks.length/15)), current = Math.min(page,pages)
  return <div className="inventory-monitor">
    <header className="monitor-header"><div><p className="monitor-eyebrow">{data.context.globalAdmin ? 'Control global' : 'Supervisión de bodegas'}</p><h1 className="page-title">Monitoreo de inventarios</h1><p className="monitor-subtitle">{onAssign ? 'Asigna, acompaña y verifica el trabajo de tu equipo.' : 'Avance, responsables y resultados de las bodegas a tu alcance.'}</p></div><div className="monitor-header-actions">{onTeam && <button type="button" className="btn-secondary" onClick={onTeam}><Users size={16}/>Equipo y bodegas</button>}{onAssign && <button type="button" className="btn-primary" onClick={onAssign}><Plus size={16}/>Asignar inventario</button>}</div></header>
    {team}
    <dl className="monitor-stats" aria-label="Resumen de inventarios filtrados">{stats.map(({label,value,icon:Icon,tone}) => <div className="monitor-stat" key={label}><dt><span>{label}</span><span className="monitor-stat-icon" data-tone={tone}><Icon size={16}/></span></dt><dd>{value}</dd></div>)}</dl>
    <section className="monitor-toolbar" aria-label="Filtros de inventarios">
      <div className="monitor-search-row"><label className="monitor-search"><Search size={17} aria-hidden="true"/><input aria-label="Buscar inventarios" placeholder="Buscar ticket, categoría u operador…" value={filters.search} onChange={e => change('search',e.target.value)}/>{filters.search && <button type="button" aria-label="Borrar búsqueda" onClick={() => change('search','')}><X size={15}/></button>}</label><label className="monitor-sort"><ArrowDownUp size={15} aria-hidden="true"/><select aria-label="Ordenar inventarios" value={sort} onChange={e => {setSort(e.target.value as MonitorSort);setPage(1)}}><option value="activity">Última actividad conocida</option><option value="newest">Asignación más reciente</option><option value="oldest">Asignación más antigua</option></select></label></div>
      <button type="button" className="monitor-mobile-filter" aria-expanded={mobileFilters} aria-controls="monitor-filters" onClick={() => setMobileFilters(value => !value)}><SlidersHorizontal size={15}/>{mobileFilters ? 'Ocultar filtros' : 'Filtros'}{filtered && <span className="monitor-count">{Object.values(filters).filter(Boolean).length}</span>}<ChevronDown size={15}/></button>
      <div id="monitor-filters" className="monitor-filters" data-expanded={mobileFilters}>
        <select aria-label="Filtrar estado" value={filters.state} onChange={e => change('state',e.target.value)}><option value="">Todos los estados</option>{Object.entries(stateLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}<option value="differences">Todas las diferencias</option></select>
        <select aria-label="Filtrar prioridad" value={filters.priority} onChange={e => change('priority',e.target.value as MonitorFilters['priority'])}><option value="">Toda prioridad</option>{priorities.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select>
        <select aria-label="Filtrar operador" value={filters.operator} onChange={e => change('operator',e.target.value)}><option value="">Todos los operadores</option>{operatorIds.map(id => <option key={id} value={id}>{monitorName(data,id)}</option>)}<option value="unassigned">Sin asignar</option></select>
        <select aria-label="Filtrar bodega" value={filters.warehouse} onChange={e => change('warehouse',e.target.value)}><option value="">Todas mis bodegas</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select aria-label="Filtrar origen" value={filters.origin} onChange={e => change('origin',e.target.value)}><option value="">Todos los orígenes</option><option value="trial">Solo pruebas</option><option value="report">Excluir pruebas</option></select>
        {filtered && <button type="button" className="monitor-clear" onClick={() => {setFilters(emptyMonitorFilters);setPage(1)}}><X size={14}/>Limpiar</button>}
      </div>
    </section>
    <div className="monitor-signals"><span><span className="monitor-live-dot"/>{activeOperators} {activeOperators === 1 ? 'operador contando' : 'operadores contando'}</span><span><ShieldCheck size={15}/>{review.length} por revisar o cerrar</span>{overdue.length > 0 && <span className="monitor-overdue"><Clock3 size={15}/>{overdue.length} con fecha vencida</span>}<span className="monitor-refresh">Actualización cada 30 s</span></div>
    {(review.length > 0 || notices.length > 0 || overdue.length > 0) && <details className="monitor-attention"><summary><span><Activity size={16}/>Atención y actividad reciente</span><ChevronDown size={15}/></summary><div className="monitor-attention-body">{review.length > 0 && <div><h2>Pendientes de revisión</h2><ul>{review.slice(0,3).map(t => <li key={t.id}><button type="button" onClick={() => onOpen(t.id)}><strong>{t.numero}</strong><span>{monitorName(data,t.asignado_a)} · {stateLabels[t.estado]}</span><Eye size={14}/></button></li>)}</ul>{review.length > 3 && <p>{review.length-3} más en los grupos de revisión.</p>}</div>}{overdue.length > 0 && <div><h2>Con fecha vencida</h2><ul>{overdue.slice(0,3).map(t => <li key={t.id}><button type="button" onClick={() => onOpen(t.id)}><strong>{t.numero}</strong><span>{formatInventoryDate(t.vencimiento_at)}</span><Eye size={14}/></button></li>)}</ul></div>}{notices.length > 0 && <div><h2>Avisos recientes</h2><ul>{notices.slice(0,5).map(n => <li key={n.id}><button type="button" onClick={() => onOpen(n.ticket_id)}><strong>{tasks.find(t => t.id === n.ticket_id)?.numero}</strong><span>{n.tipo === 'iniciado' ? 'Inventario iniciado' : n.tipo === 'verificacion_pendiente' ? 'Conteo pendiente de revisión' : n.tipo.replaceAll('_',' ')} · {formatInventoryDate(n.created_at)}</span><Eye size={14}/></button></li>)}</ul></div>}</div></details>}
    <div className="monitor-viewbar"><p role="status">{tasks.length} {tasks.length === 1 ? 'inventario' : 'inventarios'}{filtered ? ' · filtros aplicados' : ''}</p><div className="monitor-views" role="group" aria-label="Vista de inventarios">{([{id:'state',label:'Por estado',icon:LayoutGrid},{id:'operator',label:'Por operador',icon:Users},{id:'table',label:'Tabla',icon:List}] as const).map(({id,label,icon:Icon}) => <button type="button" key={id} aria-pressed={view === id} onClick={() => {setView(id);setPage(1)}}><Icon size={15}/><span>{label}</span></button>)}</div></div>
    <div key={`${view}:${JSON.stringify(filters)}:${sort}`} className="monitor-content">{!tasks.length ? <div className="monitor-empty"><ClipboardList size={28}/><h2>{allowed.length ? 'Sin inventarios para estos filtros' : 'Aún no hay inventarios en este alcance'}</h2><p>{allowed.length ? 'Prueba otra búsqueda o limpia los filtros.' : 'Los inventarios de tus bodegas aparecerán aquí.'}</p>{filtered && <button className="btn-secondary" onClick={() => setFilters(emptyMonitorFilters)}>Limpiar filtros</button>}</div> : view === 'table' ? <div className="monitor-table"><TaskTable data={data} tasks={tasks.slice((current-1)*15,current*15)} onOpen={onOpen} supervisor/><TablePagination currentPage={current} totalPages={pages} totalItems={tasks.length} pageSize={15} onPageChange={setPage}/></div> : <MonitorGroups data={data} tasks={tasks} mode={view} onOpen={onOpen}/>}</div>
    <p className="monitor-footnote">Actividad conocida: último hito o aviso disponible, no cada guardado de conteo. Las tareas de prueba no modifican existencias.</p>
  </div>
}
