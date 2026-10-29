'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface SidebarContextType {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  desktopHidden: boolean
  toggleDesktop: () => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [desktopHidden,setDesktopHidden]=useState(false)
  const toggleDesktop=useCallback(()=>setDesktopHidden(value=>!value),[])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  return (
    <SidebarContext.Provider value={{ isOpen, open, close, toggle, desktopHidden, toggleDesktop }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function DashboardContent({children}:{children:React.ReactNode}) {
  const {desktopHidden}=useSidebar()
  return <div id="dashboard-content" className={`min-w-0 px-4 py-4 transition-[margin] duration-200 motion-reduce:transition-none sm:px-6 lg:px-8 lg:py-8 xl:px-10 ${desktopHidden?'lg:ml-0':'lg:ml-64'}`}>{children}</div>
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider')
  return ctx
}

