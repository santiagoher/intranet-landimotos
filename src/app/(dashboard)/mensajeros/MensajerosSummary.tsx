'use client'

import type { useMensajerosData } from './useMensajerosData'

type SummaryProps = Pick<ReturnType<typeof useMensajerosData>, 'mensajeros' | 'activeRoutes' | 'lastUpdated'>

export function MensajerosSummary({ mensajeros, activeRoutes, lastUpdated }: SummaryProps) {
  const operationalSummary = [
    { label: 'Total de conductores', value: mensajeros.length, color: 'text-foreground' },
    { label: 'Conductores disponibles', value: mensajeros.filter(m => m.estado === 'disponible').length, color: 'text-success' },
    { label: 'Conductores en ruta', value: mensajeros.filter(m => m.estado === 'en_ruta').length, color: 'text-accent-foreground' },
    { label: 'Rutas activas', value: activeRoutes.length, color: 'text-foreground' },
  ]
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {operationalSummary.map(item => <div key={item.label} className="rounded-xl border border-border bg-surface p-5">
        <dt className="text-sm text-muted">{item.label}</dt>
        <dd className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${item.color}`}>
          {lastUpdated ? item.value : '—'}
        </dd>
      </div>)}
    </dl>
  )
}
