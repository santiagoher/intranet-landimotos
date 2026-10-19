'use client'

import { useState } from 'react'
import { ClipboardList, Eye } from 'lucide-react'
import { TablePagination, usePagination } from '@/components/TablePagination'
import { NavigationSection } from '@/components/layout/NavigationSection'
import type { getPedidos } from './actions'

type Pedidos = Awaited<ReturnType<typeof getPedidos>>

export function DespachosRecordsTable({ pedidos, loading, onView }: {
  pedidos: Pedidos
  loading: boolean
  onView: (pedido: Pedidos[number]) => void
}) {
  const [pagination, setPagination] = useState({ pedidos, page: 1 })
  const [search, setSearch] = useState('')
  const [punto, setPunto] = useState('')
  const [estado, setEstado] = useState('')
  const query = search.trim().toLowerCase()
  const visibleOrders = pedidos.filter(p => (!punto || p.punto === punto) && (!estado || p.estado === estado)
    && (!query || [p.numero_factura, p.area, p.revisado_por, p.mesa].some(value => (value ?? '').toLowerCase().includes(query))))
  const { totalItems, totalPages, pageSize, paginate } = usePagination(visibleOrders, 15)
  const currentPage = pagination.pedidos === pedidos
    ? Math.min(pagination.page, totalPages) : 1
  const paginatedPedidos = paginate(currentPage)
  const setCurrentPage = (page: number) => setPagination({ pedidos, page })

  return (
      <NavigationSection id="registros" aria-label="Registros de facturas" className="min-w-0 scroll-mt-8 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-medium">Facturas registradas</h2>
            {!loading && <span className="rounded-md bg-subtle px-2 py-0.5 text-xs tabular-nums text-secondary">{totalItems}</span>}
          </div>
          <span className="text-xs text-muted">Registros de {new Date().toLocaleDateString('es-ES', { month: 'long' })}</span>
        </div>
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <input type="search" value={search} aria-label="Buscar facturas, área, responsable o mesa"
            placeholder="Buscar factura, área, responsable o mesa…"
            onChange={event => { setSearch(event.target.value); setCurrentPage(1) }}
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground" />
          <select aria-label="Filtrar por punto" value={punto} onChange={event => { setPunto(event.target.value); setCurrentPage(1) }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
            <option value="">Todos los puntos</option><option value="Principal">Principal</option><option value="Sucursal">Sucursal</option>
          </select>
          <select aria-label="Filtrar por estado" value={estado} onChange={event => { setEstado(event.target.value); setCurrentPage(1) }}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
            <option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="enviado">Enviado</option>
            <option value="entregado">Entregado</option>
          </select>
        </div>
        {loading ? (
          <div role="status" className="flex items-center justify-center px-6 py-24 text-sm text-muted">
            Cargando registros...
          </div>
        ) : (
          <>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de facturas, desplazamiento horizontal">
          <table className="data-table min-w-[720px]">
            <caption className="sr-only">Facturas registradas por punto, área, revisor, mesa y fecha</caption>
            <thead>
              <tr>
                <th scope="col">Punto</th>
                <th scope="col">Factura(s)</th>
                <th scope="col">Área / Revisor</th>
                <th scope="col">Mesa</th>
                <th scope="col">Fecha y Hora</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-right"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="h-72 text-center">
                    <div className="flex flex-col items-center justify-center text-muted">
                      <div className="mb-4 rounded-xl border border-border bg-subtle p-3"><ClipboardList className="size-6" strokeWidth={1.5} /></div>
                      <p>{query || punto || estado ? 'No hay facturas que coincidan con los filtros.' : 'No hay registros este mes.'}</p>
                      <p className="mt-1 text-xs">Las facturas registradas aparecerán aquí.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPedidos.map((p) => (
                  <tr key={p.id} className="hover:bg-hover transition-colors group">
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        p.punto === 'Principal' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'
                      }`}>
                        {p.punto}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary font-mono">
                      {p.numero_factura}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-foreground">{p.area}</p>
                        <p className="text-xs text-muted">Rev: {p.revisado_por}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">
                      {p.mesa}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="text-secondary">{new Date(p.created_at).toLocaleDateString()}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-secondary">
                      <span className="badge bg-subtle text-secondary">{p.estado}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onView(p)}
                        className="icon-button"
                        aria-label={`Ver detalles de la factura ${p.numero_factura}`}
                        title="Ver Detalles"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
          </>
        )}
      </NavigationSection>
  )
}
