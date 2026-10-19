'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Search, Clock, CalendarRange, X, FileDown, Calendar, Download } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { useChartColors } from '@/components/theme/useTheme'
import { getMensajerosStats, searchRouteByFactura } from './actions'
import { RouteDetailsModal } from './RouteDetailsModal'

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

export function MensajerosReports({ summary, refreshStatus }: { summary: ReactNode; refreshStatus: ReactNode }) {
  const chartColors = useChartColors()
  // --- Dashboard State ---
  const [stats, setStats] = useState<any>({ yearly: [], monthly: [], hourly: [] })
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
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

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    setStatsError(null)
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
      setStatsError('No se pudieron cargar las estadísticas de mensajeros.')
    } finally {
      setLoadingStats(false)
    }
  }, [dateFilter, isRangeMode, startDate, endDate])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

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

  const messengerRanking = useMemo(() => {
    const byMessenger: Record<string, { pedidos: number; facturas: number }> = {}

    stats.monthly.forEach((r: any) => {
      const rawMensajero = r?.mensajero
      const mensajeroObj = Array.isArray(rawMensajero) ? rawMensajero[0] : rawMensajero
      const messengerName = mensajeroObj?.nombre_conductor?.trim() || 'Sin nombre'
      const pedidos = Number(r?.numero_pedidos || 0)
      const facturas = String(r?.numero_factura || '')
        .split(',')
        .map((f: string) => f.trim())
        .filter((f: string) => f.length > 0).length

      if (!byMessenger[messengerName]) {
        byMessenger[messengerName] = { pedidos: 0, facturas: 0 }
      }

      byMessenger[messengerName].pedidos += Number.isFinite(pedidos) ? pedidos : 0
      byMessenger[messengerName].facturas += facturas
    })

    const base = Object.entries(byMessenger).map(([nombre, values]) => ({
      nombre,
      pedidos: values.pedidos,
      facturas: values.facturas,
    }))

    const sortByName = (a: { nombre: string }, b: { nombre: string }) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })

    const pedidos = [...base]
      .sort((a, b) => b.pedidos - a.pedidos || sortByName(a, b))
      .filter((item) => item.pedidos > 0)

    const facturas = [...base]
      .sort((a, b) => b.facturas - a.facturas || sortByName(a, b))
      .filter((item) => item.facturas > 0)

    return { pedidos, facturas }
  }, [stats.monthly])

  const rankingChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { ticks: { color: chartColors.muted }, grid: { color: chartColors.border } },
      y: { ticks: { color: chartColors.muted }, grid: { color: chartColors.border } }
    }
  }

  const pedidosRankingChartData = {
    labels: messengerRanking.pedidos.map((item) =>
      item.nombre.length > 26 ? `${item.nombre.slice(0, 26)}...` : item.nombre
    ),
    datasets: [{
      label: 'Pedidos entregados',
      data: messengerRanking.pedidos.map((item) => item.pedidos),
      backgroundColor: 'rgba(59, 130, 246, 0.65)',
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1,
      borderRadius: 8,
    }],
  }

  const facturasRankingChartData = {
    labels: messengerRanking.facturas.map((item) =>
      item.nombre.length > 26 ? `${item.nombre.slice(0, 26)}...` : item.nombre
    ),
    datasets: [{
      label: 'Facturas entregadas',
      data: messengerRanking.facturas.map((item) => item.facturas),
      backgroundColor: 'rgba(16, 185, 129, 0.65)',
      borderColor: 'rgb(16, 185, 129)',
      borderWidth: 1,
      borderRadius: 8,
    }],
  }

  const pedidosRankingHeight = Math.max(320, messengerRanking.pedidos.length * 34)
  const facturasRankingHeight = Math.max(320, messengerRanking.facturas.length * 34)

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: chartColors.muted } }
    },
    scales: {
      x: { ticks: { color: chartColors.muted }, grid: { color: chartColors.border } },
      y: { ticks: { color: chartColors.muted }, grid: { color: chartColors.border } }
    }
  }

  if (statsError && !loadingStats) {
    return <div className="space-y-6 pb-20">
      <h2 className="page-title">Reportes de mensajeros</h2>
      {refreshStatus}
      {summary}
      <div role="alert" className="rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm text-warning">
        {statsError} <button onClick={() => void fetchStats()} className="ml-2 underline">Reintentar</button>
      </div>
    </div>
  }

  return (
    <div className="space-y-12 pb-20">
      {/* DASHBOARD ANALÍTICO */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
              Dashboard Operativo
            </h2>
            <p className="text-muted text-sm mt-1">Analítica de rendimiento, rutas y pedidos entregados.</p>
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
                className="bg-subtle border border-border text-foreground text-sm px-10 py-2.5 rounded-2xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all w-full sm:w-[200px]"
              />
              <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-accent-foreground transition-colors" />
              {searchingFactura && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                   <Clock className="w-3 h-3 text-accent-foreground animate-spin" />
                </div>
              )}
            </form>

            {isRangeMode ? (
              <div className="flex items-center gap-2 bg-info-soft p-1 px-2 rounded-2xl border border-info/20">
                 <CalendarRange className="w-4 h-4 text-info" />
                 <span className="text-foreground text-xs font-bold">{startDate} al {endDate}</span>
                 <button 
                   onClick={() => {
                      setIsRangeMode(false)
                      setDateFilter(new Date().toISOString().split('T')[0])
                   }} 
                   className="ml-2 hover:bg-info-soft p-1 rounded-full transition-colors"
                 >
                   <X className="w-3 h-3 text-info" />
                 </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-subtle p-2 px-4 rounded-2xl border border-border">
                <Calendar className="w-4 h-4 text-muted" />
                <span className="text-foreground text-sm font-medium">
                  {new Date(dateFilter + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}

            <button 
              onClick={() => setShowReportModal(true)}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-on-accent px-4 py-2.5 rounded-2xl text-sm font-medium transition-all shadow-none active:scale-[0.98] flex-1 sm:flex-none"
            >
              <FileDown className="w-4 h-4" />
              <span>Filtros y Reportes</span>
            </button>
          </div>
        </div>

        {refreshStatus}
        {summary}

      {/* Modal de Reportes */}
      {showReportModal && (
        <Modal onClose={() => setShowReportModal(false)} titleId="mensajeros-report-title" size="small">
          
          <div className="p-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 id="mensajeros-report-title" className="text-lg font-semibold text-foreground">
                Generar Reporte
              </h2>
              <button 
                aria-label="Cerrar reportes"
                onClick={() => setShowReportModal(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider">Fecha Inicio</label>
                  <div 
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input');
                      if (input) {
                        try { input.showPicker(); } catch (err) {}
                      }
                    }}
                    className="bg-subtle border border-border p-3 rounded-2xl flex items-center gap-2 relative cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-foreground pointer-events-none" />
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-foreground text-sm outline-none w-full [color-scheme:inherit] cursor-pointer"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted font-bold uppercase tracking-wider">Fecha Fin</label>
                  <div 
                    onClick={(e) => {
                      const input = e.currentTarget.querySelector('input');
                      if (input) {
                        try { input.showPicker(); } catch (err) {}
                      }
                    }}
                    className="bg-subtle border border-border p-3 rounded-2xl flex items-center gap-2 relative cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-foreground pointer-events-none" />
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-foreground text-sm outline-none w-full [color-scheme:inherit] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-info-soft border border-info/10 rounded-2xl">
                <p className="text-xs text-muted">
                  Este reporte incluirá todas las métricas de áreas, revisores y actividad horaria para el rango seleccionado, exportadas en formato CSV.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsRangeMode(true)
                    setShowReportModal(false)
                  }}
                  className="flex-1 bg-subtle hover:bg-hover text-foreground font-bold py-3 rounded-2xl transition-all active:scale-[0.98] text-sm"
                >
                  Ver en Dashboard
                </button>
                <button 
                  onClick={handleExportCSV}
                  disabled={exporting}
                  className="flex-1 bg-info-solid hover:bg-info-solid disabled:opacity-50 text-on-accent font-bold py-3 rounded-2xl shadow-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                >
                  {exporting ? <Clock className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {exporting ? 'Generando...' : 'Descargar CSV'}
                </button>
              </div>
            </div>

          </div>
        </Modal>
      )}

        {searchError && (
          <div className="p-3 bg-danger-soft border border-danger/20 text-danger text-sm rounded-xl">
            {searchError}
          </div>
        )}

        {/* KPIs: same real metrics, without decorative icon panels. */}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-5">
            <dt className="text-sm font-medium text-muted">Pedidos entregados</dt>
            <dd className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{loadingStats ? '...' : totalPedidos}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <dt className="text-sm font-medium text-muted">Facturas gestionadas</dt>
            <dd className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{loadingStats ? '...' : totalFacturas}</dd>
          </div>
          <div className="rounded-xl border border-border bg-surface p-5">
            <dt className="text-sm font-medium text-muted">Total de rutas</dt>
            <dd className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">{loadingStats ? '...' : totalRutas}</dd>
          </div>
        </dl>

        {/* Gráficos Principales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 h-[350px] shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-6">Pedidos Mensuales (Anual)</h3>
            {loadingStats ? (
              <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></span></div>
            ) : (
              <Bar data={monthlyChartData} options={chartOptions} />
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 h-[350px] shadow-sm">
            <h3 className="text-sm font-bold text-secondary mb-6">Rendimiento Diario (Rango)</h3>
            {loadingStats ? (
              <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin"></span></div>
            ) : (
              <Line data={dailyChartData} options={chartOptions} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 h-[350px] shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <h3 className="text-sm font-bold text-secondary">Top 5: Ubicaciones Más Concurridas</h3>
            </div>
            <div className="flex-1 relative flex items-center justify-center">
              {loadingStats ? (
                <span className="w-6 h-6 border-2 border-warning border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Doughnut 
                  data={locationChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { color: chartColors.muted } } }
                  }} 
                />
              )}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-xl p-6 h-[350px] shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <h3 className="text-sm font-bold text-secondary">Pico de Trabajo (Horas de Salida)</h3>
            </div>
            <div className="flex-1 relative">
              {loadingStats ? (
                <div className="w-full h-full flex items-center justify-center"><span className="w-6 h-6 border-2 border-info border-t-transparent rounded-full animate-spin"></span></div>
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <article className="bg-surface border border-border rounded-xl p-6 shadow-sm">
              <div className="mb-4 border-b border-border pb-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-foreground">Pedidos entregados</h4>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{messengerRanking.pedidos.length} operadores</span>
                </div>
                {!loadingStats && messengerRanking.pedidos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {messengerRanking.pedidos.slice(0, 3).map((item, index) => (
                      <span key={`${item.nombre}-${index}`} className="rounded-full border border-border-strong bg-subtle px-2.5 py-1 text-secondary">
                        {index + 1}. {item.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {loadingStats ? (
                <div className="w-full h-[300px] flex items-center justify-center"><span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></span></div>
              ) : messengerRanking.pedidos.length === 0 ? (
                <div className="w-full h-[300px] flex items-center justify-center text-muted text-sm text-center px-4">Sin pedidos entregados en el rango seleccionado.</div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto pr-2">
                  <div style={{ height: `${pedidosRankingHeight}px` }}>
                    <Bar data={pedidosRankingChartData} options={rankingChartOptions} />
                  </div>
                </div>
              )}
          </article>

          <article className="bg-surface border border-border rounded-xl p-6 shadow-sm">
              <div className="mb-4 border-b border-border pb-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-foreground">Facturas entregadas</h4>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{messengerRanking.facturas.length} operadores</span>
                </div>
                {!loadingStats && messengerRanking.facturas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {messengerRanking.facturas.slice(0, 3).map((item, index) => (
                      <span key={`${item.nombre}-${index}`} className="rounded-full border border-border-strong bg-subtle px-2.5 py-1 text-secondary">
                        {index + 1}. {item.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {loadingStats ? (
                <div className="w-full h-[300px] flex items-center justify-center"><span className="w-6 h-6 border-2 border-success border-t-transparent rounded-full animate-spin"></span></div>
              ) : messengerRanking.facturas.length === 0 ? (
                <div className="w-full h-[300px] flex items-center justify-center text-muted text-sm text-center px-4">Sin facturas entregadas en el rango seleccionado.</div>
              ) : (
                <div className="max-h-[440px] overflow-y-auto pr-2">
                  <div style={{ height: `${facturasRankingHeight}px` }}>
                    <Bar data={facturasRankingChartData} options={rankingChartOptions} />
                  </div>
                </div>
              )}
          </article>
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
