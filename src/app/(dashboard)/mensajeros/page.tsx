'use client'

import { NavigationSection } from '@/components/layout/NavigationSection'

import { useNavigationHash } from '@/components/layout/useNavigationHash'
import { useMensajerosData } from './useMensajerosData'

import { MensajerosReports } from './MensajerosReports'
import { MensajerosSummary } from './MensajerosSummary'

import { useState } from 'react'
import { Search, MapPin, Package, Clock, User, CheckCircle2, Coffee, Route, Eye, RefreshCw, Shield } from 'lucide-react'
import { 
  deleteMensajero, finalizeRoute, startLunch, endLunch,
} from './actions'
import { MessengerForm } from './MessengerForm'
import { RouteForm } from './RouteForm'
import { RouteDetailsModal } from './RouteDetailsModal'
import { useRole } from '@/hooks/useRole'

export default function MensajerosPage() {
  const [viewingRoute, setViewingRoute] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [editingMessenger, setEditingMessenger] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const { isAdmin, modulosPermitidos, loading: loadingRole } = useRole()
  const hash = useNavigationHash()
  const hasAccess = isAdmin || modulosPermitidos.includes('mensajeros')
  const isReportsView = isAdmin && hash === '#reportes'
  const { mensajeros, activeRoutes, finishedRoutes, lunchHistory, revisores,
    loading, refreshing, error: dataError, lastUpdated, refresh: fetchData,
  } = useMensajerosData(!loadingRole && hasAccess)

  const handleDelete = async (id: string) => {
    if (!isAdmin) return
    if (confirm('¿Estás seguro de eliminar este mensajero?')) {
      const result = await deleteMensajero(id)
      if (result.success) {
        fetchData()
      } else {
        alert('Error al eliminar: ' + result.error)
      }
    }
  }

  const filteredMensajeros = mensajeros.filter(m => {
    if (statusFilter && m.estado !== statusFilter) return false
    return (m.nombre_conductor ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.placa_conductor ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponible': return 'bg-success-soft text-success border-success/20'
      case 'en_ruta': return 'bg-accent-soft text-accent-foreground border-accent/20'
      case 'en_almuerzo': return 'bg-warning-soft text-warning border-warning/20'
      case 'inactivo': return 'bg-border-strong text-muted border-border-strong'
      default: return 'bg-border-strong text-muted border-border-strong'
    }
  }

  const formatDuration = (start: string, end: string) => {
    if (!start || !end) return 'N/A'
    const s = new Date(start)
    const e = new Date(end)
    const diffMs = e.getTime() - s.getTime()
    const diffMins = Math.round(diffMs / 60000)

    if (diffMins < 60) return `${diffMins} min`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  const handleFinalize = async (routeId: string, mensajeroId: string) => {
    if (confirm('¿Finalizar esta ruta y marcar mensajero como disponible?')) {
      const res = await finalizeRoute(routeId, mensajeroId)
      if (res.success) fetchData()
    }
  }

  const handleStartLunch = async (id: string) => {
    if (confirm('¿Confirmar salida a almuerzo?')) {
      const res = await startLunch(id)
      if (res.success) fetchData()
      else alert('Error al registrar almuerzo: ' + res.error)
    }
  }

  const handleEndLunch = async (id: string) => {
    if (confirm('¿Confirmar regreso de almuerzo?')) {
      const res = await endLunch(id)
      if (res.success) fetchData()
      else alert('Error al registrar regreso: ' + res.error)
    }
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center p-20 text-muted">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        Verificando nivel de acceso...
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center text-muted bg-surface border border-border rounded-2xl">
        <Shield className="w-12 h-12 text-danger/80 mb-4" />
        <h3 className="text-lg font-bold text-foreground">Acceso Denegado</h3>
        <p className="text-sm text-muted mt-1 max-w-sm">No tienes permisos para ver el módulo de Mensajeros. Solicita acceso a un administrador.</p>
      </div>
    )
  }

  const summary = <MensajerosSummary mensajeros={mensajeros} activeRoutes={activeRoutes} lastUpdated={lastUpdated} />

  const refreshStatus = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p role="status" aria-live="polite">
          {lastUpdated ? `Actualizado a las ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}. ` : ''}
          {refreshing ? 'Actualizando datos…' : 'Actualización automática cada 30 segundos.'}
        </p>
        <button type="button" onClick={() => void fetchData()} disabled={refreshing}
          className="btn-secondary gap-2 disabled:opacity-50">
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Actualizar
        </button>
      </div>
      {dataError && <p role="alert" className="rounded-lg border border-warning/20 bg-warning-soft px-4 py-3 text-sm text-warning">
        {dataError} {lastUpdated && 'Se muestran los últimos datos recibidos.'}
      </p>}
    </div>
  )

  // Keep the full existing history and one detail dialog in the operational page.
  const routeHistory = (
    <>
      {/* Historial de Rutas (Día Actual) */}
      <NavigationSection id="registros" className="space-y-4 scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">Historial de Rutas</h3>
            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Resumen Diario</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted bg-subtle px-3 py-1 rounded-full border border-border-strong">
              {lastUpdated ? finishedRoutes.length : '—'} Entregas Completadas
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-subtle">
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Conductor / Placa</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Destino</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Facturas</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Tiempos</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Responsable</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading || (!lastUpdated && dataError) ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted">
                    {loading ? 'Cargando registros…' : 'No se pudieron cargar los registros.'}
                  </td></tr>
                ) : finishedRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted italic">
                      No hay rutas finalizadas en el historial de hoy.
                    </td>
                  </tr>
                ) : (
                  finishedRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-hover transition-colors group">
                      <td className="px-6 py-4 border-l-2 border-transparent hover:border-success/50">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground text-sm tracking-tight">{route.mensajero?.nombre_conductor}</span>
                          <span className="text-[10px] text-muted font-mono italic">{route.mensajero?.placa_conductor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-secondary text-sm">
                          <MapPin className="w-3 h-3 text-muted" />
                          <span className="truncate max-w-[120px]">{route.lugar_entrega}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-muted text-[11px] font-mono line-clamp-1 max-w-[150px]">{route.numero_factura}</span>
                          <span className="text-[9px] text-muted font-bold uppercase tracking-tighter">{route.numero_pedidos} Pedidos</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3 bg-subtle py-2 rounded-xl border border-border">
                          <div className="text-center">
                            <p className="text-[8px] text-muted uppercase font-semibold">Sal</p>
                            <p className="text-[10px] font-mono text-muted">
                              {new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="w-px h-6 bg-subtle"></div>
                          <div className="text-center">
                            <p className="text-[8px] text-success uppercase font-semibold">Lle</p>
                            <p className="text-[10px] font-mono text-success">
                              {new Date(route.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <p className="text-[9px] text-muted font-medium italic">
                            {new Date(route.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[9px] bg-accent-soft text-accent-foreground px-1.5 py-0.5 rounded border border-accent/20 font-bold">
                            <Clock className="size-3" aria-hidden="true" /> {formatDuration(route.hora_salida, route.hora_llegada)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-subtle border border-border-strong flex items-center justify-center text-[10px] text-muted">
                            {route.revisor?.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs text-muted font-medium">{route.revisor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          aria-label={`Ver detalle de la ruta a ${route.lugar_entrega}`}
                          onClick={() => setViewingRoute(route)}
                          className="p-2.5 text-muted hover:text-foreground hover:bg-hover rounded-xl transition-all border border-transparent hover:border-border-strong shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </NavigationSection>
      {viewingRoute && (
        <RouteDetailsModal
          route={viewingRoute}
          onClose={() => setViewingRoute(null)}
        />
      )}
    </>
  )

  if (!isReportsView) {
    return (
      <div className="space-y-12 pb-20">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                Disponibilidad de mensajeros
              </h2>
              <p className="text-muted text-sm mt-1">Consulta la disponibilidad, gestiona las rutas en curso y revisa el historial del día.</p>
            </div>
            {!isAdmin && <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRouteForm(true)}
                className="flex items-center gap-2 bg-success-solid hover:bg-success-solid text-on-accent px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-none active:scale-[0.98]"
              >
                <Route className="w-4 h-4" />
                <span>Asignar Ruta</span>
              </button>
            </div>}
          </div>

          {refreshStatus}

          <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-surface">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o placa..."
                  aria-label="Buscar conductores por nombre o placa"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-subtle border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                />
              </div>
              <select aria-label="Filtrar por estado" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground">
                <option value="">Todos los estados</option>
                <option value="disponible">Disponible</option>
                <option value="en_ruta">En ruta</option>
                <option value="en_almuerzo">En almuerzo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-subtle">
                  <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Conductor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Placa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Ruta actual / destino</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Hora de salida</th>
                  <th className="px-6 py-4 text-right"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-muted text-sm italic">Cargando disponibilidad...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMensajeros.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-muted italic">
                      {dataError && !lastUpdated ? 'No se pudo cargar la disponibilidad.' : searchTerm || statusFilter ? 'No se encontraron conductores para estos filtros.' : 'No hay conductores registrados.'}
                    </td>
                  </tr>
                ) : (
                  filteredMensajeros.map((m) => {
                    const messengerRoutes = activeRoutes.filter(route => route.mensajero_id === m.id)
                    return (
                    <tr key={m.id} className="hover:bg-hover transition-colors group border-b border-border last:border-0">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center text-accent-foreground font-bold border border-border-strong overflow-hidden shadow-inner">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nombre_conductor} className="w-full h-full object-cover" />
                            ) : (
                              m.nombre_conductor.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-bold text-foreground tracking-tight">{m.nombre_conductor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-secondary text-sm font-mono uppercase tracking-widest">{m.placa_conductor}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${getStatusColor(m.estado)} shadow-sm`}>
                          {m.estado ? m.estado.replaceAll('_', ' ') : 'Sin estado'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">
                        {messengerRoutes.length ? <div className="space-y-2">
                          {messengerRoutes.map(route => <button type="button" key={route.id}
                            onClick={() => setViewingRoute(route)} className="block text-left hover:text-accent-foreground hover:underline">
                            <span className="block font-medium">{route.lugar_entrega}</span>
                            <span className="text-xs text-muted">{route.numero_pedidos} pedidos · Ver detalle</span>
                          </button>)}
                        </div> : <span className="text-muted">Sin ruta activa</span>}
                      </td>
                      <td className="px-6 py-4 text-muted text-xs font-medium">
                        {messengerRoutes.length ? messengerRoutes.map(route => <p key={route.id} className="py-1 tabular-nums">
                          {route.hora_salida ? new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sin hora registrada'}
                        </p>) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!isAdmin && m.estado === 'disponible' && (
                            <button
                              onClick={() => handleStartLunch(m.id)}
                              title="Marcar Salida a Almuerzo"
                              className="p-2 rounded-xl text-warning bg-warning-soft hover:bg-warning-solid hover:text-on-accent transition-all border border-warning/20"
                            >
                              <Coffee className="w-4 h-4" />
                            </button>
                          )}
                          {!isAdmin && m.estado === 'en_almuerzo' && (
                            <button
                              onClick={() => handleEndLunch(m.id)}
                              title="Marcar Regreso"
                              className="p-2 rounded-xl text-success bg-success-soft hover:bg-success-solid hover:text-on-accent transition-all border border-success/20 flex items-center gap-2 px-3"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-bold">REGRESAR</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rutas Activas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-foreground">Rutas en Curso</h3>
            <span className="bg-success-soft text-success text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-success/20">
              {activeRoutes.length} Activas
            </span>
          </div>

          {loading || (!lastUpdated && dataError) ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
              {loading ? 'Cargando rutas activas…' : 'No se pudieron cargar las rutas activas.'}
            </div>
          ) : activeRoutes.length === 0 ? (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center text-muted italic">
              No hay rutas activas en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRoutes.map((route) => (
                <div key={route.id} className="bg-surface border border-border rounded-xl p-6 shadow-sm hover:border-accent/30 transition-all group">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-subtle border border-border-strong overflow-hidden shadow-sm">
                        {route.mensajero?.foto_url ? (
                          <img src={route.mensajero.foto_url} alt="Messenger" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-accent-foreground font-bold text-xl">
                            {route.mensajero?.nombre_conductor?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-lg tracking-tight">{route.mensajero?.nombre_conductor}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-accent-soft text-accent-foreground px-2 py-0.5 rounded-md font-mono font-bold uppercase tracking-widest border border-accent/20">
                            {route.mensajero?.placa_conductor}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted uppercase font-semibold tracking-tighter mb-1">Hora Salida</span>
                      <span className="text-sm font-mono text-accent-foreground bg-accent-soft px-3 py-1 rounded-lg border border-accent/10 mb-2">
                        {new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <div className="w-1 h-1 rounded-full bg-border-strong"></div>
                        <span className="text-[9px] text-muted font-medium italic">
                          Registro: {new Date(route.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-muted" />
                      <span className="text-secondary font-medium">{route.lugar_entrega}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Package className="w-4 h-4 text-muted" />
                      <span className="text-secondary">{route.numero_pedidos} Pedidos asignados</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <Search className="w-4 h-4 text-muted mt-0.5" />
                      <div className="flex-1">
                        <p className="text-muted text-[10px] uppercase font-bold tracking-wider mb-1">Facturas</p>
                        <p className="text-muted text-xs line-clamp-2">{route.numero_factura}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm pt-2 border-t border-border">
                      <User className="w-4 h-4 text-muted" />
                      <span className="text-muted text-xs">Revisado por: <span className="text-muted">{route.revisor}</span></span>
                    </div>
                  </div>

                  {!isAdmin && <button
                    onClick={() => handleFinalize(route.id, route.mensajero_id)}
                    className="w-full py-3 bg-subtle hover:bg-success-solid text-foreground hover:text-on-accent rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:shadow-none shadow-inner"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar Finalizado
                  </button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {routeHistory}

        {/* Preserve the existing operational lunch controls. */}
        {!isAdmin && <div className="space-y-4 pt-8 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-foreground">Control de Almuerzos</h3>
              <span className="text-[10px] text-muted uppercase tracking-widest font-bold">Bitácora Diaria</span>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-subtle">
                    <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Mensajero / Placa</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Salida</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Referencia</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Regreso</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lunchHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted italic">
                        No hay registros de almuerzo el día de hoy.
                      </td>
                    </tr>
                  ) : (
                    lunchHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-hover transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground text-sm tracking-tight">{log.mensajero?.nombre_conductor}</span>
                            <span className="text-[10px] text-muted font-mono">{log.mensajero?.placa_conductor}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-mono text-muted">
                            {new Date(log.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[11px] text-muted italic">
                            {new Date(log.fecha).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log.hora_entrada ? (
                            <span className="text-sm font-mono text-success font-bold">
                              {new Date(log.hora_entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-warning-soft text-warning px-2 py-1 rounded-full animate-pulse border border-warning/20 font-semibold">
                              EN ALMUERZO
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {log.hora_entrada && (
                            <span className="text-sm font-bold text-foreground">
                              {formatDuration(log.hora_salida, log.hora_entrada)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>}

        {!isAdmin && showRouteForm && (
          <RouteForm
            mensajeros={mensajeros.filter(m => m.estado === 'disponible' || !m.estado)}
            revisores={revisores}
            onSuccess={() => {
              setShowRouteForm(false)
              fetchData()
            }}
            onCancel={() => setShowRouteForm(false)}
          />
        )}

      </div>
    )
  }

  return <MensajerosReports summary={summary} refreshStatus={refreshStatus} />
}
