'use client'
import { createContext, useContext, type ReactNode } from 'react'
export interface RoleValue { rol: 'Admin' | 'Operativo'; modulosPermitidos: string[] }
const RoleContext=createContext<RoleValue|null>(null)
export function RoleProvider({value,children}:{value:RoleValue;children:ReactNode}) {
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}
export function useServerRole(){return useContext(RoleContext)}

