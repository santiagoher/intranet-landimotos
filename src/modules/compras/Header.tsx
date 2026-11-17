'use client'

import { usePathname } from 'next/navigation'
import { ComprasNotifications } from './Notifications'

export function ComprasHeader() {
  const pathname = usePathname()
  const reports = pathname.startsWith('/compras/reportes')
  const detail = pathname.startsWith('/compras/registros/')
  const team = pathname.startsWith('/compras/equipo')

  return (
    <header className="relative min-h-10 pr-14">
      <h1 className="page-title">
        {team ? 'Equipo y mesas de compras' : reports ? 'Reportes de compras' : detail ? 'Revisión de factura' : 'Registros de compras'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {team ? 'Administra los encargados y sus mesas de trabajo para las nuevas revisiones.' : reports
          ? 'Consulta los estados, tiempos e historial de las revisiones de facturas.'
          : detail
            ? 'Consulta la factura, registra observaciones y sigue el historial de revisión.'
            : 'Gestiona las asignaciones, revisa las facturas y realiza el seguimiento de compras.'}
      </p>
      <div className="absolute right-0 top-0">
        <ComprasNotifications />
      </div>
    </header>
  )
}
