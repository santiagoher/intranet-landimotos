import { Package, Truck, CheckCircle2, Users, Settings, LayoutDashboard } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user?.id)
    .single()

  const isAdmin = perfil?.rol === 'Admin'

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: totalPedidosMes },
    { count: totalPendientesMes },
  ] = await Promise.all([
    supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth).eq('estado', 'pendiente'),
  ])

  const mesActual = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const modulosOperativos = [
    {
      href: '/despachos',
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'hover:border-blue-500/50',
      title: 'Gestionar Despachos',
      desc: 'Registra pedidos y asigna rutas a los mensajeros.',
    },
    {
      href: '/mensajeros',
      icon: Truck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/50',
      title: 'Mensajeros',
      desc: 'Consulta la disponibilidad de los domiciliarios.',
    },
  ]

  const modulosAdmin = [
    {
      href: '/despachos',
      icon: Package,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'hover:border-blue-500/50',
      title: 'Dashboard Despachos',
      desc: 'Análisis de rendimiento, áreas y revisores.',
    },
    {
      href: '/mensajeros',
      icon: Truck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/50',
      title: 'Dashboard Mensajeros',
      desc: 'Rutas, pedidos entregados y picos de actividad.',
    },
    {
      href: '/admin/mensajeros',
      icon: Users,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      border: 'hover:border-purple-500/50',
      title: 'Conductores',
      desc: 'Gestiona el registro y estado de los mensajeros.',
    },
    {
      href: '/admin/usuarios',
      icon: Settings,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      border: 'hover:border-amber-500/50',
      title: 'Administración',
      desc: 'Usuarios, permisos y configuración del sistema.',
    },
  ]

  return (
    <div className="space-y-8 pb-12">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold">
              ¡Bienvenid@, {perfil?.nombre?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operador')}!
            </h2>
            <p className="mt-2 text-blue-100 opacity-90 max-w-lg capitalize">
              {mesActual} — {isAdmin ? 'Panel de control administrativo.' : 'Panel operativo del sistema.'}
            </p>
          </div>
          <div className="flex items-center gap-6 bg-white/10 backdrop-blur rounded-2xl px-6 py-4 self-start sm:self-center">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalPedidosMes ?? 0}</p>
              <p className="text-[11px] text-blue-200 uppercase tracking-wider font-semibold mt-0.5">Pedidos del mes</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-center">
              <p className="text-2xl font-bold">{totalPendientesMes ?? 0}</p>
              <p className="text-[11px] text-blue-200 uppercase tracking-wider font-semibold mt-0.5">Pendientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div>
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-4">
          {isAdmin ? 'Módulos del Sistema' : 'Acceso Rápido'}
        </h3>
        <div className={`grid gap-4 ${isAdmin ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {(isAdmin ? modulosAdmin : modulosOperativos).map((mod) => {
            const Icon = mod.icon
            return (
              <Link
                key={mod.href + mod.title}
                href={mod.href}
                className={`group bg-neutral-900 border border-neutral-800 p-6 rounded-2xl ${mod.border} transition-all shadow-sm active:scale-[0.98]`}
              >
                <div className={`w-12 h-12 ${mod.bg} rounded-xl flex items-center justify-center ${mod.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">{mod.title}</h3>
                <p className="text-sm text-neutral-500 mt-1">{mod.desc}</p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Resumen mensual */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5 text-emerald-400 font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          <span>Resumen del Estado Operativo — <span className="capitalize">{mesActual}</span></span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Pedidos registrados</p>
            <p className="text-2xl font-bold text-white mt-1">{totalPedidosMes ?? 0}</p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Por enviar</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{totalPendientesMes ?? 0}</p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Procesados</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">
              {Math.max(0, (totalPedidosMes ?? 0) - (totalPendientesMes ?? 0))}
            </p>
          </div>
          <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Cumplimiento</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">
              {totalPedidosMes
                ? `${Math.round(((totalPedidosMes - (totalPendientesMes ?? 0)) / totalPedidosMes) * 100)}%`
                : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
