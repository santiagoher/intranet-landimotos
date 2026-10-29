'use client'

import { useState } from 'react'
import { Bell, PlugZap, ShieldCheck, Warehouse, type LucideIcon } from 'lucide-react'
import { G21_INTEGRATION_STATUS } from '../g21/contracts'
import type { InventoryAccess } from '../types'
import {
  InventoryEmptyState,
  InventoryIntegrationNotice,
  InventoryNoWarehouse,
  InventoryTabs,
  InventoryWarehouseSelector,
} from './InventoryPrimitives'

const sections: { id: string, label: string, icon: LucideIcon, title: string, description: string }[] = [
  {
    id: 'bodegas', label: 'Bodegas', icon: Warehouse,
    title: 'Catálogo oficial pendiente',
    description: 'La sincronización con G21 permitirá confirmar los códigos y nombres oficiales de cada bodega.',
  },
  {
    id: 'permisos', label: 'Permisos', icon: ShieldCheck,
    title: 'Gestión de responsables pendiente',
    description: 'Aquí se vincularán líderes, suplentes y operadores con permisos específicos por bodega autorizada.',
  },
  {
    id: 'alertas', label: 'Alertas', icon: Bell,
    title: 'Reglas de seguimiento pendientes',
    description: 'Aquí se configurarán la periodicidad por categoría y los límites de antigüedad para los estados al día, alerta y crítico.',
  },
  {
    id: 'integracion', label: 'Integración', icon: PlugZap,
    title: G21_INTEGRATION_STATUS.label,
    description: 'La sincronización de bodegas, categorías, productos, saldos y movimientos requiere confirmar la conexión con G21.',
  },
]

export function InventoryConfiguration({ access }: { access: InventoryAccess }) {
  const memberships = access.status === 'ready'
    ? access.memberships.filter(membership => membership.rol === 'administrador')
    : []
  const [warehouseId, setWarehouseId] = useState(memberships[0]?.bodegaId ?? '')
  const [sectionId, setSectionId] = useState(sections[0].id)
  const selected = memberships.find(membership => membership.bodegaId === warehouseId) ?? memberships[0]
  const section = sections.find(item => item.id === sectionId) ?? sections[0]
  const SectionIcon = section.icon
  const canInspectPreparation = access.platformAdmin && access.status !== 'error' && access.status !== 'denied'

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="page-title">Configuración de inventarios</h1>
        <p className="mt-2 text-sm text-muted">Bodegas, responsables y reglas de seguimiento de inventarios.</p>
      </header>
      <InventoryIntegrationNotice access={access} />
      <InventoryWarehouseSelector memberships={memberships} selected={selected} onChange={setWarehouseId} />
      {!selected && <InventoryNoWarehouse access={access} scope="configuración" />}
      {(selected || canInspectPreparation) && (
        <InventoryTabs tabs={sections} selected={section.id} onChange={setSectionId} label="Configuración de inventarios">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <SectionIcon className="h-4 w-4 text-muted" aria-hidden="true" />
            <h2 className="text-sm font-medium">
              {section.label} · {selected ? selected.bodegaNombre : 'Preparación del módulo'}
            </h2>
          </div>
          <InventoryEmptyState title={section.title}>{section.description}</InventoryEmptyState>
          {section.id === 'integracion' && (
            <dl className="grid grid-cols-1 gap-4 border-t border-border px-5 py-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Última sincronización</dt>
                <dd className="mt-1 font-medium">Sin sincronización confirmada</dd>
              </div>
              <div>
                <dt className="text-muted">Envío de ajustes al ERP</dt>
                <dd className="mt-1 font-medium">No habilitado</dd>
              </div>
            </dl>
          )}
        </InventoryTabs>
      )}
    </div>
  )
}
