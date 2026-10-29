import 'server-only'

import { cache } from 'react'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getAuthUser, getProfile } from '@/utils/supabase/session.server'
import { invalidSession } from '@/utils/supabase/auth-errors'
import { inventoryCapabilities, inventoryModuleAllowed } from './permissions'
import type { InventoryAccess, InventoryMembership } from './types'

const profileSchema = z.object({
  rol: z.string().nullable(), estado: z.string().nullable(), modulos_permitidos: z.array(z.string()).nullable(),
})
const membershipSchema = z.object({
  bodega_id: z.string().uuid(), rol: z.enum(['administrador', 'lider', 'operador']), es_responsable: z.boolean(),
  bodega: z.object({ id: z.string().uuid(), nombre: z.string(), codigo_erp: z.string().nullable(), activa: z.boolean() }).nullable(),
})

// Request-local deduplication only. Never cache authorization across users or requests.
export const getInventoryAccess = cache(async (): Promise<InventoryAccess> => {
  const denied = inventoryCapabilities(null, [], 'denied')
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await getAuthUser()
    if (authError) return invalidSession(authError) ? denied : {...denied,status:'error'}
    if (!user) return denied
    const { data, error } = await getProfile(user.id)
    const profile = profileSchema.safeParse(data)
    if (error || !profile.success) return {...denied,status:'error'}
    if (!inventoryModuleAllowed(profile.data)) return denied

    const memberships = await supabase.from('inventario_usuarios_bodegas')
      .select('bodega_id, rol, es_responsable, bodega:inventario_bodegas(id, nombre, codigo_erp, activa)')
      .eq('perfil_id', user.id).eq('activo', true)
    if (memberships.error) {
      const missingSchema = ['42P01', 'PGRST205'].includes(memberships.error.code)
      return inventoryCapabilities(profile.data, [], missingSchema ? 'schema_pending' : 'error')
    }
    const parsed = z.array(membershipSchema).safeParse(memberships.data)
    if (!parsed.success) return inventoryCapabilities(profile.data, [], 'error')
    const authorized: InventoryMembership[] = parsed.data.flatMap(m => m.bodega?.activa && m.bodega.id === m.bodega_id ? [{
      bodegaId: m.bodega_id, bodegaNombre: m.bodega.nombre, codigoErp: m.bodega.codigo_erp ?? 'Catálogo Excel',
      rol: m.rol, esResponsable: m.es_responsable,
    }] : [])
    const administrators = await supabase.from('inventario_administradores').select('perfil_id').eq('perfil_id',user.id).eq('activo',true)
    if (administrators.error && !['42P01','PGRST205'].includes(administrators.error.code)) return { ...denied, status: 'error' }
    const inventoryAdmin = !administrators.error && administrators.data?.some(a => a.perfil_id === user.id) === true
    const capabilities = inventoryCapabilities(profile.data, authorized, 'ready')
    return { ...capabilities, inventoryAdmin, canViewReports: capabilities.canViewReports || inventoryAdmin, canConfigure: capabilities.canConfigure || inventoryAdmin }
  } catch {
    return { ...denied, status: 'error' }
  }
})
