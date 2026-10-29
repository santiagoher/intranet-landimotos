'use client'

import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { ClipboardList, PlugZap, Warehouse } from 'lucide-react'
import { G21_INTEGRATION_STATUS } from '../g21/contracts'
import { INVENTORY_ROLE_LABELS, type InventoryAccess, type InventoryMembership } from '../types'

export const inventoryFieldClass = 'min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted'

export function InventoryIntegrationNotice({ access }: { access: InventoryAccess }) {
  return (
    <aside className="rounded-xl border border-border bg-subtle p-4 sm:p-5" aria-label="Estado de integración">
      <div className="flex items-start gap-3">
        <PlugZap className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-sm font-medium">{G21_INTEGRATION_STATUS.label}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            Los inventarios físicos se habilitarán al contar con productos, bodegas y saldos confirmados de G21.
          </p>
          {access.status === 'schema_pending' && (
            <p className="text-sm leading-relaxed text-muted">
              La preparación del módulo está pendiente; todavía no se pueden consultar asignaciones ni permisos por bodega.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}

export function InventoryWarehouseSelector({ memberships, selected, onChange }: {
  memberships: InventoryMembership[]
  selected: InventoryMembership | undefined
  onChange: (id: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <label htmlFor={id} className="block w-full space-y-2 sm:max-w-sm">
        <span className="text-sm font-medium">Bodega autorizada</span>
        <select
          id={id}
          value={selected?.bodegaId ?? ''}
          onChange={event => onChange(event.target.value)}
          disabled={memberships.length === 0}
          className={inventoryFieldClass}
        >
          {memberships.length === 0 && <option value="">Sin bodegas autorizadas</option>}
          {memberships.map(membership => (
            <option key={membership.bodegaId} value={membership.bodegaId}>{membership.bodegaNombre}</option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Warehouse className="h-4 w-4" aria-hidden="true" />
          <span>{selected.codigoErp}</span>
          <span aria-hidden="true">·</span>
          <span className="badge bg-subtle text-secondary">{INVENTORY_ROLE_LABELS[selected.rol]}</span>
        </div>
      )}
    </div>
  )
}

export function InventoryEmptyState({ title, children }: { title: string, children: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <div className="mb-4 rounded-xl bg-subtle p-3 text-muted">
        <ClipboardList className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{children}</div>
    </div>
  )
}

export function InventoryNoWarehouse({ access, scope = 'registros' }: {
  access: InventoryAccess
  scope?: 'registros' | 'reportes' | 'configuración'
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <InventoryEmptyState title="Sin bodegas autorizadas">
        {access.status === 'schema_pending'
          ? 'Las bodegas y sus responsables estarán disponibles cuando termine la preparación del módulo.'
          : `Se necesita una autorización de bodega para consultar ${scope}. Solicita la vinculación a tu administrador de inventarios.`}
      </InventoryEmptyState>
    </div>
  )
}

export interface InventoryTab {
  id: string
  label: string
}

export function InventoryTabs({ tabs, selected, onChange, children, label }: {
  tabs: readonly InventoryTab[]
  selected: string
  onChange: (id: string) => void
  children: ReactNode
  label: string
}) {
  const id = useId()
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = tabs.length - 1
    else return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[nextIndex]?.focus()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-border px-4">
        {tabs.map((tab, index) => (
          <button
            type="button"
            role="tab"
            key={tab.id}
            id={`${id}-${tab.id}`}
            aria-selected={selected === tab.id}
            aria-controls={`${id}-panel`}
            tabIndex={selected === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`min-h-12 shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              selected === tab.id
                ? 'border-accent text-accent-foreground'
                : 'border-transparent text-muted hover:bg-hover hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${selected}`} tabIndex={0}>
        {children}
      </div>
    </div>
  )
}
