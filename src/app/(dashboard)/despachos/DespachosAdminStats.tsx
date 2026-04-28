'use client'

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
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [puntoFilter, setPuntoFilter] = useState<'Principal' | 'Sucursal'>('Principal')
  const [revisorPuntoFilter, setRevisorPuntoFilter] = useState<'Principal' | 'Sucursal'>('Principal')
  
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
    try {
      let start = dateFilter
      let end = dateFilter
      
      if (!isRangeMode) {
        // Modo mensual: calcular inicio y fin de mes basado en el día seleccionado
        const d = new Date(dateFilter + 'T12:00:00')
        const y = d.getFullYear()
        const m = d.getMonth()
        start = new Date(y, m, 1).toISOString().split('T')[0]
        end = new Date(y, m + 1, 0).toISOString().split('T')[0]
      } else {
        start = startDate
        end = endDate
      }

      const data = await getDespachosStats(start, end)
      setStats(data)
    } catch (error) {
      console.error('Error fetching stats:', error)
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
      const data = await getDetailedReportData(startDate, endDate)
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

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center p-20 text-neutral-500">
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
    .filter((p: any) => p.punto === puntoFilter)
    .forEach((p: any) => {
      areaCounts[p.area] = (areaCounts[p.area] || 0) + 1
    })
  const sortedAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])

  // 4. RANKING REVISORES (Filtrado por Punto)
  const revisorCounts: { [key: string]: number } = {}
  stats.monthly
    .filter((p: any) => p.punto === revisorPuntoFilter)
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
      backgroundColor: [
        'rgba(59, 130, 246, 0.5)',
        'rgba(16, 185, 129, 0.5)',
        'rgba(245, 158, 11, 0.5)',
        'rgba(168, 85, 247, 0.5)',
        'rgba(236, 72, 153, 0.5)',
      ],
      borderColor: '#171717',
      borderWidth: 2,
    }]
  }

  const revisorData: ChartData<'polarArea'> = {
    labels: sortedRevisores.map(([revisor]) => revisor),
    datasets: [{
      label: 'Registros por Revisor',
      data: sortedRevisores.map(([, count]) => count),
      backgroundColor: [
        'rgba(168, 85, 247, 0.5)',
        'rgba(236, 72, 153, 0.5)',
        'rgba(59, 130, 246, 0.5)',
        'rgba(16, 185, 129, 0.5)',
        'rgba(245, 158, 11, 0.5)',
      ],
      borderColor: '#171717',
      borderWidth: 2,
    }]
  }

  const chartOptions: ChartOptions<'bar' | 'line' | 'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#171717',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#737373', font: { size: 10 } }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#737373', font: { size: 10 } }
      }
    }
  }

  const polarOptions: ChartOptions<'polarArea'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#737373', font: { size: 10 }, usePointStyle: true }
      }
    },
    scales: {
      r: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
        pointLabels: {
          display: true,
          centerPointLabels: true,
          font: { size: 9 },
          color: '#a3a3a3'
        },
        ticks: { display: false }
      }
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header de Stats */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-neutral-900/50 p-4 sm:p-6 rounded-3xl border border-neutral-800">
        <div className="w-full xl:w-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            Análisis de Operaciones
          </h1>
          <p className="text-neutral-400 text-xs sm:text-sm mt-1">Métricas de rendimiento y flujos de despacho.</p>
        </div>
        
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Buscador de Factura */}
            <form onSubmit={handleSearch} className="relative group flex-1 sm:flex-initial">
              <input 
                type="text"
                placeholder="Buscar factura..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 text-white text-sm px-10 py-2.5 rounded-2xl outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-full sm:w-[200px]"
              />
              <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
              {isSearching && (
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
                  {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
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
                      className="bg-transparent text-white text-sm outline-none w-full"
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
                      className="bg-transparent text-white text-sm outline-none w-full"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 1. Pedidos del Año (Anual) */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Pedidos por Mes ({yearNum})
            </h3>
          </div>
          <div className="h-[250px]">
            <Bar data={yearlyData} options={chartOptions as any} />
          </div>
        </div>

        {/* 2. Pedidos Diarios (Mes Actual) */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Registros {isRangeMode ? 'del Periodo' : `de ${monthName} ${yearNum}`}
            </h3>
          </div>
          <div className="h-[250px]">
            <Line data={dailyData} options={chartOptions as any} />
          </div>
        </div>

        {/* 3. Ranking de Áreas (Polar Area) */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Distribución por Áreas ({monthName})
            </h3>
            
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {(['Principal', 'Sucursal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPuntoFilter(p)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    puntoFilter === p 
                      ? 'bg-amber-500 text-white shadow-lg' 
                      : 'text-neutral-500 hover:text-white'
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
               <div className="h-full flex flex-col items-center justify-center text-neutral-600 text-sm italic">
                  No hay registros en {puntoFilter} para {monthName}
               </div>
             )}
          </div>
        </div>

        {/* 4. Ranking de Revisores (Polar Area) */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Desempeño de Revisores
            </h3>
            
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {(['Principal', 'Sucursal'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setRevisorPuntoFilter(p)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    revisorPuntoFilter === p 
                      ? 'bg-purple-500 text-white shadow-lg' 
                      : 'text-neutral-500 hover:text-white'
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
               <div className="h-full flex flex-col items-center justify-center text-neutral-600 text-sm italic">
                  No hay registros de revisores en {revisorPuntoFilter} para {monthName}
               </div>
             )}
          </div>
        </div>

        {/* 5. Pico de Hora (Dinámico con fecha) */}
        <div className="lg:col-span-2 bg-neutral-900/40 border border-neutral-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Picos de Hora - {isRangeMode ? 'Periodo Personalizado' : `${monthName} ${yearNum}`}
            </h3>
            <span className="text-xs text-neutral-500">Distribución horaria acumulada (00:00 - 23:59)</span>
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
