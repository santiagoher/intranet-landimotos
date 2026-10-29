'use client'

import Link from 'next/link'
import { useInventoryMonitor } from './useInventoryMonitor'
import type { OperationData } from './types'

export function InventoryOverview({data:initialData}:{data:OperationData}) {
  const monitor=useInventoryMonitor(initialData),data=monitor.data
  if(monitor.blocked)return <div role="alert"><p>{monitor.error}</p><button className="btn-secondary" onClick={()=>window.location.reload()}>Verificar acceso</button></div>
  const supervisor=data.context.warehouses.some(w=>w.role!=='operador')
  const tasks=data.tasks
  const review=tasks.filter(t=>['enviado_verificacion','en_verificacion','verificado_con_diferencias'].includes(t.estado)).length
  const stats=[['Tareas',tasks.length],['Asignadas',tasks.filter(t=>t.estado==='asignado').length],['En proceso',tasks.filter(t=>t.estado==='en_proceso').length],['Por revisar o resolver',review],['Cerradas',tasks.filter(t=>t.estado==='cerrado').length],['De prueba',tasks.filter(t=>t.es_prueba).length]]
  return <div className="space-y-6"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="page-title">Vista general de inventarios</h1><p className="mt-2 text-sm text-muted">Avance y estado de las tareas en tus bodegas autorizadas.</p></div>
    <Link className="btn-primary" href="/inventarios/registros">{supervisor?'Ver tareas de inventario':'Ver mis inventarios'}</Link></header>
    {monitor.error&&<p role="status">{monitor.error}<button className="btn-secondary ml-2" onClick={monitor.retry}>Reintentar</button></p>}
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-3">{stats.map(([label,value])=><div key={label} className="rounded-xl border border-border bg-surface p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>
    <section className="overflow-x-auto rounded-xl border border-border bg-surface"><table className="data-table"><caption className="p-5 text-left font-medium">Estado por bodega</caption><thead><tr><th>Bodega</th><th>Tareas</th><th>En proceso</th><th>Por resolver diferencias</th><th>Cerradas</th></tr></thead>
      <tbody>{data.context.warehouses.map(w=>{const list=tasks.filter(t=>t.bodega_id===w.id);return <tr key={w.id}><td>{w.name}</td><td>{list.length}</td><td>{list.filter(t=>t.estado==='en_proceso').length}</td><td>{list.filter(t=>t.estado==='verificado_con_diferencias').length}</td><td>{list.filter(t=>t.estado==='cerrado').length}</td></tr>})}</tbody></table>
      {!data.context.warehouses.length&&<p className="p-5 text-sm text-muted">No hay bodegas vinculadas a tu acceso.</p>}</section>
    <p className="text-xs text-muted">Incluye tareas de prueba, identificadas por separado en el tablero. Actualización cada 30 segundos.</p>
  </div>
}
