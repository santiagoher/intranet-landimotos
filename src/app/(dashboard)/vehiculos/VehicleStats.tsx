'use client'

import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { Truck, ShieldCheck, Wrench, AlertCircle } from 'lucide-react'
import { Vehicle, Checklist, Alerta } from './types'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface VehicleStatsProps {
  vehiculos: Vehicle[]
  checklists: Checklist[]
  alertas: Alerta[]
}

export function VehicleStats({ vehiculos, checklists, alertas }: VehicleStatsProps) {
  // KPI Metrics
  const stats = useMemo(() => {
    const total = vehiculos.length
    const activos = vehiculos.filter(v => v.estado === 'activo').length
    const mantenimiento = vehiculos.filter(v => v.estado === 'mantenimiento').length
    const pendientes = alertas.filter(a => a.estado === 'pendiente').length

    return {
      total,
      activos,
      mantenimiento,
      pendientes
    }
  }, [vehiculos, alertas])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 12,
          font: { size: 11 }
        }
      }
    },
    cutout: '70%'
  }

  // Chart Data 1: Fleet Status
  const fleetChartData = useMemo(() => {
    let activos = 0
    let mantenimiento = 0
    let inactivos = 0

    vehiculos.forEach(v => {
      if (v.estado === 'activo') activos++
      else if (v.estado === 'mantenimiento') mantenimiento++
      else inactivos++
    })

    return {
      labels: ['Activos', 'Mantenimiento', 'Inactivos'],
      datasets: [
        {
          data: [activos, mantenimiento, inactivos],
          backgroundColor: [
            'rgba(16, 185, 129, 0.85)', // Green
            'rgba(245, 158, 11, 0.85)', // Amber
            'rgba(107, 114, 128, 0.85)' // Gray
          ],
          borderWidth: 0
        }
      ]
    }
  }, [vehiculos])

  // Chart Data 2: Checklist Condition
  const checklistChartData = useMemo(() => {
    let sinNovedad = 0
    let conNovedad = 0

    checklists.forEach(c => {
      if (c.tiene_novedad) conNovedad++
      else sinNovedad++
    })

    return {
      labels: ['Sin Novedad (B)', 'Con Novedad (M)'],
      datasets: [
        {
          data: [sinNovedad, conNovedad],
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)', // Blue
            'rgba(239, 68, 68, 0.85)'  // Red
          ],
          borderWidth: 0
        }
      ]
    }
  }, [checklists])

  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vehicles */}
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Flota Total</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-blue-400 transition-colors">{stats.total}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-blue-500/30 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>

        {/* Active Vehicles */}
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Unidades Activas</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-emerald-400 transition-colors">{stats.activos}</h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-500/30 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>

        {/* Maintenance */}
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">En Taller / Manto.</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-amber-400 transition-colors">{stats.mantenimiento}</h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-amber-500/30 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>

        {/* Pending Alerts */}
        <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl p-5 hover:border-neutral-700 transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Novedades Pendientes</p>
              <h3 className="text-3xl font-extrabold text-white mt-1 group-hover:text-red-400 transition-colors">{stats.pendientes}</h3>
            </div>
            <div className={`p-3 rounded-xl ${stats.pendientes > 0 ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-neutral-800 text-neutral-500'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500/30 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fleet Distribution */}
        <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Distribución de Flota</h4>
            <p className="text-xs text-neutral-500 mt-0.5">Vehículos según estado operativo</p>
          </div>
          <div className="relative flex-1 flex items-center justify-center">
            {vehiculos.length > 0 ? (
              <Doughnut data={fleetChartData} options={chartOptions} />
            ) : (
              <p className="text-neutral-500 italic text-sm text-center">Sin vehículos registrados</p>
            )}
          </div>
        </div>

        {/* Checklist Novelties */}
        <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6 flex flex-col min-h-[300px]">
          <div className="mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Resultado de Reportes</h4>
            <p className="text-xs text-neutral-500 mt-0.5">Relación de novedad en checklists del período</p>
          </div>
          <div className="relative flex-1 flex items-center justify-center">
            {checklists.length > 0 ? (
              <Doughnut data={checklistChartData} options={chartOptions} />
            ) : (
              <p className="text-neutral-500 italic text-sm text-center">Sin reportes registrados en este período</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
