'use client'

import { useState } from 'react'
import { Plus, ShieldCheck } from 'lucide-react'
import type { InventoryAccess, InventoryMembership } from '../types'
import {
  InventoryEmptyState,
  InventoryIntegrationNotice,
  InventoryNoWarehouse,
  InventoryTabs,
  InventoryWarehouseSelector,
} from './InventoryPrimitives'

const operatorTabs = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'en-proceso', label: 'En proceso' },
  { id: 'finalizados', label: 'Finalizados' },
] as const

const managerTabs = [
  { id: 'asignaciones', label: 'Asignaciones' },
  { id: 'en-ejecucion', label: 'En ejecución' },
  { id: 'por-verificar', label: 'Por verificar' },
  { id: 'historial', label: 'Historial' },
] as const

function InventoryWorklist({ membership }: { membership: InventoryMembership }) {
  const operator = membership.rol === 'operador'
  const tabs = operator ? operatorTabs : managerTabs
  const [selectedTab, setSelectedTab] = useState<string>(tabs[0].id)
  const selected = tabs.find(tab => tab.id === selectedTab) ?? tabs[0]
  const columns = operator
    ? ['Ticket / categoría', 'Bodega', 'Asignación', 'Asignado por', 'SKU / progreso', 'Prioridad', 'Estado']
    : ['Ticket / categoría', 'Bodega', 'Operador', 'Corte ERP', 'Asignación', 'Progreso', 'Tiempo transcurrido', 'Prioridad', 'Estado']
  return (
    <div className="space-y-4">
      <InventoryTabs tabs={tabs} selected={selected.id} onChange={setSelectedTab} label="Fases del inventario">
        <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
          <h2 className="text-sm font-medium">{selected.label}</h2>
          <p className="text-sm text-muted">
            {operator ? 'Únicamente tus inventarios asignados en esta bodega.' : `Inventarios autorizados de ${membership.bodegaNombre}.`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[850px]">
            <caption className="sr-only">{selected.label} de {membership.bodegaNombre}</caption>
            <thead><tr>{columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>
              <tr>
                <td colSpan={columns.length}>
                  <InventoryEmptyState title="Asignaciones aún no disponibles">
                    La consulta de tickets se habilitará con el servicio de inventarios y la integración con G21.
                    {selected.id === 'por-verificar' && ' Aquí recibirás los conteos enviados para revisión.'}
                  </InventoryEmptyState>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </InventoryTabs>
      {operator && (
        <div className="flex items-start gap-2 text-sm leading-relaxed text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Conteo ciego: el saldo esperado no se mostrará durante el conteo. La captura y el escaneo se habilitarán al recibir una asignación confirmada.</p>
        </div>
      )}
    </div>
  )
}

export function InventoryRecords({ access }: { access: InventoryAccess }) {
  const memberships = access.status === 'ready' ? access.memberships : []
  const [warehouseId, setWarehouseId] = useState(memberships[0]?.bodegaId ?? '')
  const selected = memberships.find(membership => membership.bodegaId === warehouseId) ?? memberships[0]
  const canPrepareInventory = selected
    ? selected.rol === 'administrador' || selected.rol === 'lider'
    : access.platformAdmin

  return (
    <div className="space-y-6 pb-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Registros de inventarios</h1>
          <p className="mt-2 text-sm text-muted">Asignaciones, conteos físicos y verificaciones por bodega.</p>
        </div>
        {canPrepareInventory && (
          <button type="button" disabled className="btn-primary shrink-0" aria-describedby="inventory-create-requirement">
            <Plus className="h-4 w-4" aria-hidden="true" /> Nuevo inventario
          </button>
        )}
      </header>

      <InventoryIntegrationNotice access={access} />
      {canPrepareInventory && (
        <p id="inventory-create-requirement" className="text-sm text-muted">
          Para crear inventarios se requiere una bodega autorizada y saldos oficiales confirmados.
        </p>
      )}

      <InventoryWarehouseSelector memberships={memberships} selected={selected} onChange={setWarehouseId} />
      {selected
        ? <InventoryWorklist key={`${selected.bodegaId}-${selected.rol}`} membership={selected} />
        : <InventoryNoWarehouse access={access} />}

    </div>
  )
}
