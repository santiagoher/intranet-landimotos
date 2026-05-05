'use client'

import { useEffect, useState, useMemo } from 'react'
import { Truck, Plus, Search, Edit2, Trash2, MapPin, Package, Clock, User, CheckCircle2, Coffee, Route, ClipboardList, Eye, Utensils, Calendar as CalendarIcon, FileText, CalendarRange, X, Download, FileDown, Calendar } from 'lucide-react'
import { 
  getMensajeros, deleteMensajero, updateMensajeroStatus, 
  getActiveRoutes, finalizeRoute, getFinishedRoutes, 
  startLunch, endLunch, getLunchHistory, 
  getMensajerosStats, searchRouteByFactura 
} from './actions'
import { MessengerForm } from './MessengerForm'
import { RouteForm } from './RouteForm'
import { RouteDetailsModal } from './RouteDetailsModal'
import { getConfiguraciones } from '../admin/configuracion/actions'
import { useRole } from '@/hooks/useRole'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
)

export default function MensajerosPage() {
  const [mensajeros, setMensajeros] = useState<any[]>([])
  const [activeRoutes, setActiveRoutes] = useState<any[]>([])
  const [finishedRoutes, setFinishedRoutes] = useState<any[]>([])
  const [lunchHistory, setLunchHistory] = useState<any[]>([])
  const [viewingRoute, setViewingRoute] = useState<any>(null)
  const [revisores, setRevisores] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [editingMessenger, setEditingMessenger] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { isAdmin, loading: loadingRole } = useRole()

  // --- Dashboard State ---
  const [stats, setStats] = useState<any>({ yearly: [], monthly: [], hourly: [] })
  const [loadingStats, setLoadingStats] = useState(true)
  const today = new Date()
  const [dateFilter, setDateFilter] = useState(today.toISOString().split('T')[0])
  
  // Estados para reporte personalizado
  const [isRangeMode, setIsRangeMode] = useState(false)
  const [startDate, setStartDate] = useState(today.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [showReportModal, setShowReportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // --- Search State ---
  const [searchFactura, setSearchFactura] = useState('')
  const [searchingFactura, setSearchingFactura] = useState(false)
  const [searchedRoute, setSearchedRoute] = useState<any>(null)
  const [searchError, setSearchError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [mems, routes, configs, finished, lunch] = await Promise.all([
        getMensajeros(),
        getActiveRoutes(),
        getConfiguraciones(),
        getFinishedRoutes(),
        getLunchHistory()
      ])
      setMensajeros(mems)
      setActiveRoutes(routes)
      setFinishedRoutes(finished)
      setLunchHistory(lunch)

      const revs = configs
        .filter((c: any) => c.categoria === 'revisor')
        .map((c: any) => c.valor)
      setRevisores(revs)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    setLoadingStats(true)
    try {
      let start = dateFilter
      let end = dateFilter
      
      if (!isRangeMode) {
        const d = new Date(dateFilter + 'T12:00:00')
        const y = d.getFullYear()
        const m = d.getMonth()
        start = new Date(y, m, 1).toISOString().split('T')[0]
        end = new Date(y, m + 1, 0).toISOString().split('T')[0]
      } else {
        start = startDate
        end = endDate
      }

      const data = await getMensajerosStats(start, end)
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchStats()
  }, [dateFilter, isRangeMode, startDate, endDate])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      if (!stats.monthly || stats.monthly.length === 0) {
        alert('No hay datos para exportar en el rango seleccionado.')
        return
      }

      const headers = ['created_at', 'lugar_entrega', 'numero_pedidos', 'numero_factura', 'revisor', 'hora_salida', 'hora_llegada']
      const rows = stats.monthly.map((row: any) => 
        headers.map(h => `"${row[h] || ''}"`).join(',')
      ).join('\n')
      
      const csvString = `${headers.join(',')}\n${rows}`
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Reporte_Mensajeros_${startDate}_a_${endDate}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Error al generar el reporte.')
    } finally {
      setExporting(false)
    }
  }

  const handleSearchFactura = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchFactura.trim()) return
    
    setSearchingFactura(true)
    setSearchError('')
    try {
      const result = await searchRouteByFactura(searchFactura)
      if (result) {
        setSearchedRoute(result)
      } else {
        setSearchError('No se encontró ninguna ruta con esa factura.')
      }
    } catch (error) {
      setSearchError('Error al buscar la factura.')
    } finally {
      setSearchingFactura(false)
    }
  }

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
    if (m.estado === 'inactivo') return false;
    return m.nombre_conductor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.placa_conductor.toLowerCase().includes(searchTerm.toLowerCase())
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'disponible': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      case 'en_ruta': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'en_almuerzo': return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      case 'inactivo': return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
      default: return 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
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

  // --- Chart Data Processors ---

  const monthlyChartData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const data = Array(12).fill(0)
    stats.yearly.forEach((r: any) => {
      const m = new Date(r.created_at).getMonth()
      data[m] += (r.numero_pedidos || 1)
    })

    return {
      labels: months,
      datasets: [{
        label: 'Pedidos Entregados',
        data,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: 4,
      }]
    }
  }, [stats.yearly])

  const dailyChartData = useMemo(() => {
    let daysInMonth: number
    let labels: string[]
    
    const currentFilterDate = new Date((isRangeMode ? startDate : dateFilter) + 'T12:00:00')
    const yearNum = currentFilterDate.getFullYear()

    if (isRangeMode) {
      const start = new Date(startDate + 'T12:00:00')
      const end = new Date(endDate + 'T12:00:00')
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
      daysInMonth = diffDays
      labels = Array.from({length: diffDays}, (_, i) => {
          const d = new Date(start)
          d.setDate(d.getDate() + i)
          return `${d.getDate()}/${d.getMonth() + 1}`
      })
    } else {
      daysInMonth = new Date(yearNum, currentFilterDate.getMonth() + 1, 0).getDate()
      labels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString())
    }

    const data = Array(daysInMonth).fill(0)
    
    stats.monthly.forEach((r: any) => {
      const pDate = new Date(r.created_at)
      if (isRangeMode) {
          const start = new Date(startDate + 'T00:00:00')
          const diffTime = Math.abs(pDate.getTime() - start.getTime())
          const dayIdx = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          if (dayIdx >= 0 && dayIdx < daysInMonth) data[dayIdx] += (r.numero_pedidos || 1)
      } else {
          const day = pDate.getDate()
          data[day - 1] += (r.numero_pedidos || 1)
      }
    })

    return {
      labels,
      datasets: [{
        label: 'Pedidos por Día',
        data,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
      }]
    }
  }, [stats.monthly, isRangeMode, startDate, endDate, dateFilter])

  const locationChartData = useMemo(() => {
    const locations: Record<string, number> = {}
    stats.monthly.forEach((r: any) => {
      if (r.lugar_entrega) {
        const loc = r.lugar_entrega.trim().toUpperCase()
        locations[loc] = (locations[loc] || 0) + 1
      }
    })
    const sorted = Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 5)
    
    return {
      labels: sorted.map(s => s[0]),
      datasets: [{
        data: sorted.map(s => s[1]),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderWidth: 0,
      }]
    }
  }, [stats.monthly])

  const peakHoursChartData = useMemo(() => {
    const hours = Array(24).fill(0)
    stats.hourly.forEach((r: any) => {
      if (r.hora_salida) {
        const h = new Date(r.hora_salida).getHours()
        if (!isNaN(h)) hours[h]++
      }
    })

    const labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`)

    return {
      labels,
      datasets: [{
        label: 'Frecuencia de Salida',
        data: hours,
        backgroundColor: 'rgba(139, 92, 246, 0.5)',
        borderColor: 'rgb(139, 92, 246)',
        borderWidth: 1,
      }]
    }
  }, [stats.hourly])

  // KPIs
  const totalPedidos = useMemo(() => stats.monthly.reduce((acc: number, curr: any) => acc + (curr.numero_pedidos || 0), 0), [stats.monthly])
  const totalFacturas = useMemo(() => {
    let count = 0
    stats.monthly.forEach((r: any) => {
      if (r.numero_factura) {
        count += r.numero_factura.split(',').filter((f: string) => f.trim()).length
      }
    })
    return count
  }, [stats.monthly])
  const totalRutas = stats.monthly.length

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255, 255, 255, 0.7)' } }
    },
    scales: {
      x: { ticks: { color: 'rgba(255, 255, 255, 0.5)' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
      y: { ticks: { color: 'rgba(255, 255, 255, 0.5)' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
    }
  }

  if (loadingRole) {
    return (
      <div className="flex items-center justify-center p-20 text-neutral-500">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        Verificando nivel de acceso...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-12 pb-20">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Truck className="w-6 h-6 text-blue-500" />
                Gestión de Mensajeros
              </h2>
              <p className="text-neutral-400 text-sm mt-1">Administra el personal de entregas y su disponibilidad.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowRouteForm(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
              >
                <Route className="w-4 h-4" />
                <span>Asignar Ruta</span>
              </button>
            </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-x-auto">
            <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row gap-4 justify-between bg-neutral-900/30">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-xl border border-neutral-800 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">
                  Filtros
                </button>
              </div>
            </div>

            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-neutral-950/50">
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Conductor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Placa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-neutral-500 text-sm italic">Cargando disponibilidad...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMensajeros.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-neutral-500 italic">
                      {searchTerm ? 'No se encontraron resultados para tu búsqueda.' : 'No hay mensajeros activos en este momento.'}
                    </td>
                  </tr>
                ) : (
                  filteredMensajeros.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-800/30 transition-colors group border-b border-neutral-800/50 last:border-0">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-blue-500 font-bold border border-neutral-700 overflow-hidden shadow-inner">
                            {m.foto_url ? (
                              <img src={m.foto_url} alt={m.nombre_conductor} className="w-full h-full object-cover" />
                            ) : (
                              m.nombre_conductor.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="font-bold text-white tracking-tight">{m.nombre_conductor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-neutral-300 text-sm font-mono uppercase tracking-widest">{m.placa_conductor}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${getStatusColor(m.estado)} shadow-sm`}>
                          {m.estado.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-xs font-medium">
                        {new Date(m.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {m.estado === 'disponible' && (
                            <button
                              onClick={() => handleStartLunch(m.id)}
                              title="Marcar Salida a Almuerzo"
                              className="p-2 rounded-xl text-amber-500 bg-amber-500/10 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/20"
                            >
                              <Coffee className="w-4 h-4" />
                            </button>
                          )}
                          {m.estado === 'en_almuerzo' && (
                            <button
                              onClick={() => handleEndLunch(m.id)}
                              title="Marcar Regreso"
                              className="p-2 rounded-xl text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white transition-all border border-emerald-500/20 flex items-center gap-2 px-3"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-bold">REGRESAR</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rutas Activas */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-emerald-500" />
            <h3 className="text-xl font-bold text-white">Rutas en Curso</h3>
            <span className="bg-emerald-500/10 text-emerald-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-emerald-500/20">
              {activeRoutes.length} Activas
            </span>
          </div>

          {activeRoutes.length === 0 ? (
            <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-10 text-center text-neutral-500 italic">
              No hay rutas activas en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeRoutes.map((route) => (
                <div key={route.id} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl hover:border-blue-500/30 transition-all group">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden shadow-lg">
                        {route.mensajero?.foto_url ? (
                          <img src={route.mensajero.foto_url} alt="Messenger" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-blue-500 font-bold text-xl">
                            {route.mensajero?.nombre_conductor?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg tracking-tight">{route.mensajero?.nombre_conductor}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md font-mono font-bold uppercase tracking-widest border border-blue-500/20">
                            {route.mensajero?.placa_conductor}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-neutral-500 uppercase font-black tracking-tighter mb-1">Hora Salida</span>
                      <span className="text-sm font-mono text-blue-400 bg-blue-500/5 px-3 py-1 rounded-lg border border-blue-500/10 mb-2">
                        {new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <div className="w-1 h-1 rounded-full bg-neutral-600"></div>
                        <span className="text-[9px] text-neutral-500 font-medium italic">
                          Registro: {new Date(route.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="w-4 h-4 text-neutral-500" />
                      <span className="text-neutral-300 font-medium">{route.lugar_entrega}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Package className="w-4 h-4 text-neutral-500" />
                      <span className="text-neutral-300">{route.numero_pedidos} Pedidos asignados</span>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <Search className="w-4 h-4 text-neutral-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-wider mb-1">Facturas</p>
                        <p className="text-neutral-400 text-xs line-clamp-2">{route.numero_factura}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm pt-2 border-t border-neutral-800">
                      <User className="w-4 h-4 text-neutral-600" />
                      <span className="text-neutral-500 text-xs">Revisado por: <span className="text-neutral-400">{route.revisor}</span></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleFinalize(route.id, route.mensajero_id)}
                    className="w-full py-3 bg-neutral-800 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-emerald-600/10 shadow-inner"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Marcar Finalizado
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Control de Almuerzos (Mes Actual) */}
        <div className="space-y-4 pt-8 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="w-5 h-5 text-amber-500" />
              <h3 className="text-xl font-bold text-white">Control de Almuerzos</h3>
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Bitácora Diaria</span>
            </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-950/30">
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Mensajero / Placa</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Salida</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Referencia</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Regreso</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Duración</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {lunchHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-neutral-500 italic">
                        No hay registros de almuerzo el día de hoy.
                      </td>
                    </tr>
                  ) : (
                    lunchHistory.map((log) => (
                      <tr key={log.id} className="hover:bg-neutral-800/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm tracking-tight">{log.mensajero?.nombre_conductor}</span>
                            <span className="text-[10px] text-neutral-500 font-mono">{log.mensajero?.placa_conductor}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-mono text-neutral-400">
                            {new Date(log.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[11px] text-neutral-500 italic">
                            {new Date(log.fecha).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log.hora_entrada ? (
                            <span className="text-sm font-mono text-emerald-500 font-bold">
                              {new Date(log.hora_entrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full animate-pulse border border-amber-500/20 font-black">
                              EN ALMUERZO
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {log.hora_entrada && (
                            <span className="text-sm font-bold text-white">
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
        </div>

        {/* Historial de Rutas (Mes Actual) */}
        <div className="space-y-4 pt-8 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-neutral-500" />
              <h3 className="text-xl font-bold text-white">Historial de Rutas</h3>
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Resumen Diario</span>
            </div>
            <div className="text-[10px] text-neutral-400 bg-neutral-800 px-3 py-1 rounded-full border border-neutral-700">
              {finishedRoutes.length} Entregas Completadas
            </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-neutral-950/30">
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Conductor / Placa</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Destino</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Facturas</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Tiempos</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Responsable</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {finishedRoutes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-500 italic">
                        No hay rutas finalizadas en el historial de hoy.
                      </td>
                    </tr>
                  ) : (
                    finishedRoutes.map((route) => (
                      <tr key={route.id} className="hover:bg-neutral-800/10 transition-colors group">
                        <td className="px-6 py-4 border-l-2 border-transparent hover:border-emerald-500/50">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm tracking-tight">{route.mensajero?.nombre_conductor}</span>
                            <span className="text-[10px] text-neutral-500 font-mono italic">{route.mensajero?.placa_conductor}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-neutral-300 text-sm">
                            <MapPin className="w-3 h-3 text-neutral-600" />
                            <span className="truncate max-w-[120px]">{route.lugar_entrega}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-neutral-400 text-[11px] font-mono line-clamp-1 max-w-[150px]">{route.numero_factura}</span>
                            <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter">{route.numero_pedidos} Pedidos</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-3 bg-neutral-950/50 py-2 rounded-xl border border-neutral-800/30">
                            <div className="text-center">
                              <p className="text-[8px] text-neutral-600 uppercase font-black">Sal</p>
                              <p className="text-[10px] font-mono text-neutral-400">
                                {new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="w-px h-6 bg-neutral-800"></div>
                            <div className="text-center">
                              <p className="text-[8px] text-emerald-600 uppercase font-black">Lle</p>
                              <p className="text-[10px] font-mono text-emerald-500">
                                {new Date(route.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <p className="text-[9px] text-neutral-700 font-medium italic">
                              {new Date(route.created_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                            </p>
                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">
                              ⏱ {formatDuration(route.hora_salida, route.hora_llegada)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500">
                              {route.revisor?.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-xs text-neutral-400 font-medium">{route.revisor}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setViewingRoute(route)}
                            className="p-2.5 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-all border border-transparent hover:border-neutral-700 shadow-sm"
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
        </div>

        {showRouteForm && (
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
        {viewingRoute && (
          <RouteDetailsModal
            route={viewingRoute}
            onClose={() => setViewingRoute(null)}
          />
        )}

      </div>
    )
  }

  return (
    <div className="space-y-12 pb-20">
      {/* DASHBOARD ANALÍTICO */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-emerald-500" />
              Dashboard Operativo
            </h2>
            <p className="text-neutral-400 text-sm mt-1">Analítica de rendimiento, rutas y pedidos entregados.</p>
          </div>

          {/* Filtros de Fecha y Buscador */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Buscador de Factura */}
            <form onSubmit={handleSearchFactura} className="relative group flex-1 sm:flex-initial">
              <input 
                type="text"
                placeholder="Buscar factura..."
                value={searchFactura}
                onChange={(e) => setSearchFactura(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-white text-sm px-10 py-2.5 rounded-2xl outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-full sm:w-[200px]"
              />
              <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
              {searchingFactura && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                   <Clock className="w-3 h-3 text-blue-500 animate-spin" />
                </div>
              )}
            </form>

            {isRangeMode ? (
              <div className="flex items-center gap-2 bg-purple-500/10 p-1 px-2 rounded-2xl border border-purple-500/20">
                 <CalendarRange className="w-4 h-4 text-purple-500" />
                 <span className="text-white text-xs font-bold">{startDate} al {endDate}</span>
                 <button 
                   onClick={() => {
                      setIsRangeMode(false)
                      setDateFilter(new Date().toISOString().split('T')[0])
                   }} 
                   className="ml-2 hover:bg-purple-500/20 p-1 rounded-full transition-colors"
                 >
                   <X className="w-3 h-3 text-purple-400" />
                 </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-neutral-950 p-2 px-4 rounded-2xl border border-neutral-800">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <span className="text-white text-sm font-medium">
                  {new Date(dateFilter + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}

            <button 
              onClick={() => setShowReportModal(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-2xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex-1 sm:flex-none"
            >
              <FileDown className="w-4 h-4" />
              <span>Filtros y Reportes</span>
            </button>
          </div>
        </div>

      {/* Modal de Reportes */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileDown className="w-5 h-5 text-purple-500" />
                Generar Reporte
              </h2>
              <button 
                onClick={() => setShowReportModal(false)}
                className="text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Fecha Inicio</label>
                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-2xl flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-600" />
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-white text-sm outline-none w-full [color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-neutral-500 font-bold uppercase tracking-wider">Fecha Fin</label>
                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-2xl flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-neutral-600" />
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-white text-sm outline-none w-full [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                <p className="text-xs text-neutral-400">
                  Este reporte incluirá todas las métricas de áreas, revisores y actividad horaria para el rango seleccionado, exportadas en formato CSV.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsRangeMode(true)
                    setShowReportModal(false)
                  }}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-3 rounded-2xl transition-all active:scale-[0.98] text-sm"
                >
                  Ver en Dashboard
                </button>
                <button 
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl shadow-lg shadow-purple-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                >
                  {exporting ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? 'Generando...' : 'Descargar CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {searchError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl">
            {searchError}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
               <Package className="w-6 h-6" />
             </div>
             <div>
               <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Pedidos Entregados</p>
               <p className="text-2xl font-black text-white">{loadingStats ? '...' : totalPedidos}</p>
             </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
               <FileText className="w-6 h-6" />
             </div>
             <div>
               <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Facturas Gestionadas</p>
               <p className="text-2xl font-black text-white">{loadingStats ? '...' : totalFacturas}</p>
             </div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
               <Truck className="w-6 h-6" />
             </div>
             <div>
               <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Total de Rutas</p>
               <p className="text-2xl font-black text-white">{loadingStats ? '...' : totalRutas}</p>
             </div>
          </div>
        </div>

        {/* Gráficos Principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-[350px] shadow-sm">
            <h3 className="text-sm font-bold text-neutral-300 mb-6">Pedidos Mensuales (Anual)</h3>
            {loadingStats ? (
              <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span></div>
            ) : (
              <Bar data={monthlyChartData} options={chartOptions} />
            )}
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-[350px] shadow-sm">
            <h3 className="text-sm font-bold text-neutral-300 mb-6">Rendimiento Diario (Rango)</h3>
            {loadingStats ? (
              <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span></div>
            ) : (
              <Line data={dailyChartData} options={chartOptions} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-[350px] shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <MapPin className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-neutral-300">Top 5: Ubicaciones Más Concurridas</h3>
            </div>
            <div className="flex-1 relative flex items-center justify-center">
              {loadingStats ? (
                <span className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Doughnut 
                  data={locationChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: 'rgba(255,255,255,0.7)' } } } 
                  }} 
                />
              )}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-[350px] shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-neutral-300">Pico de Trabajo (Horas de Salida)</h3>
            </div>
            <div className="flex-1 relative">
              {loadingStats ? (
                <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span></div>
              ) : (
                <Bar 
                  data={peakHoursChartData} 
                  options={{
                    ...chartOptions,
                    indexAxis: 'y',
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {searchedRoute && (
        <RouteDetailsModal 
          route={searchedRoute} 
          onClose={() => setSearchedRoute(null)}
        />
      )}

    </div>
  )
}
