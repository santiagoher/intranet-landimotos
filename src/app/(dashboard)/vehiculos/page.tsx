'use client'

import { useEffect, useState } from 'react'
import { 
  Truck, 
  Plus, 
  ClipboardCheck, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Calendar, 
  User, 
  Search, 
  Edit, 
  Trash2, 
  History, 
  SlidersHorizontal,
  Info,
  Eye
} from 'lucide-react'
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
  const { rol, isAdmin, loading: loadingRole } = useRole()
  const [perfil, setPerfil] = useState<UserProfile | null>(null)
  const [loadingPerfil, setLoadingPerfil] = useState(true)

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

  // Check access permission securely on client side
  useEffect(() => {
    async function fetchPerfil() {
      if (loadingRole || !rol) return
      setLoadingPerfil(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', user.id)
            .single()
          setPerfil(data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingPerfil(false)
      }
    }
    fetchPerfil()
  }, [rol, loadingRole])

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
    if (loadingRole || loadingPerfil) return

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
  }, [loadingRole, loadingPerfil, startDate, endDate, selectedVehicleFilter])

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
  if (loadingRole || (loadingPerfil && !isAdmin)) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-neutral-500 animate-pulse">
        <Truck className="w-8 h-8 mb-4 opacity-20 animate-bounce" />
        <p className="text-sm font-medium">Verificando permisos y accesos...</p>
      </div>
    )
  }

  const hasAccess = isAdmin || rol === 'Operativo' || (perfil?.modulos_permitidos?.includes('vehiculos'))

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center text-neutral-500 bg-neutral-900/40 border border-neutral-800 rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-rose-500/80 mb-4" />
        <h3 className="text-lg font-bold text-white">Acceso Denegado</h3>
        <p className="text-sm text-neutral-400 mt-1 max-w-sm">No tienes permisos para ver el módulo de Vehículos. Solicita acceso a un administrador.</p>
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
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-500" />
              Control Diario de Vehículos
            </h2>
            <p className="text-neutral-400 text-sm mt-1">Registra la inspección diaria obligatoria de tu vehículo asignado antes de iniciar ruta.</p>
          </div>

          <button
            onClick={() => setShowChecklistForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Checklist Diario</span>
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-3 items-start">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl mt-0.5 md:mt-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm">Estado de Reportes Hoy</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                {misChecklistsHoy.length > 0 
                  ? `Has registrado ${misChecklistsHoy.length} checklist(s) el día de hoy.`
                  : 'Aún no registras ningún control el día de hoy. ¡Es obligatorio registrarlo antes de salir!'}
              </p>
            </div>
          </div>
          {misChecklistsHoy.length > 0 ? (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold">
              Control Completado
            </span>
          ) : (
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-semibold animate-pulse">
              Pendiente de Registro
            </span>
          )}
        </div>

        {/* Mis Checklists Recientes */}
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-neutral-400" />
            Mis Registros Recientes
          </h3>

          {loadingData ? (
            <div className="py-12 text-center text-neutral-500 text-sm">Cargando tus checklists...</div>
          ) : checklists.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
              <ClipboardCheck className="w-10 h-10 mx-auto text-neutral-800 mb-2" />
              <p className="text-sm italic">No has registrado ningún checklist en los últimos 7 días.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Vehículo</th>
                    <th className="py-3 px-4">Kilometraje</th>
                    <th className="py-3 px-4">Estado General</th>
                    <th className="py-3 px-4">Fecha y Hora</th>
                    <th className="py-3 px-4">Observaciones</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40 text-sm">
                  {checklists.map((c) => (
                    <tr key={c.id} className="hover:bg-neutral-800/20 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {c.vehiculo?.placa} 
                        <span className="text-xs text-neutral-500 font-normal block">{c.vehiculo?.marca} {c.vehiculo?.modelo}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-300">
                        {c.kilometraje.toLocaleString()} km
                      </td>
                      <td className="py-3.5 px-4">
                        {c.tiene_novedad ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            <AlertTriangle className="w-3 h-3" /> Con novedad
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <CheckCircle className="w-3 h-3" /> Sin novedades
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400">
                        <p>{new Date(c.created_at).toLocaleDateString()}</p>
                        <p className="text-[10px] text-neutral-500">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 italic max-w-xs truncate">
                        {c.observaciones || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setViewingChecklist(c)}
                          className="text-blue-450 hover:text-blue-355 text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl transition-all"
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
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Consola de Administración de Vehículos
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Supervisión técnica de la flota, alertas mecánicas y reportes operativos.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setEditingVehicle(null)
              setShowVehicleForm(true)
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Vehículo</span>
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="border-b border-neutral-850 flex gap-2 overflow-x-auto flex-nowrap pb-px">
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
                ? 'border-blue-500 text-white font-bold bg-blue-500/5'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  tab.id === 'novedades' && tab.count > 0 
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-neutral-800 text-neutral-400'
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
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Alertas Activas (Pendientes de Solución)
            </h3>

            {loadingData ? (
              <div className="py-12 text-center text-neutral-500 text-sm">Cargando alertas...</div>
            ) : pendingAlertas.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                <CheckCircle className="w-12 h-12 mx-auto text-emerald-500/30 mb-3" />
                <p className="text-emerald-400 font-bold">¡Sin novedades pendientes!</p>
                <p className="text-xs text-neutral-500 mt-1">Todos los vehículos operan con normalidad en este momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingAlertas.map((a) => (
                  <div key={a.id} className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="px-2 py-0.5 font-mono text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-md">
                          {a.vehiculo?.placa}
                        </span>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(a.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-2">
                        {a.vehiculo?.marca} {a.vehiculo?.modelo}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" /> Reporta: {a.checklist?.conductor_nombre || a.usuario?.nombre || 'Conductor'}
                      </p>
                      
                      {/* Detalle de Fallas */}
                      {a.checklist && (
                        <div className="mt-3 text-xs bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                          <span className="font-bold text-rose-450 block mb-1">Fallas Detectadas:</span>
                          <span className="text-rose-200 font-semibold">{getFailedDetailText(a.checklist) || 'Novedad general'}</span>
                        </div>
                      )}
                      
                      {/* Mostrar observaciones */}
                      <p className="text-xs text-neutral-400 italic mt-2.5 bg-neutral-900/50 p-2.5 rounded-lg border border-neutral-900 leading-normal">
                        &ldquo;{a.checklist?.observaciones || 'Sin observaciones detalladas.'}&rdquo;
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedAlerta(a)}
                      className="mt-4 w-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold py-2 rounded-lg transition-all shadow-md active:scale-95"
                    >
                      Revisar y Solucionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solucionadas */}
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Historial de Novedades Solucionadas</h3>
            
            {loadingData ? (
              <div className="py-12 text-center text-neutral-500 text-sm">Cargando historial...</div>
            ) : resolvedAlertas.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm italic">
                No hay alertas solucionadas registradas en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Placa / Unidad</th>
                      <th className="py-3 px-4">Reportó</th>
                      <th className="py-3 px-4">Fecha Solución</th>
                      <th className="py-3 px-4">Acción Realizada / Notas del Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/40">
                    {resolvedAlertas.map((a) => (
                      <tr key={a.id} className="text-neutral-300 hover:bg-neutral-800/10">
                        <td className="py-3.5 px-4 font-bold text-white">
                          {a.vehiculo?.placa}
                          <span className="text-[10px] text-neutral-500 font-normal block">{a.vehiculo?.marca}</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <p className="text-white">{a.checklist?.conductor_nombre || a.usuario?.nombre || 'Conductor'}</p>
                          <p className="text-[10px] text-neutral-500">{new Date(a.created_at).toLocaleDateString()}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-neutral-400">
                          <p>{a.resolved_at ? new Date(a.resolved_at).toLocaleDateString() : '—'}</p>
                          <p className="text-[10px] text-neutral-500">{a.resolved_at ? new Date(a.resolved_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs max-w-sm leading-normal">
                          <span className="inline-block px-1.5 py-0.5 mb-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] rounded font-bold uppercase tracking-wider">
                            Resuelto
                          </span>
                          <p className="italic text-neutral-400">&ldquo;{a.comentarios_admin}&rdquo;</p>
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
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-hidden min-h-[350px]">
          {loadingData ? (
            <div className="flex items-center justify-center py-20 text-neutral-500">Cargando flota...</div>
          ) : vehiculos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <Truck className="w-12 h-12 text-neutral-800 mb-4" />
              <p className="font-semibold text-white">Aún no hay vehículos creados.</p>
              <p className="text-xs text-neutral-500 mt-1">Haz clic en &quot;Agregar Vehículo&quot; para registrar el primero.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Placa / Código</th>
                    <th className="py-4 px-6">Tipo</th>
                    <th className="py-4 px-6">Especificaciones</th>
                    <th className="py-4 px-6">Kilometraje Acumulado</th>
                    <th className="py-4 px-6">Estado</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40 text-sm">
                  {vehiculos.map((v) => (
                    <tr key={v.id} className="hover:bg-neutral-800/20 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-blue-400 text-base">
                        {v.placa}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          v.tipo === 'Moto' 
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                            : v.tipo === 'Carro' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                        }`}>
                          {v.tipo}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-white font-medium">
                        {v.marca}
                        {v.modelo && <span className="text-xs text-neutral-500 font-normal block">{v.modelo}</span>}
                      </td>
                      <td className="py-4 px-6 font-mono text-neutral-300 font-semibold">
                        {v.kilometraje.toLocaleString()} km
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          v.estado === 'activo' 
                            ? 'text-emerald-400' 
                            : v.estado === 'mantenimiento' 
                              ? 'text-amber-400 animate-pulse' 
                              : 'text-neutral-500'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${
                            v.estado === 'activo' 
                              ? 'bg-emerald-500' 
                              : v.estado === 'mantenimiento' 
                                ? 'bg-amber-500' 
                                : 'bg-neutral-500'
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
                          className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors inline-block"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors inline-block"
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
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-neutral-950 px-3 py-2 rounded-xl border border-neutral-800">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-neutral-300 text-xs focus:ring-0 outline-none w-28 cursor-pointer"
                  title="Fecha inicio"
                />
                <span className="text-neutral-700 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-neutral-300 text-xs focus:ring-0 outline-none w-28 cursor-pointer"
                  title="Fecha fin"
                />
              </div>

              <div className="flex items-center gap-2 bg-neutral-950 px-3 py-2 rounded-xl border border-neutral-800">
                <SlidersHorizontal className="w-4 h-4 text-neutral-500" />
                <select
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="bg-transparent border-none text-neutral-300 text-xs focus:ring-0 outline-none appearance-none pr-6 cursor-pointer"
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
              className="flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700/50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all"
            >
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <span>Consultar</span>
            </button>
          </div>

          {/* Table list */}
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-hidden min-h-[350px]">
            {loadingData ? (
              <div className="flex items-center justify-center py-20 text-neutral-500">Consultando base de datos...</div>
            ) : checklists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                <ClipboardCheck className="w-12 h-12 text-neutral-800 mb-4" />
                <p className="font-semibold text-white">No se encontraron reportes.</p>
                <p className="text-xs text-neutral-500 mt-1">Prueba a expandir el rango de fechas en los filtros.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-6">Placa</th>
                        <th className="py-4 px-6">Conductor</th>
                        <th className="py-4 px-6">Kilometraje</th>
                        <th className="py-4 px-6 text-center">Estado del Checklist (B: Bien, M: Mal, NA)</th>
                        <th className="py-4 px-6">Fecha Reporte</th>
                        <th className="py-4 px-6">Observaciones</th>
                        <th className="py-4 px-6 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/40 text-neutral-300">
                      {paginatedChecklists.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-800/20 transition-colors">
                          <td className="py-4 px-6 font-bold text-white font-mono">
                            {c.vehiculo?.placa}
                          </td>
                          <td className="py-4 px-6 font-medium text-neutral-200">
                            {c.conductor_nombre || c.usuario?.nombre || 'Conductor'}
                          </td>
                          <td className="py-4 px-6 font-mono text-neutral-400">
                            {c.kilometraje.toLocaleString()} km
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1 items-center">
                              {c.tiene_novedad ? (
                                <>
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Con Novedad
                                  </span>
                                  <span className="text-[10px] text-rose-350 font-bold text-center max-w-[150px] leading-tight mt-0.5">
                                    {getFailedDetailText(c)}
                                  </span>
                                </>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1">
                                  <CheckCircle className="w-2.5 h-2.5" /> Sin Novedad
                                </span>
                              )}
                              {/* Grid rápido de estados */}
                              <div className="flex gap-1 mt-1 text-[8px] font-mono">
                                <span className={`px-1 rounded ${(c.luces || 'b') === 'm' ? 'bg-rose-900/40 text-rose-400' : 'bg-neutral-800 text-neutral-400'}`} title="Luces">L:{(c.luces || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.frenos || 'b') === 'm' ? 'bg-rose-900/40 text-rose-400' : 'bg-neutral-800 text-neutral-400'}`} title="Frenos">F:{(c.frenos || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.llantas || 'b') === 'm' ? 'bg-rose-900/40 text-rose-400' : 'bg-neutral-800 text-neutral-400'}`} title="Llantas">LL:{(c.llantas || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.aceite_motor || 'b') === 'm' ? 'bg-rose-900/40 text-rose-400' : 'bg-neutral-800 text-neutral-400'}`} title="Aceite">A:{(c.aceite_motor || 'b').toUpperCase()}</span>
                                <span className={`px-1 rounded ${(c.documentos || 'b') === 'm' ? 'bg-rose-900/40 text-rose-400' : 'bg-neutral-800 text-neutral-400'}`} title="Documentos">D:{(c.documentos || 'b').toUpperCase()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-xs text-neutral-400">
                            <p>{new Date(c.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] text-neutral-500">{new Date(c.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                          </td>
                          <td className="py-4 px-6 italic text-neutral-400 max-w-xs truncate" title={c.observaciones}>
                            {c.observaciones || '-'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => setViewingChecklist(c)}
                              className="text-blue-500 hover:text-white p-2 bg-blue-500/10 hover:bg-blue-600 rounded-xl transition-all flex items-center justify-center inline-flex shadow-sm active:scale-95"
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
