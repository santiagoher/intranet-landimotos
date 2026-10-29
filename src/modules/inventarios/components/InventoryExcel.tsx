'use client'

import { useState } from 'react'
import { TablePagination } from '@/components/TablePagination'
import { categoryStatus, type HistoricalInventory } from '../local/model'
import { inventoryFieldClass, InventoryTabs } from './InventoryPrimitives'

const tabs = [{ id: 'history', label: 'Historial del Excel' }, { id: 'control', label: 'Control por categoría' }]
const states = ['Al día', 'Por realizar', 'Crítico', 'Sin inventario', 'Fecha por revisar']
const styles: Record<string, string> = {
  'Al día': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  'Por realizar': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  'Crítico': 'bg-red-500/10 text-red-700 dark:text-red-300',
}
const displayDate = (value: string | null) => value ? value.split('-').reverse().join('/') : 'Sin fecha'

export function InventoryExcel({ data, today, reports = false }: { data: HistoricalInventory; today: string; reports?: boolean }) {
  const [warehouseName, setWarehouseName] = useState(data.warehouses[0]?.name ?? '')
  const [tab, setTab] = useState(reports ? 'control' : 'history')
  const [search, setSearch] = useState('')
  const [responsible, setResponsible] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const warehouse = data.warehouses.find(w => w.name === warehouseName)
  if (!warehouse) return null
  const query = search.trim().toLocaleLowerCase('es')
  const records = warehouse.records.filter(r => r.category.toLocaleLowerCase('es').includes(query)
    && (!responsible || r.responsible === responsible)
    && (!from || !!r.date && r.date >= from) && (!to || !!r.date && r.date <= to))
  const categories = warehouse.categories.filter(c => c.name.toLocaleLowerCase('es').includes(query)
    && (!status || categoryStatus(c.lastDate, today) === status))
  const total = tab === 'history' ? records.length : categories.length
  const pages = Math.max(1, Math.ceil(total / 15))
  const current = Math.min(page, pages)
  const offset = (current - 1) * 15
  function change(setter: (v: string) => void, value: string) { setter(value); setPage(1) }
  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="page-title">{reports ? 'Control de inventarios' : 'Registros de inventarios'}</h1>
        <p className="mt-2 text-sm text-muted">Historial por categoría de las bodegas del Excel.</p>
      </header>
      <aside className="rounded-xl border border-border bg-subtle p-4 text-sm leading-relaxed">
        <p className="font-medium">Fuente temporal: {data.filename}</p>
        <p className="mt-1 text-muted">Consulta administrativa del archivo, con correcciones confirmadas señaladas en la tabla. Los totales por categoría no representan existencias actuales por producto. Los nombres de responsables todavía no están vinculados a usuarios.</p>
      </aside>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">Bodega del archivo
          <select className={inventoryFieldClass} value={warehouseName} onChange={e => { change(setWarehouseName, e.target.value); setResponsible('') }}>
            {data.warehouses.map(w => <option key={w.name}>{w.name}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">Buscar categoría
          <input className={inventoryFieldClass} value={search} onChange={e => change(setSearch, e.target.value)} placeholder="Nombre de la categoría" />
        </label>
      </div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {states.map(s => <div key={s} className="rounded-xl border border-border bg-surface p-4">
          <dt className="text-sm text-muted">{s}</dt>
          <dd className="mt-2 text-2xl font-semibold">{warehouse.categories.filter(c => categoryStatus(c.lastDate, today) === s).length}</dd>
        </div>)}
      </dl>
      <p className="text-xs text-muted">Control de toda la bodega al {displayDate(today)}: menos de 10 días, al día; de 10 a 30, por realizar; más de 30, crítico. Sin fecha histórica se muestra «Sin inventario». Los filtros inferiores solo afectan la tabla.</p>
      <InventoryTabs tabs={tabs} selected={tab} onChange={v => change(setTab, v)} label="Datos del archivo">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
          {tab === 'history' ? <>
            <label className="text-sm">Responsable
              <select className={inventoryFieldClass} value={responsible} onChange={e => change(setResponsible, e.target.value)}>
                <option value="">Todos</option>
                {[...new Set(warehouse.records.map(r => r.responsible).filter(Boolean))].sort().map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-sm">Desde<input type="date" className={inventoryFieldClass} value={from} onChange={e => change(setFrom, e.target.value)} /></label>
            <label className="text-sm">Hasta<input type="date" className={inventoryFieldClass} value={to} min={from || undefined} onChange={e => change(setTo, e.target.value)} /></label>
          </> : <label className="text-sm">Estado
            <select className={inventoryFieldClass} value={status} onChange={e => change(setStatus, e.target.value)}>
              <option value="">Todos</option>{states.map(s => <option key={s}>{s}</option>)}
            </select>
          </label>}
        </div>
        {from && to && from > to && tab === 'history' && <p role="alert" className="p-4 text-sm">La fecha inicial debe ser anterior o igual a la final.</p>}
        <div className="overflow-x-auto">
          <table className="data-table min-w-[800px]">
            <caption className="sr-only">{warehouse.name}: {tab === 'history' ? 'historial' : 'control por categoría'}</caption>
            <thead><tr>{(tab === 'history'
              ? ['Categoría', 'Fecha', 'Total registrado', 'Sobrantes', 'Faltantes', 'Responsable', 'Fecha de ajuste', 'Fila Excel']
              : ['Categoría', 'Último registro', 'Estado', 'Filas de control']).map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {tab === 'history' ? records.slice(offset, offset + 15).map(r => <tr key={r.id}>
                <td>{r.category}</td><td>{displayDate(r.date)}</td><td>{r.total ?? 'Sin dato'}
                  {r.correction && <span className="mt-1 block text-xs text-muted" title={`${r.correction} Valor original del Excel: ${r.originalTotal}`}>Unidades corregidas</span>}
                </td>
                <td>{r.surplus ?? 'Sin dato'}</td><td>{r.shortage ?? 'Sin dato'}</td>
                <td>{r.responsible || 'Sin responsable'}</td><td>{displayDate(r.adjustmentDate)}</td><td>{r.row}</td>
              </tr>) : categories.slice(offset, offset + 15).map(c => {
                const state = categoryStatus(c.lastDate, today)
                return <tr key={c.name}><td>{c.name}</td><td>{displayDate(c.lastDate)}</td>
                  <td><span className={`badge ${styles[state] ?? 'bg-subtle text-muted'}`}>{state}</span></td>
                  <td>{c.rows.join(', ') || 'Solo en historial'}</td></tr>
              })}
              {total === 0 && <tr><td colSpan={tab === 'history' ? 8 : 4} className="py-10 text-center text-muted">No hay resultados con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
        <TablePagination currentPage={current} totalPages={pages} totalItems={total} pageSize={15} onPageChange={setPage} />
        <p aria-live="polite" className="px-4 py-3 text-xs text-muted">{total} resultados.</p>
      </InventoryTabs>
    </div>
  )
}
