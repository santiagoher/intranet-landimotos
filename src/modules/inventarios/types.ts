export type InventoryRole = 'administrador' | 'lider' | 'operador'

export interface InventoryMembership {
  bodegaId: string
  bodegaNombre: string
  codigoErp: string
  rol: InventoryRole
  esResponsable: boolean
}

export interface InventoryAccess {
  status: 'ready' | 'schema_pending' | 'error' | 'denied'
  platformAdmin: boolean
  inventoryAdmin?: boolean
  canEnter: boolean
  canViewReports: boolean
  canConfigure: boolean
  memberships: InventoryMembership[]
}

export const INVENTORY_ROLE_LABELS: Record<InventoryRole, string> = {
  administrador: 'Administrador de inventarios',
  lider: 'Líder de bodega',
  operador: 'Operador de inventarios',
}

export const INVENTORY_TIME_ZONE = 'America/Bogota'

export function formatInventoryDate(utc: string | null): string {
  if (!utc) return 'Sin fecha confirmada'
  const date = new Date(utc)
  if (!Number.isFinite(date.getTime())) return 'Fecha no válida'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: INVENTORY_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(date)
}
