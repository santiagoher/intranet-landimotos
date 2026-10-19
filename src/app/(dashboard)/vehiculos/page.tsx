'use client'

import { useEffect, useState } from 'react'
import { Truck, Plus, ClipboardCheck, AlertTriangle, CheckCircle, Calendar, User, Search, Edit, Trash2, SlidersHorizontal, Info, Eye, ShieldAlert } from 'lucide-react'
import { getVehiculos, getChecklists, getAlertas, deleteVehiculo } from './actions'
import { VehicleForm } from './VehicleForm'
import { ChecklistForm } from './ChecklistForm'
import { AlertResolutionModal } from './AlertResolutionModal'
import { ChecklistDetailsModal } from './ChecklistDetailsModal'
import { VehicleStats } from './VehicleStats'
import { useRole } from '@/hooks/useRole'
import { createClient } from '@/utils/supabase/client'
import { TablePagination, usePagination } from '@/components/TablePagination'
import { Vehicle, Checklist, Alerta } from './types'

interface UserProfile {
  id: string
  nombre: string
  rol: 'Admin' | 'Operativo'
  modulos_permitidos: string[]
}

function getFailedDetailText(c: any) {
  if (!c) return ''
  const failed = []
  if (c.espejos === 'm') failed.push('Retrovisores')
  if (c.luces === 'm') failed.push('Luces')
  if (c.frenos === 'm') failed.push('Frenos')
  if (c.llantas === 'm') failed.push('Llantas/Suspensión')
  if (c.aceite_motor === 'm') failed.push('Aceite Motor')
  if (c.liquido_frenos === 'm') failed.push('Líq. Frenos')
  if (c.carroceria === 'm') failed.push('Carrocería/Arrastre')
  if (c.documentos === 'm') failed.push('Documentación')
  return failed.join(', ')
}

export default function VehiculosPage() {
  const { rol, isAdmin, modulosPermitidos, loading: loadingRole } = useRole()

  // Data states
  const [vehiculos, setVehiculos] = useState<Vehicle[]>([])
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Modals & Active actions
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [showChecklistForm, setShowChecklistForm] = useState(false)
  const [selectedAlerta, setSelectedAlerta] = useState<Alerta | null>(null)
  const [viewingChecklist, setViewingChecklist] = useState<Checklist | null>(null)

  // Filters for reports/checklists
  const getTodayStr = () => new Date().toISOString().split('T')[0]
  const getDaysAgoStr = (days: number) => {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().split('T')[0]
  }

  const [startDate, setStartDate] = useState(getDaysAgoStr(7))
  const [endDate, setEndDate] = useState(getTodayStr())
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all')

  // UI Tabs (Admin only)
  const [activeTab, setActiveTab] = useState<'novedades' | 'flota' | 'historial' | 'graficos'>('novedades')

  // Pagination states for checklists history
  const [currentPage, setCurrentPage] = useState(1)

  // Removed manual fetchPerfil effect

  const refreshData = async () => {
    // We let useEffect control the loading states to avoid triggering react-hooks warnings
    try {
      const [vData, cData, aData] = await Promise.all([
        getVehiculos(),
        getChecklists(startDate, endDate, selectedVehicleFilter),
        getAlertas()
      ])
      setVehiculos(vData as Vehicle[])
      setChecklists(cData as Checklist[])
      setAlertas(aData as Alerta[])
    } catch (err) {
      console.error('Error fetching vehicle module data:', err)
    }
  }

  // Load and refresh data when page loads or filters change
  useEffect(() => {
    if (loadingRole) return

    let active = true

    // Schedule state update to avoid calling setState during render/commit phase
    const timer = setTimeout(() => {
      if (active) setLoadingData(true)
    }, 0)

    async function load() {
      try {
        const [vData, cData, aData] = await Promise.all([
          getVehiculos(),
          getChecklists(startDate, endDate, selectedVehicleFilter),
          getAlertas()
        ])
        if (active) {
          setVehiculos(vData as Vehicle[])
          setChecklists(cData as Checklist[])
          setAlertas(aData as Alerta[])
          setCurrentPage(1) // Reset pagination on data refresh
          setLoadingData(false)
        }
      } catch (err) {
        console.error(err)
        if (active) setLoadingData(false)
      }
    }

    load()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [loadingRole, startDate, endDate, selectedVehicleFilter])

  const handleDeleteVehicle = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este vehículo permanentemente? Se eliminarán también todos sus checklists y alertas relacionadas.')) {
      try {
        const res = await deleteVehiculo(id)
        if (res.error) {
          alert(`Error al eliminar: ${res.error}`)
        } else {
          refreshData()
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  // Pagination for checklists table
  const { totalItems, totalPages, pageSize, paginate } = usePagination(checklists, 15)
  const paginatedChecklists = paginate(currentPage)

  // Loading states screen
  if (loadingRole) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted animate-pulse">
        <Truck className="w-8 h-8 mb-4 opacity-20 animate-bounce" />
        <p className="text-sm font-medium">Verificando permisos y accesos...</p>
      </div>
    )
  }

  const hasAccess = isAdmin || modulosPermitidos.includes('vehiculos')

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center text-muted bg-surface border border-border rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-danger/80 mb-4" />
        <h3 className="text-lg font-bold text-foreground">Acceso Denegado</h3>
        <p className="text-sm text-muted mt-1 max-w-sm">No tienes permisos para ver el módulo de Vehículos. Solicita acceso a un administrador.</p>
      </div>
    )
  }

  // Render Operativo Screen
  if (!isAdmin) {
    const misChecklistsHoy = checklists.filter(c => {
      const checklistDate = new Date(c.created_at).toDateString()
      const todayDate = new Date().toDateString()
      return checklistDate === todayDate
    })

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              Control Diario de Vehículos
            </h2>
            <p className="text-muted text-sm mt-1">Registra la inspección diaria obligatoria de tu vehículo asignado antes de iniciar ruta.</p>
          </div>

          <button
            onClick={() => setShowChecklistForm(true)}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-on-accent px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-none active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Checklist Diario</span>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-surface border border-border p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="p-2.5 bg-accent-soft text-accent-foreground rounded-xl mt-0.5 md:mt-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-foreground font-bold text-sm">Estado de Reportes Hoy</h4>
              <p className="text-xs text-muted mt-0.5">
                {misChecklistsHoy.length > 0 
                  ? `Has registrado ${misChecklistsHoy.length} checklist(s) el día de hoy.`
                  : 'Aún no registras ningún control el día de hoy. ¡Es obligatorio registrarlo antes de salir!'}
              </p>
            </div>
          </div>
          {misChecklistsHoy.length > 0 ? (
            <span className="text-xs bg-success-soft text-success border border-success/20 px-3 py-1 rounded-full font-semibold">
              Control Completado
            </span>
          ) : (
            <span className="text-xs bg-warning-soft text-warning border border-warning/20 px-3 py-1 rounded-full font-semibold animate-pulse">
              Pendiente de Registro
            </span>
          )}
        </div>

        {/* Mis Checklists Recientes */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            Mis Registros Recientes
          </h3>

          {loadingData ? (
            <div className="py-12 text-center text-muted text-sm">Cargando tus checklists...</div>
          ) : checklists.length === 0 ? (
            <div className="py-12 text-center text-muted border border-dashed border-border rounded-xl">
              <ClipboardCheck className="w-10 h-10 mx-auto text-muted mb-2" />
              <p className="text-sm italic">No has registrado ningún checklist en los últimos 7 días.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Vehículo</th>
                    <th className="py-3 px-4">Kilometraje</th>
                    <th className="py-3 px-4">Estado General</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {checklists.map((c) => (
                    <tr key={c.id} className="hover:bg-hover transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {c.vehiculo?.placa} 
                        <span className="text-xs text-muted font-normal block">{c.vehiculo?.marca} {c.vehiculo?.modelo}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-secondary">
                        {c.kilometraje.toLocaleString()} km
                      </td>
                      <td className="py-3.5 px-4">
                        {c.tiene_novedad ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-soft border border-danger/20 text-danger">
                            <AlertTriangle className="w-3 h-3" /> Con novedad
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-soft border border-success/20 text-success">
                            <CheckCircle className="w-3 h-3" /> Sin novedades
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-muted">
                        <p>{new Date(c.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-muted">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                      </td>
                      <td className="py-3.5 px-4 text-muted italic max-w-xs truncate">
                        {c.observaciones || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setViewingChecklist(c)}
                          className="text-accent-foreground hover:text-accent-foreground text-xs font-semibold bg-accent-soft hover:bg-accent-soft px-3 py-1.5 rounded-xl transition-all"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showChecklistForm && (
          <ChecklistForm
            vehiculos={vehiculos}
            onSuccess={() => {
              setShowChecklistForm(false)
              refreshData()
            }}
            onCancel={() => setShowChecklistForm(false)}
          />
        )}
      </div>
    )
  }

  // Render Admin Screen (Dashboard)
  const pendingAlertas = alertas.filter(a => a.estado === 'pendiente')
  const resolvedAlertas = alertas.filter(a => a.estado === 'solucionado')

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Consola de Administración de Vehículos
          </h2>
          <p className="text-muted text-sm mt-1">Supervisión técnica de la flota, alertas mecánicas y reportes operativos.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setEditingVehicle(null)
              setShowVehicleForm(true)
            }}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-on-accent px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-none active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Vehículo</span>
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-border flex gap-2 overflow-x-auto flex-nowrap pb-px">
        {(
          [
            { id: 'novedades', label: 'Fallas e Irregularidades', count: pendingAlertas.length },
            { id: 'flota', label: 'Vehículos Agregados (Flota)', count: vehiculos.length },
            { id: 'historial', label: 'Historial de Controles', count: null },
            { id: 'graficos', label: 'Estadísticas de Flota', count: null }
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-all relative shrink-0 -mb-px ${
              activeTab === tab.id
                ? 'border-accent text-foreground font-bold bg-accent-soft'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  tab.id === 'novedades' && tab.count > 0 
                    ? 'bg-danger-solid text-on-accent animate-pulse'
                    : 'bg-subtle text-muted'
                }`}>
                  {tab.count}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* TAB CONTENT: Graficos */}
      {activeTab === 'graficos' && (
        <VehicleStats
          vehiculos={vehiculos}
          checklists={checklists}
          alertas={alertas}
        />
      )}

      {/* TAB CONTENT: Alertas y Novedades */}
      {activeTab === 'novedades' && (
        <div className="space-y-6">
          {/* Pendientes */}
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              Alertas Activas (Pendientes de Solución)
            </h3>

            {loadingData ? (
              <div className="py-12 text-center text-muted text-sm">Cargando alertas...</div>
            ) : pendingAlertas.length === 0 ? (
              <div className="py-12 text-center text-muted border border-dashed border-border rounded-xl">
                <CheckCircle className="w-12 h-12 mx-auto text-success/30 mb-3" />
                <p className="text-success font-bold">¡Sin novedades pendientes!</p>
                <p className="text-xs text-muted mt-1">Todos los vehículos operan con normalidad en este momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingAlertas.map((a) => (
                  <div key={a.id} className="bg-subtle border border-border rounded-xl p-4 flex flex-col justify-between hover:border-border-strong transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 font-mono text-xs font-bold bg-danger-soft border border-danger/20 text-danger rounded-md">
                          {a.vehiculo?.placa}
                        </span>
                        <span className="text-[10px] text-muted">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground mt-2">
                        {a.vehiculo?.marca} {a.vehiculo?.modelo}
                      </h4>
                      <p className="text-xs text-muted mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> Reporta: {a.checklist?.conductor_nombre || a.usuario?.nombre || 'Conductor'}
                      </p>
                      
                      {/* Detalle de Fallas */}
                      {a.checklist && (
                        <div className="mt-3 text-xs bg-danger-soft border border-danger/10 p-2.5 rounded-lg">
                          <span className="font-bold text-danger block mb-1">Fallas Detectadas:</span>
                          <span className="text-danger font-semibold">{getFailedDetailText(a.checklist) || 'Novedad general'}</span>
                        </div>
                      )}
                      
                      {/* Mostrar observaciones */}
                      <p className="text-xs text-muted italic mt-2.5 bg-surface p-2.5 rounded-lg border border-border leading-normal">
                        &ldquo;{a.checklist?.observaciones || 'Sin observaciones detalladas.'}&rdquo;
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedAlerta(a)}
                      className="mt-4 w-full bg-danger-solid hover:bg-danger-solid text-on-accent text-xs font-semibold py-2 rounded-lg transition-all shadow-md active:scale-95"
                    >
                      Revisar y Solucionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solucionadas */}
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Historial de Novedades Solucionadas</h3>
            
            {loadingData ? (
              <div className="py-12 text-center text-muted text-sm">Cargando historial...</div>
            ) : resolvedAlertas.length === 0 ? (
              <div className="py-8 text-center text-muted text-sm italic">
                No hay alertas solucionadas registradas en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Placa / Unidad</th>
                      <th className="py-3 px-4">Reportó</th>
                      <th className="py-3 px-4">Fecha Solución</th>
                      <th className="py-3 px-4">Acción Realizada / Notas del Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {resolvedAlertas.map((a) => (
                      <tr key={a.id} className="text-secondary hover:bg-hover">
                        <td className="py-3.5 px-4 font-bold text-foreground">
                          {a.vehiculo?.placa}
                          <span className="text-[10px] text-muted font-normal block">{a.vehiculo?.marca}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <p className="text-foreground">{a.checklist?.conductor_nombre || a.usuario?.nombre || 'Conductor'}</p>
                          <p className="text-[10px] text-muted">{new Date(a.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted">
                          <p>{a.resolved_at ? new Date(a.resolved_at).toLocaleDateString() : '—'}</p>
                          <p className="text-[10px] text-muted">{a.resolved_at ? new Date(a.resolved_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs max-w-sm leading-normal">
                          <span className="inline-block px-1.5 py-0.5 mb-1 bg-success-soft text-success border border-success/20 text-[10px] rounded font-bold uppercase tracking-wider">
                            Resuelto
                          </span>
                          <p className="italic text-muted">&ldquo;{a.comentarios_admin}&rdquo;</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Mantenimiento de Flota */}
      {activeTab === 'flota' && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden min-h-[350px]">
          {loadingData ? (
            <div className="flex items-center justify-center py-20 text-muted">Cargando flota...</div>
          ) : vehiculos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Truck className="w-12 h-12 text-muted mb-4" />
              <p className="font-semibold text-foreground">Aún no hay vehículos creados.</p>
              <p className="text-xs text-muted mt-1">Haz clic en &quot;Agregar Vehículo&quot; para registrar el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-subtle border-b border-border text-muted text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Placa / Código</th>
                    <th className="py-4 px-6">Tipo</th>
                    <th className="py-4 px-6">Especificaciones</th>
                    <th className="py-4 px-6">Kilometraje Acumulado</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {vehiculos.map((v) => (
                    <tr key={v.id} className="hover:bg-hover transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-accent-foreground text-base">
                        {v.placa}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          v.tipo === 'Moto' 
                            ? 'bg-info-soft text-info border-info/20'
                            : v.tipo === 'Carro' 
                              ? 'bg-warning-soft text-warning border-warning/20'
                              : 'bg-subtle text-muted border-border-strong'
                        }`}>
                          {v.tipo}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-foreground font-medium">
                        {v.marca}
                        {v.modelo && <span className="text-xs text-muted font-normal block">{v.modelo}</span>}
                      </td>
                      <td className="py-4 px-6 font-mono text-secondary font-semibold">
                        {v.kilometraje.toLocaleString()} km
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          v.estado === 'activo' 
                            ? 'text-success'
                            : v.estado === 'mantenimiento' 
                              ? 'text-warning animate-pulse'
                              : 'text-muted'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            v.estado === 'activo' 
                              ? 'bg-success-solid'
                              : v.estado === 'mantenimiento' 
                                ? 'bg-warning-solid'
                                : 'bg-border-strong'
                          }`}></span>
                          {v.estado === 'activo' ? 'Activo' : v.estado === 'mantenimiento' ? 'Mantenimiento' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingVehicle(v)
                            setShowVehicleForm(true)
                          }}
                          className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors inline-block"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-colors inline-block"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Reportes e Historial */}
      {activeTab === 'historial' && (
        <div className="space-y-6">
          {/* Filters card */}
          <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-subtle px-3 py-2 rounded-xl border border-border">
                <Calendar className="w-4 h-4 text-muted" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-secondary text-xs focus:ring-0 outline-none w-28 cursor-pointer"
                  title="Fecha inicio"
                />
                <span className="text-muted text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-secondary text-xs focus:ring-0 outline-none w-28 cursor-pointer"
                  title="Fecha fin"
                />
              </div>

              <div className="flex items-center gap-2 bg-subtle px-3 py-2 rounded-xl border border-border">
                <SlidersHorizontal className="w-4 h-4 text-muted" />
                <select
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="bg-transparent border-none text-secondary text-xs focus:ring-0 outline-none appearance-none pr-6 cursor-pointer"
                  title="Filtrar por Vehículo"
                >
                  <option value="all">Todos los vehículos</option>
                  {vehiculos.map(v => (
                    <option key={v.id} value={v.id}>{v.placa}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={refreshData}
              className="flex items-center justify-center gap-2 bg-subtle hover:bg-hover border border-border-strong text-foreground text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            >
              <Search className="w-3.5 h-3.5 text-muted" />
              <span>Consultar</span>
            </button>
          </div>

          {/* Table list */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden min-h-[350px]">
            {loadingData ? (
              <div className="flex items-center justify-center py-20 text-muted">Consultando base de datos...</div>
            ) : checklists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted">
                <ClipboardCheck className="w-12 h-12 text-muted mb-4" />
                <p className="font-semibold text-foreground">No se encontraron reportes.</p>
                <p className="text-xs text-muted mt-1">Prueba a expandir el rango de fechas en los filtros.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-subtle border-b border-border text-muted text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-6">Placa</th>
                        <th className="py-4 px-6">Conductor</th>
                        <th className="py-4 px-6">Kilometraje</th>
                        <th className="py-4 px-6 text-center">Estado del Checklist (B: Bien, M: Mal, NA)</th>
                        <th className="py-4 px-6">Fecha Reporte</th>
                        <th className="py-4 px-6">Observaciones</th>
                        <th className="py-4 px-6 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-secondary">
                      {paginatedChecklists.map((c) => (
                        <tr key={c.id} className="hover:bg-hover transition-colors">
                          <td className="py-4 px-6 font-bold text-foreground font-mono">
                            {c.vehiculo?.placa}
                          </td>
                          <td className="py-4 px-6 font-medium text-foreground">
                            {c.conductor_nombre || c.usuario?.nombre || 'Conductor'}
                          </td>
                          <td className="py-4 px-6 font-mono text-muted">
                            {c.kilometraje.toLocaleString()} km
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 items-center">
                              {c.tiene_novedad ? (
                                <>
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-danger-soft border border-danger/20 text-danger rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Con Novedad
                                  </span>
                                  <span className="text-[10px] text-danger font-bold text-center max-w-[150px] leading-tight mt-0.5">
                                    {getFailedDetailText(c)}
                                  </span>
                                </>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-success-soft border border-success/20 text-success rounded-full flex items-center gap-1">
                                  <CheckCircle className="w-2.5 h-2.5" /> Sin Novedad
                                </span>
                              )}
                              {/* Grid rápido de estados */}
                              <div className="flex gap-1 mt-1 text-[8px] font-mono">
                                <span className={`px-1 rounded ${(c.luces || 'b') === 'm' ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'}`} title="Luces">L:{(c.luces || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.frenos || 'b') === 'm' ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'}`} title="Frenos">F:{(c.frenos || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.llantas || 'b') === 'm' ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'}`} title="Llantas">LL:{(c.llantas || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.aceite_motor || 'b') === 'm' ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'}`} title="Aceite">A:{(c.aceite_motor || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.documentos || 'b') === 'm' ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'}`} title="Documentos">D:{(c.documentos || 'b').toUpperCase()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-xs text-muted">
                            <p>{new Date(c.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] text-muted">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                          </td>
                          <td className="py-4 px-6 italic text-muted max-w-xs truncate" title={c.observaciones}>
                            {c.observaciones || '-'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setViewingChecklist(c)}
                              className="text-accent-foreground hover:text-foreground p-2 bg-accent-soft hover:bg-accent-hover rounded-xl transition-all flex items-center justify-center inline-flex shadow-sm active:scale-95"
                              title="Ver reporte detallado"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Forms & Modals rendering */}
      {showVehicleForm && (
        <VehicleForm
          vehicle={editingVehicle || undefined}
          onSuccess={() => {
            setShowVehicleForm(false)
            setEditingVehicle(null)
            refreshData()
          }}
          onCancel={() => {
            setShowVehicleForm(false)
            setEditingVehicle(null)
          }}
        />
      )}

      {showChecklistForm && (
        <ChecklistForm
          vehiculos={vehiculos}
          onSuccess={() => {
            setShowChecklistForm(false)
            refreshData()
          }}
          onCancel={() => setShowChecklistForm(false)}
        />
      )}

      {selectedAlerta && (
        <AlertResolutionModal
          alerta={selectedAlerta}
          onSuccess={() => {
            setSelectedAlerta(null)
            refreshData()
          }}
          onCancel={() => setSelectedAlerta(null)}
        />
      )}

      {viewingChecklist && (
        <ChecklistDetailsModal
          checklist={viewingChecklist}
          onClose={() => setViewingChecklist(null)}
        />
      )}
    </div>
  )
}
