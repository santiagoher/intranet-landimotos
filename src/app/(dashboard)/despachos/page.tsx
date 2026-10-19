'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Shield } from 'lucide-react'
import { getPedidos, deletePedido } from './actions'
import { OrderForm } from './OrderForm'
import { ShipmentForm } from './ShipmentForm'
import { OrderDetailsModal } from './OrderDetailsModal'
import { DespachosAdminStats } from './DespachosAdminStats'
import { useRole } from '@/hooks/useRole'
import { useNavigationHash } from '@/components/layout/useNavigationHash'
import { DespachosRecordsTable } from './DespachosRecordsTable'

export default function DespachosPage() {
  const [pedidos, setPedidos] = useState<Awaited<ReturnType<typeof getPedidos>>>([])
  const [loading, setLoading] = useState(true)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<any>(null)
  const [viewingPedido, setViewingPedido] = useState<any>(null)
  const { isAdmin, modulosPermitidos, loading: loadingRole } = useRole()
  const [dataError, setDataError] = useState<string | null>(null)
  const hash = useNavigationHash()
  const isReportsView = isAdmin && hash === '#reportes'
  const hasAccess = isAdmin || modulosPermitidos.includes('despachos')
  
  const refreshData = useCallback(async () => {
    setLoading(true)
    setDataError(null)
    try {
      const pData = await getPedidos()
      setPedidos(pData)
    } catch (err) {
      console.error(err)
      setDataError('No se pudieron cargar las facturas. Intenta actualizar de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadingRole || !hasAccess || isReportsView) return
    const timeout = window.setTimeout(() => void refreshData(), 0)
    return () => window.clearTimeout(timeout)
  }, [loadingRole, hasAccess, isReportsView, refreshData])

  // 0. BLOQUEO DE CARGA: Mientras verificamos el rol, no mostramos nada
  if (loadingRole) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted animate-pulse">
        <Shield className="w-8 h-8 mb-4 opacity-20" />
        <p className="text-sm font-medium">Verificando nivel de acceso...</p>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center text-muted bg-surface border border-border rounded-2xl">
        <Shield className="w-12 h-12 text-danger/80 mb-4" />
        <h3 className="text-lg font-bold text-foreground">Acceso Denegado</h3>
        <p className="text-sm text-muted mt-1 max-w-sm">No tienes permisos para ver el módulo de Despachos. Solicita acceso a un administrador.</p>
      </div>
    )
  }

  if (isReportsView) return <DespachosAdminStats />

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Registro de Facturas</h1>
          <p className="mt-2 text-sm text-muted">Registra facturas, gestiona los despachos y consulta el historial del mes.</p>
        </div>
        {!isAdmin && <button onClick={() => setShowOrderForm(true)} className="btn-primary w-full sm:w-auto shrink-0">
          <Plus className="w-4 h-4" /><span>Registrar Factura</span>
        </button>}
      </div>

      {dataError && <div role="alert" className="rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
        {dataError} <button type="button" onClick={() => void refreshData()} className="ml-2 underline">Reintentar</button>
      </div>}

      {(!dataError || pedidos.length > 0) && <DespachosRecordsTable pedidos={pedidos} loading={loading} onView={setViewingPedido} />}

      {showOrderForm && (
        <OrderForm 
          onSuccess={() => {
            setShowOrderForm(false)
            refreshData()
          }}
          onCancel={() => setShowOrderForm(false)}
        />
      )}

      {selectedPedido && (
        <ShipmentForm 
          pedido={selectedPedido}
          onSuccess={() => {
            setSelectedPedido(null)
            refreshData()
          }}
          onCancel={() => setSelectedPedido(null)}
        />
      )}
      {viewingPedido && (
        <OrderDetailsModal 
          pedido={viewingPedido}
          onClose={() => setViewingPedido(null)}
          isAdmin={isAdmin}
          onDelete={async () => {
            await deletePedido(viewingPedido.id)
            setViewingPedido(null)
            refreshData()
          }}
          onAssign={() => {
            setSelectedPedido(viewingPedido)
            setViewingPedido(null)
          }}
        />
      )}
    </div>
  )
}

