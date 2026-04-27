'use client'

import { useEffect, useState } from 'react'
import { Package, Plus, ClipboardList, Eye, BarChart2, Table as TableIcon, Shield } from 'lucide-react'
import { getPedidos, getEnvios, deletePedido } from './actions'
import { OrderForm } from './OrderForm'
import { ShipmentForm } from './ShipmentForm'
import { OrderDetailsModal } from './OrderDetailsModal'
import { DespachosAdminStats } from './DespachosAdminStats'
import { useRole } from '@/hooks/useRole'

export default function DespachosPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [envios, setEnvios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<any>(null)
  const [viewingPedido, setViewingPedido] = useState<any>(null)
  const { isAdmin, loading: loadingRole } = useRole()
  
  const refreshData = async () => {
    setLoading(true)
    try {
      const [pData, eData] = await Promise.all([getPedidos(), getEnvios()])
      setPedidos(pData)
      setEnvios(eData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      refreshData()
    }
  }, [isAdmin])

  const pendingOrders = pedidos.filter(p => p.estado === 'pendiente')

  // 0. BLOQUEO DE CARGA: Mientras verificamos el rol, no mostramos nada
  if (loadingRole) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-neutral-500 animate-pulse">
        <Shield className="w-8 h-8 mb-4 opacity-20" />
        <p className="text-sm font-medium">Verificando nivel de acceso...</p>
      </div>
    )
  }

  // 1. VISTA PARA ADMINISTRADOR: Directo a estadísticas
  if (isAdmin) {
    return <DespachosAdminStats />
  }

  // VISTA PARA OPERATIVO: Todo el flujo de registro y tabla
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" />
            Registro de Facturas
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-neutral-400 text-sm">Control operativo y revisión de facturas por punto.</p>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-blue-500/20">
              Registros de {new Date().toLocaleDateString('es-ES', { month: 'long' })}
            </span>
          </div>
        </div>
        
        <button 
          onClick={() => setShowOrderForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Factura</span>
        </button>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-hidden min-h-[400px]">
        {loading || loadingRole ? (
          <div className="flex items-center justify-center p-20 text-neutral-500">
            Cargando registros...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-950/50">
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Punto</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Factura(s)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Área / Revisor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Mesa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Fecha y Hora</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {pendingOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-neutral-500">
                        <ClipboardList className="w-12 h-12 text-neutral-800 mb-4" />
                        <p>No hay pedidos pendientes de asignar.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pendingOrders.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                          p.punto === 'Principal' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'
                        }`}>
                          {p.punto}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-300 font-mono">
                        {p.numero_factura}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-white">{p.area}</p>
                          <p className="text-xs text-neutral-500">Rev: {p.revisado_por}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-400">
                        {p.mesa}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-neutral-300">{new Date(p.created_at).toLocaleDateString()}</p>
                          <p className="text-[10px] text-neutral-500">
                            {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setViewingPedido(p)}
                          className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-all"
                          title="Ver Detalles"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
