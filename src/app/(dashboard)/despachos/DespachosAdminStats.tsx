'use client'

import { Modal } from '@/components/Modal'

import { useChartColors } from '@/components/theme/useTheme'

import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
  RadialLinearScale,
  ArcElement
} from 'chart.js'
import { Bar, Line, PolarArea } from 'react-chartjs-2'
import { getDespachosStats, getDetailedReportData, searchPedidoByFactura, deletePedido } from './actions'
import { Calendar, Filter, Users, Layout, Clock, TrendingUp, ChevronDown, FileDown, CalendarRange, X, Download, Search } from 'lucide-react'
import { OrderDetailsModal } from './OrderDetailsModal'

// Registrar componentes de ChartJS
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  RadialLinearScale,
  ArcElement
)

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function DespachosAdminStats() {
  const chartColors = useChartColors()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [puntoFilter, setPuntoFilter] = useState<'Principal' | 'Sucursal' | 'Todos'>('Todos')
  const [revisorPuntoFilter, setRevisorPuntoFilter] = useState<'Principal' | 'Sucursal' | 'Todos'>('Todos')
  
  // Estados para reporte personalizado
  const [isRangeMode, setIsRangeMode] = useState(false)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [showReportModal, setShowReportModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Estados para búsqueda por factura
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResult, setSearchResult] = useState<any>(null)
  const [isSearching, setIsSearching] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      let startISO = ''
      let endISO = ''
      
      if (!isRangeMode) {
        // Modo mensual: calcular inicio y fin de mes basado en el día seleccionado
        const d = new Date(dateFilter + 'T12:00:00')
        const y = d.getFullYear()
        const m = d.getMonth()
        
        const localStart = new Date(y, m, 1, 0, 0, 0, 0)
        const localEnd = new Date(y, m + 1, 0, 23, 59, 59, 999)
        startISO = localStart.toISOString()
        endISO = localEnd.toISOString()
      } else {
        const localStart = new Date(startDate + 'T00:00:00')
        const localEnd = new Date(endDate + 'T23:59:59')
        startISO = localStart.toISOString()
        endISO = localEnd.toISOString()
      }

      const data = await getDespachosStats(startISO, endISO)
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
      setLoadError('No se pudieron cargar las estadísticas de despachos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [dateFilter, isRangeMode, startDate, endDate])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const localStart = new Date(startDate + 'T00:00:00')
      const localEnd = new Date(endDate + 'T23:59:59')
      const data = await getDetailedReportData(localStart.toISOString(), localEnd.toISOString())
      if (!data || data.length === 0) {
        alert('No hay datos para exportar en el rango seleccionado.')
        return
      }

      // Convertir a CSV
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map((row: any) => 
        Object.values(row).map(val => `"${val}"`).join(',')
      ).join('\n')
      
      const csvString = `${headers}\n${rows}`
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Reporte_Despachos_${startDate}_a_${endDate}.csv`)
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchTerm.trim()) return
    
    setIsSearching(true)
    try {
      const result = await searchPedidoByFactura(searchTerm)
      if (result) {
        setSearchResult(result)
        setSearchTerm('') // Limpiar búsqueda al encontrar
      } else {
        alert('No se encontró ningún registro con el número de factura: ' + searchTerm)
      }
    } catch (err) {
      console.error(err)
      alert('Error al buscar la factura.')
    } finally {
      setIsSearching(false)
    }
  }

  if (loadError && !loading) {
    return <div className="space-y-4">
      <h1 className="page-title">Análisis de Operaciones</h1>
      <div role="alert" className="rounded-lg border border-warning/20 bg-warning-soft p-4 text-sm text-warning">
        {loadError} <button onClick={() => void fetchStats()} className="ml-2 underline">Reintentar</button>
      </div>
    </div>
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center p-20 text-muted">
        <Clock className="w-6 h-6 animate-spin mr-2" />
        Generando inteligencia de datos...
      </div>
    )
  }

  // --- PROCESAMIENTO DE DATOS PARA GRÁFICOS ---

  // 1. ANUAL (Barras)
  const yearlyCounts = new Array(12).fill(0)
  stats.yearly.forEach((p: any) => {
    const month = new Date(p.created_at).getMonth()
    yearlyCounts[month]++
  })

  // 2. MENSUAL/RANGO DIARIO (Lineal)
  const currentFilterDate = new Date((isRangeMode ? startDate : dateFilter) + 'T12:00:00')
  const monthName = MESES[currentFilterDate.getMonth()]
  const yearNum = currentFilterDate.getFullYear()
  
  let daysInMonth: number
  let labels: string[]
  
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

  const dailyCounts = new Array(daysInMonth).fill(0)
  stats.monthly.forEach((p: any) => {
    const pDate = new Date(p.created_at)
    if (isRangeMode) {
        const start = new Date(startDate + 'T00:00:00')
        const diffTime = Math.abs(pDate.getTime() - start.getTime())
        const dayIdx = Math.floor(diffTime / (1000 * 60 * 60 * 24))
        if (dayIdx >= 0 && dayIdx < daysInMonth) dailyCounts[dayIdx]++
    } else {
        const day = pDate.getDate()
        dailyCounts[day - 1]++
    }
  })

  // 3. RANKING ÁREAS (Filtrado por Punto)
  const areaCounts: { [key: string]: number } = {}
  stats.monthly
    .filter((p: any) => puntoFilter === 'Todos' || p.punto === puntoFilter)
    .forEach((p: any) => {
      areaCounts[p.area] = (areaCounts[p.area] || 0) + 1
    })
  const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])

  // 4. RANKING REVISORES (Filtrado por Punto)
  const revisorCounts: { [key: string]: number } = {}
  stats.monthly
    .filter((p: any) => revisorPuntoFilter === 'Todos' || p.punto === revisorPuntoFilter)
    .forEach((p: any) => {
      revisorCounts[p.revisado_por] = (revisorCounts[p.revisado_por] || 0) + 1
    })
  const sortedRevisores = Object.entries(revisorCounts).sort((a, b) => b[1] - a[1])

  // 5. PICO DE HORA
  const hourCounts = new Array(24).fill(0)
  stats.hourly.forEach((p: any) => {
    const hour = new Date(p.created_at).getHours()
    hourCounts[hour]++
  })

  // --- CONFIGURACIONES DE DATASETS ---

  const yearlyData: ChartData<'bar'> = {
    labels: MESES,
    datasets: [{
      label: 'Registros Anuales',
      data: yearlyCounts,
      backgroundColor: 'rgba(59, 130, 246, 0.5)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 8,
    }]
  }

  const dailyData: ChartData<'line'> = {
    labels: labels,
    datasets: [{
      label: 'Registros',
      data: dailyCounts,
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: labels.length > 31 ? 1 : 4,
      pointHoverRadius: 6,
    }]
  }

  const hourlyData: ChartData<'bar'> = {
    labels: Array.from({length: 24}, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Pico de Registros (Hora)',
      data: hourCounts,
      backgroundColor: 'rgba(168, 85, 247, 0.5)',
      borderColor: '#a855f7',
      borderWidth: 2,
      borderRadius: 4,
    }]
  }

  const areaData: ChartData<'polarArea'> = {
    labels: sortedAreas.map(([area]) => area),
    datasets: [{
      label: 'Registros por Área',
      data: sortedAreas.map(([, count]) => count),
      backgroundColor: sortedAreas.map((_, i) => `hsla(${(i * 360) / Math.max(sortedAreas.length, 1)}, 75%, 60%, 0.5)`),
      borderColor: sortedAreas.map((_, i) => `hsla(${(i * 360) / Math.max(sortedAreas.length, 1)}, 75%, 60%, 1)`),
      borderWidth: 2,
    }]
  }

  const revisorData: ChartData<'polarArea'> = {
    labels: sortedRevisores.map(([revisor]) => revisor),
    datasets: [{
      label: 'Registros por Revisor',
      data: sortedRevisores.map(([, count]) => count),
      backgroundColor: sortedRevisores.map((_, i) => `hsla(${(i * 360) / Math.max(sortedRevisores.length, 1)}, 75%, 60%, 0.5)`),
      borderColor: sortedRevisores.map((_, i) => `hsla(${(i * 360) / Math.max(sortedRevisores.length, 1)}, 75%, 60%, 1)`),
      borderWidth: 2,
    }]
  }

  const chartOptions: ChartOptions<'bar' | 'line' | 'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: chartColors.surface,
        titleColor: chartColors.text,
        bodyColor: chartColors.text,
        borderColor: chartColors.border,
        borderWidth: 1,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      y: {
        grid: { color: chartColors.border },
        ticks: { color: chartColors.muted, font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: chartColors.muted, font: { size: 10 } }
      }
    }
  }

  const polarOptions: ChartOptions<'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: chartColors.muted, font: { size: 10 }, usePointStyle: true }
      }
    },
    scales: {
      r: {
        grid: { color: chartColors.border },
        angleLines: { color: chartColors.border },
        pointLabels: {
          display: true,
          centerPointLabels: true,
          font: { size: 9 },
          color: chartColors.muted
        },
        ticks: { display: false }
      }
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header de Stats */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-surface p-4 sm:p-6 rounded-xl border border-border">
        <div className="w-full xl:w-auto">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Análisis de Operaciones
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">Métricas de rendimiento y flujos de despacho.</p>
        </div>
        
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Buscador de Factura */}
            <form onSubmit={handleSearch} className="relative group flex-1 sm:flex-initial">
              <input 
                type="text"
                placeholder="Buscar factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-subtle border border-border text-foreground text-sm px-10 py-2.5 rounded-2xl outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all w-full sm:w-[200px]"
              />
              <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-accent-foreground transition-colors" />
              {isSearching && (
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
                  {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
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

      {/* Modal de Reportes */}
      {showReportModal && (
        <Modal onClose={() => setShowReportModal(false)} titleId="despachos-report-title" size="small">
          <div className="p-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 id="despachos-report-title" className="text-lg font-semibold text-foreground">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Pedidos del Año (Anual) */}
        <div className="bg-surface border border-border p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Pedidos por Mes ({yearNum})
            </h3>
          </div>
          <div className="h-[250px]">
            <Bar data={yearlyData} options={chartOptions as any} />
          </div>
        </div>

        {/* 2. Pedidos Diarios (Mes Actual) */}
        <div className="bg-surface border border-border p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Registros {isRangeMode ? 'del Periodo' : `de ${monthName} ${yearNum}`}
            </h3>
          </div>
          <div className="h-[250px]">
            <Line data={dailyData} options={chartOptions as any} />
          </div>
        </div>

        {/* 3. Ranking de Áreas (Polar Area) */}
        <div className="bg-surface border border-border p-6 rounded-xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Distribución por Áreas ({monthName})
            </h3>
            
            <div className="flex bg-subtle p-1 rounded-xl border border-border">
              {(['Todos', 'Principal', 'Sucursal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPuntoFilter(p)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    puntoFilter === p 
                      ? 'bg-warning-solid text-on-accent shadow-sm'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px]">
             {sortedAreas.length > 0 ? (
               <PolarArea data={areaData} options={polarOptions} />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-muted text-sm italic">
                  No hay registros {puntoFilter === 'Todos' ? '' : `en ${puntoFilter} `}para {monthName}
               </div>
             )}
          </div>
        </div>

        {/* 4. Ranking de Revisores (Polar Area) */}
        <div className="bg-surface border border-border p-6 rounded-xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Desempeño de Revisores
            </h3>
            
            <div className="flex bg-subtle p-1 rounded-xl border border-border">
              {(['Todos', 'Principal', 'Sucursal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setRevisorPuntoFilter(p)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    revisorPuntoFilter === p 
                      ? 'bg-info-solid text-on-accent shadow-sm'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px]">
             {sortedRevisores.length > 0 ? (
               <PolarArea data={revisorData} options={polarOptions} />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-muted text-sm italic">
                  No hay registros de revisores {revisorPuntoFilter === 'Todos' ? '' : `en ${revisorPuntoFilter} `}para {monthName}
               </div>
             )}
          </div>
        </div>

        {/* 5. Pico de Hora (Dinámico con fecha) */}
        <div className="lg:col-span-2 bg-surface border border-border p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Picos de Hora - {isRangeMode ? 'Periodo Personalizado' : `${monthName} ${yearNum}`}
            </h3>
            <span className="text-xs text-muted">Distribución horaria acumulada (00:00 - 23:59)</span>
          </div>
          <div className="h-[250px]">
            <Bar data={hourlyData} options={chartOptions as any} />
          </div>
        </div>
      </div>

      {/* Modal de Detalles de factura encontrada */}
      {searchResult && (
        <OrderDetailsModal 
          pedido={searchResult}
          onClose={() => setSearchResult(null)}
          isAdmin={true}
          onDelete={async () => {
            await deletePedido(searchResult.id)
            setSearchResult(null)
            fetchStats()
          }}
        />
      )}
    </div>
  )
}
