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
import { Line, Doughnut } from 'react-chartjs-2'

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

interface GlobalAdminStatsProps {
  pedidos: any[]
}

export function GlobalAdminStats({ pedidos }: GlobalAdminStatsProps) {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: 'rgba(255, 255, 255, 0.7)' } }
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.5)', maxTicksLimit: 10 },
        grid: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      y: {
        ticks: { color: 'rgba(255, 255, 255, 0.5)' },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        beginAtZero: true
      }
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: 'rgba(255, 255, 255, 0.7)', padding: 16 }
      }
    },
    cutout: '70%'
  }

  const lineChartData = useMemo(() => {
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString())
    const data = Array(daysInMonth).fill(0)

    pedidos.forEach((p: any) => {
      const d = new Date(p.created_at)
      if (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      ) {
        const dayIdx = d.getDate() - 1
        data[dayIdx] += p.numero_pedidos || 1
      }
    })

    return {
      labels,
      datasets: [
        {
          label: 'Pedidos registrados',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
        }
      ]
    }
  }, [pedidos])

  const doughnutData = useMemo(() => {
    let pendientes = 0
    let enviados = 0
    let entregados = 0
    let cancelados = 0

    pedidos.forEach((p: any) => {
      if (p.estado === 'pendiente') pendientes++
      else if (p.estado === 'enviado') enviados++
      else if (p.estado === 'entregado') entregados++
      else if (p.estado === 'cancelado') cancelados++
    })

    return {
      labels: ['Pendientes', 'Enviados', 'Entregados', 'Cancelados'],
      datasets: [
        {
          data: [pendientes, enviados, entregados, cancelados],
          backgroundColor: [
            'rgba(245, 158, 11, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderWidth: 0
        }
      ]
    }
  }, [pedidos])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Línea — Rendimiento diario */}
      <div className="lg:col-span-2 bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white">Rendimiento Operativo del Mes</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Pedidos registrados por día</p>
        </div>
        <div className="relative flex-1 min-h-[280px]">
          <Line data={lineChartData} options={chartOptions} />
        </div>
      </div>

      {/* Dona — Distribución de estados */}
      <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6 flex flex-col">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-white">Distribución de Estados</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Pedidos del mes actual</p>
        </div>
        <div className="relative flex-1 min-h-[240px] flex items-center justify-center">
          {pedidos.length > 0 ? (
            <Doughnut data={doughnutData} options={doughnutOptions} />
          ) : (
            <p className="text-neutral-500 italic text-sm text-center">
              Sin datos este mes
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
