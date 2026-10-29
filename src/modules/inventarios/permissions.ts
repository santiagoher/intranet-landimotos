import type { InventoryAccess, InventoryMembership } from './types'

export interface InventoryProfile {
  rol: string | null
  estado: string | null
  modulos_permitidos: string[] | null
}

export function inventoryModuleAllowed(profile: InventoryProfile | null): boolean {
  return profile?.estado === 'activo' && (
    profile.rol === 'Admin' || Boolean(profile.modulos_permitidos?.includes('inventarios'))
  )
}

export function inventoryCapabilities(profile: InventoryProfile | null, memberships: InventoryMembership[], status: InventoryAccess['status']): InventoryAccess {
  const canEnter = status !== 'denied' && inventoryModuleAllowed(profile)
  const platformAdmin = canEnter && profile?.rol === 'Admin'
  const authorized = canEnter && status === 'ready' ? memberships : []
  // Platform administrators may prepare the module. This never grants warehouse data.
  const preparing = platformAdmin && authorized.length === 0
  return {
    status, platformAdmin, canEnter,
    canViewReports: canEnter && (preparing || authorized.some(m => m.rol !== 'operador')),
    canConfigure: canEnter && (platformAdmin || authorized.some(m => m.rol === 'administrador')),
    memberships: authorized,
  }
}
