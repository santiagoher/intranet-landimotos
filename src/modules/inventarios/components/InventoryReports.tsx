'use client'

import { useState } from 'react'
import type { InventoryAccess } from '../types'
import {
  InventoryEmptyState,
  InventoryIntegrationNotice,
  InventoryNoWarehouse,
  InventoryWarehouseSelector,
  inventoryFieldClass,
} from './InventoryPrimitives'

const indicators = [
  'Inventarios realizados',
  'Inventarios pendientes',
  'Inventarios críticos',
  'Tiempo promedio de conteo',
  'Tiempo promedio de verificación',
  'Diferencias confirmadas',
]

export function InventoryReports({ access }: { access: InventoryAccess }) {
  const memberships = access.status === 'ready'
    ? access.memberships.filter(membership => membership.rol === 'administrador' || membership.rol === 'lider')
    : []
  const [warehouseId, setWarehouseId] = useState(memberships[0]?.bodegaId ?? '')
  const selected = memberships.find(membership => membership.bodegaId === warehouseId) ?? memberships[0]

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="page-title">Reportes de inventarios</h1>
        <p className="mt-2 text-sm text-muted">Cobertura, tiempos y diferencias de las bodegas que puedes supervisar.</p>
      </header>
      <InventoryIntegrationNotice access={access} />
      <InventoryWarehouseSelector memberships={memberships} selected={selected} onChange={setWarehouseId} />
      {!selected ? <InventoryNoWarehouse access={access} scope="reportes" /> : (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-4">
            <label className="block min-w-44 flex-1 space-y-2 sm:max-w-52">
              <span className="text-sm font-medium">Desde</span>
              <input type="date" disabled className={inventoryFieldClass} aria-describedby="inventory-report-dates" />
            </label>
            <label className="block min-w-44 flex-1 space-y-2 sm:max-w-52">
              <span className="text-sm font-medium">Hasta</span>
              <input type="date" disabled className={inventoryFieldClass} aria-describedby="inventory-report-dates" />
            </label>
            <p id="inventory-report-dates" className="max-w-sm pb-2 text-sm text-muted">
              El período se podrá filtrar cuando haya inventarios disponibles para consultar.
            </p>
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {indicators.map(label => (
              <div key={label} className="rounded-xl border border-border bg-surface p-5">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="mt-3 text-3xl font-semibold tracking-tight" aria-label="Sin datos disponibles">—</dd>
                <p className="mt-2 text-xs text-muted">Pendiente de datos confirmados</p>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface">
              <h2 className="border-b border-border px-5 py-4 text-sm font-medium">Cobertura por categoría</h2>
              <InventoryEmptyState title="Cobertura aún no disponible">
                Las categorías al día, en alerta y críticas se calcularán con inventarios confirmados y los umbrales configurados.
              </InventoryEmptyState>
            </section>
            <section className="rounded-xl border border-border bg-surface">
              <h2 className="border-b border-border px-5 py-4 text-sm font-medium">Productividad y diferencias</h2>
              <InventoryEmptyState title="Resultados aún no disponibles">
                Aquí podrás consultar inventarios por operador, duración de las verificaciones y diferencias conciliadas por producto.
              </InventoryEmptyState>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
