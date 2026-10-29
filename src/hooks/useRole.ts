'use client'
import { useServerRole } from '@/components/layout/RoleProvider'

// UI only. Server Actions and RLS still enforce every operation.
export function useRole() {
  const profile=useServerRole()
  return {rol:profile?.rol??null,isAdmin:profile?.rol==='Admin',modulosPermitidos:profile?.modulosPermitidos??[],loading:false}
}
